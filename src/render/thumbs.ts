import { useEffect, useState, useSyncExternalStore } from 'react';

import type { ID, Page } from '../core/model/types';
import { fileUri, toAbsolute } from '../core/util/paths';
import { renderDeps } from './config';
import { renderPageToFile } from './drawPage';

export const THUMB_WIDTH = 360;

const THUMB_DIR = 'thumbs';

const listeners = new Set<() => void>();
const queue: ID[] = [];
const stamps = new Map<ID, string | null>();
let busy = false;
let rev = 0;
let dirReady: Promise<void> | null = null;

export function thumbPath(pageId: ID): string {
  return toAbsolute(`${THUMB_DIR}/${pageId}.png`);
}

/** artRev moves with the art, updatedAt with the layout and lettering, and a thumbnail shows all of them. */
function stampOf(page: Pick<Page, 'artRev' | 'updatedAt'>): string {
  return `${page.artRev}.${page.updatedAt}`;
}

function storedStamp(pageId: ID): string | null {
  let stamp = stamps.get(pageId);
  if (stamp === undefined) {
    stamp = renderDeps().stamps.get(`thumb:${pageId}`);
    stamps.set(pageId, stamp);
  }
  return stamp;
}

/** Only a success stays cached: a failed promise here is what jammed the old queue for good. */
function ensureThumbDir(): Promise<void> {
  if (!dirReady) {
    dirReady = renderDeps()
      .files.ensureDir(toAbsolute(THUMB_DIR))
      .catch(error => {
        dirReady = null;
        throw error;
      });
  }
  return dirReady;
}

async function renderThumb(pageId: ID): Promise<void> {
  const deps = renderDeps();
  const source = deps.pageSource(pageId);
  if (!source) {
    return;
  }
  const stamp = stampOf(source.page);
  if (await renderPageToFile(pageId, THUMB_WIDTH, thumbPath(pageId), 'png')) {
    deps.stamps.set(`thumb:${pageId}`, stamp);
    stamps.set(pageId, stamp);
    rev++;
    listeners.forEach(listener => listener());
  }
}

async function runQueue(): Promise<void> {
  if (busy) {
    return;
  }
  busy = true;
  try {
    await ensureThumbDir();
    while (queue.length) {
      const pageId = queue.shift() as ID;
      try {
        await renderThumb(pageId);
      } catch {
        // One broken page must not stop the pages behind it. It retries when it next changes.
      }
    }
  } finally {
    busy = false;
  }
}

export function requestThumb(pageId: ID): void {
  if (!queue.includes(pageId)) {
    queue.push(pageId);
  }
  // Always kick: pages left behind by a failed run must not wait for a page that is not queued yet.
  runQueue().catch(() => {});
}

export function forgetThumb(pageId: ID): void {
  const deps = renderDeps();
  stamps.delete(pageId);
  deps.stamps.remove(`thumb:${pageId}`);
  deps.files.remove(thumbPath(pageId)).catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThumb(pageId: ID | undefined): string | null {
  const page = renderDeps().usePage(pageId);
  useSyncExternalStore(subscribe, () => rev);
  const [, force] = useState(0);
  const current = page ? stampOf(page) : null;
  const stored = pageId ? storedStamp(pageId) : null;
  useEffect(() => {
    if (pageId && current && stored !== current) {
      requestThumb(pageId);
      force(n => n + 1);
    }
  }, [pageId, current, stored]);
  return pageId && stored ? `${fileUri(thumbPath(pageId))}?v=${stored}` : null;
}
