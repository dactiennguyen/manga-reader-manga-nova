/**
 * Where a shared page lives on this phone: the host draws in its own story, a guest gets a copy as a new
 * story in the library. Each person's strokes go on a layer named after them; layers of other people are
 * written without touching this phone's undo history (see commitForeignStrokes).
 */
import { uniqueTitle, type ProjectBundle } from '../../../core/archive/bundle';
import { localCopyOf, layerFor, IdMap } from '../../../core/nearby/codraw';
import type { ID, Stroke } from '../../../core/model/types';
import {
  addForeignLayer,
  commitForeignStrokes,
  emptyArt,
  importArt,
  loadArt,
  rewriteForeignLayer,
  saveArt,
  setActiveLayer,
} from '../../../state/artStore';
import { importEntities, useStory } from '../../../state/useStory';
import { DRAWN_TOGETHER, addStoryPage, ensureStory } from '../draw/drawStories';

/** A new single-panel page in the "Drawn together" story, for "start from a blank page". */
export function createBlankSharedPage(): ID | null {
  return addStoryPage(ensureStory(DRAWN_TOGETHER), 'g1');
}

export type GuestCopy = { projectId: ID; pageId: ID; map: IdMap };

/** The host's page as a new story in this phone's library. Art first, like importing a file. */
export function importSharedPage(parsed: ProjectBundle): GuestCopy {
  const copy = localCopyOf(parsed);
  const { bundle } = copy;
  const taken = Object.values(useStory.getState().projects).map(item => item.title);
  const now = Date.now();
  const project = { ...bundle.project, title: uniqueTitle(bundle.project.title, taken), createdAt: now, updatedAt: now };
  importArt(bundle.art);
  importEntities({
    projects: { [project.id]: project },
    chapters: Object.fromEntries(bundle.chapters.map(item => [item.id, item])),
    pages: Object.fromEntries(bundle.pages.map(item => [item.id, item])),
  });
  const map = new IdMap();
  Object.entries(copy.panels).forEach(([hostId, localId]) => map.set(hostId, localId));
  return { projectId: project.id, pageId: copy.pageId, map };
}

/** The host's latest art over an existing copy, panel by panel (a late join, or the end of the session). */
export function refreshSharedPage(parsed: ProjectBundle, map: IdMap): void {
  Object.entries(parsed.art).forEach(([hostId, art]) => {
    const local = map.local(hostId);
    if (local) {
      saveArt(local, art);
    }
  });
}

/** Remembers which layer belongs to whom, per panel. */
export class LayerBook {
  private known = new Map<string, ID>();

  /** The person's layer in this panel, made on first use. Other people's layers start locked. */
  layer(panelId: ID, key: string, name: string, foreign: boolean): ID {
    if (!loadArt(panelId)) {
      saveArt(panelId, emptyArt());
    }
    const slot = `${panelId}\u0000${key}`;
    const found = layerFor(loadArt(panelId), this.known.get(slot), name);
    const id = found ?? addForeignLayer(panelId, name, foreign ? { locked: true } : {});
    this.known.set(slot, id);
    return id;
  }

  /** This person's own layer, made active so their pen lands on it. */
  mine(panelId: ID, key: string, name: string): ID {
    const id = this.layer(panelId, key, name, false);
    if (loadArt(panelId)?.activeLayerId !== id) {
      setActiveLayer(panelId, id);
    }
    return id;
  }

  addStroke(panelId: ID, key: string, name: string, stroke: Stroke): void {
    commitForeignStrokes(panelId, this.layer(panelId, key, name, true), [stroke]);
  }

  replace(panelId: ID, key: string, name: string, strokes: Stroke[]): void {
    rewriteForeignLayer(panelId, this.layer(panelId, key, name, true), strokes);
  }

  clear(): void {
    this.known.clear();
  }
}
