/**
 * Recorded voices, one clip per bubble, kept by chapter. The audio files live in the app's documents; this
 * small index (saved in meta storage) says which file voices which bubble, how long it is and who spoke it.
 */
import { z } from 'zod';

import type { ID } from '../model/types';
import type { DubItem } from './dub';

/** A line longer than this is cut: speech bubbles are short, and a short clip travels fast. */
export const MAX_CLIP_MS = 15000;
/** Shorter than this is a slip of the finger, not a take. */
export const MIN_CLIP_MS = 300;

export type ClipEntry = {
  /** Path relative to the files root, so a moved app folder still finds it. */
  file: string;
  ms: number;
  /** The name of the person who spoke it. */
  by: string;
  /** The bubble's text when it was recorded; the clip is flagged when the text has changed since. */
  text: string;
  at: number;
};

/** chapterId → bubbleId → clip. */
export type ClipIndex = Record<ID, Record<ID, ClipEntry>>;

const entrySchema = z.object({
  file: z.string().min(1).max(400),
  ms: z.number().finite().min(0),
  by: z.string().max(80),
  text: z.string().max(2000),
  at: z.number().finite(),
});

const indexSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

/** A broken entry is dropped alone, so one bad row never loses every voice. */
export function parseClipIndex(json: string | null | undefined): ClipIndex {
  if (!json) {
    return {};
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  const outer = indexSchema.safeParse(raw);
  if (!outer.success) {
    return {};
  }
  const index: ClipIndex = {};
  Object.entries(outer.data).forEach(([chapterId, clips]) => {
    const good: Record<ID, ClipEntry> = {};
    Object.entries(clips).forEach(([bubbleId, value]) => {
      const entry = entrySchema.safeParse(value);
      if (entry.success) {
        good[bubbleId] = entry.data;
      }
    });
    if (Object.keys(good).length > 0) {
      index[chapterId] = good;
    }
  });
  return index;
}

/** Adds or replaces a clip. `replaced` is the file of the take it replaced, for the caller to delete. */
export function withClip(index: ClipIndex, chapterId: ID, bubbleId: ID, entry: ClipEntry): { index: ClipIndex; replaced?: string } {
  const before = index[chapterId]?.[bubbleId];
  const next = { ...index, [chapterId]: { ...index[chapterId], [bubbleId]: entry } };
  return { index: next, replaced: before && before.file !== entry.file ? before.file : undefined };
}

export function withoutClip(index: ClipIndex, chapterId: ID, bubbleId: ID): { index: ClipIndex; removed?: string } {
  const before = index[chapterId]?.[bubbleId];
  if (!before) {
    return { index };
  }
  const rest = { ...index[chapterId] };
  delete rest[bubbleId];
  const next = { ...index };
  if (Object.keys(rest).length > 0) {
    next[chapterId] = rest;
  } else {
    delete next[chapterId];
  }
  return { index: next, removed: before.file };
}

export function chapterClips(index: ClipIndex, chapterId: ID): Record<ID, ClipEntry> {
  return index[chapterId] ?? {};
}

/** The bubble was rewritten after it was recorded. */
export function isStale(entry: Pick<ClipEntry, 'text'>, text: string): boolean {
  return entry.text.trim() !== text.trim();
}

export function clampClipMs(ms: number): number {
  return Math.max(0, Math.min(MAX_CLIP_MS, Math.round(Number.isFinite(ms) ? ms : 0)));
}

/** File names built only from safe characters, whatever an id from another phone holds. */
export function clipFileName(chapterId: ID, bubbleId: ID, at: number): string {
  const safe = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'x';
  return `${safe(chapterId)}-${safe(bubbleId)}-${Math.round(at).toString(36)}.m4a`;
}

/** How a line is heard: the recorded voice when there is one, else the device's text-to-speech. */
export type LineSource = { kind: 'clip'; file: string; ms: number } | { kind: 'tts' };

export function sourceOf(bubbleId: ID | undefined, clips: Record<ID, ClipEntry>): LineSource {
  const clip = bubbleId ? clips[bubbleId] : undefined;
  return clip && clip.ms >= MIN_CLIP_MS ? { kind: 'clip', file: clip.file, ms: clip.ms } : { kind: 'tts' };
}

/** The recorded clips of a chapter in reading order, for the shared audio file. */
export function clipsInOrder(lines: Pick<DubItem, 'bubbleId'>[], clips: Record<ID, ClipEntry>): ClipEntry[] {
  return lines.flatMap(line => {
    const source = sourceOf(line.bubbleId, clips);
    return source.kind === 'clip' ? [clips[line.bubbleId]] : [];
  });
}

/** How many lines have a voice, out of all of them. */
export function progressOf(lines: Pick<DubItem, 'bubbleId'>[], clips: Record<ID, ClipEntry>): { done: number; total: number } {
  return { done: clipsInOrder(lines, clips).length, total: lines.length };
}

/**
 * A playlist for the zipped clips when the phone cannot join them into one file: an extended M3U naming each
 * clip with who says what. Lines with no voice yet are listed as comments, so the script stays complete.
 */
export function playlistText(
  title: string,
  lines: Pick<DubItem, 'bubbleId' | 'role' | 'text'>[],
  clips: Record<ID, ClipEntry>,
  names: Record<string, string>,
  fileOf: (entry: ClipEntry) => string,
): string {
  const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
  const out = ['#EXTM3U', `#PLAYLIST:${oneLine(title)}`];
  lines.forEach(line => {
    const who = oneLine(names[line.role] ?? '');
    const source = sourceOf(line.bubbleId, clips);
    if (source.kind === 'clip') {
      out.push(`#EXTINF:${Math.max(1, Math.round(source.ms / 1000))},${who} - ${oneLine(line.text)}`, fileOf(clips[line.bubbleId]));
    } else {
      out.push(`# ${who}: ${oneLine(line.text)}`);
    }
  });
  return `${out.join('\n')}\n`;
}
