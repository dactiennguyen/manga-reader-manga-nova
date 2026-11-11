/**
 * Drawing one page together: what travels between phones and how it lands. The host's page is the
 * original; each guest works on a local copy with its own ids, and every message names the host's ids,
 * so a copy made twice never collides. Each person draws on a layer named after them.
 */
import { z } from 'zod';

import { mapBundleImages, remapBundleIds, type ProjectBundle } from '../archive/bundle';
import { parseProjectBundle } from '../archive/parse';
import { collectPanelIds } from '../layout/layout';
import type { ID, PanelArt, Project, Stroke, StoryData } from '../model/types';
import { uid } from '../util/id';
import type { MemberId } from './types';

/** About ten updates a second: smooth enough to follow, light enough for a busy room. */
export const CURSOR_EVERY_MS = 100;
/** A cursor that stops moving fades after this long. */
export const CURSOR_STALE_MS = 2500;
/** How long a reaction floats before it is gone. */
export const REACTION_MS = 2200;
/** Reactions are content people send each other, not interface icons. */
export const REACTIONS = ['👏', '😂', '😮', '❤️', '🔥', '✨'] as const;

/**
 * Printed inks, one per member colour index (hostSession's MEMBER_COLOR_COUNT). Riso ink colours, not
 * interface tokens: they mark people, like the colour of a pen, and carry cream text on top.
 */
export const MEMBER_INKS = ['#D9483A', '#2F6DB5', '#1F7F55', '#9C6A0C', '#167A82', '#A8492F', '#46679E', '#7A5B26'];

/** Blob `meta` for the two kinds of page data co-draw sends. */
export type CoDrawBlobMeta =
  | { codraw: 'page'; pageId: ID; final?: boolean }
  | { codraw: 'layer'; pageId: ID; panelId: ID; layerKey: string };

export function readCoDrawMeta(meta: Record<string, unknown> | undefined): CoDrawBlobMeta | null {
  if (!meta || typeof meta.pageId !== 'string') {
    return null;
  }
  if (meta.codraw === 'page') {
    return { codraw: 'page', pageId: meta.pageId, final: meta.final === true };
  }
  if (meta.codraw === 'layer' && typeof meta.panelId === 'string' && typeof meta.layerKey === 'string') {
    return { codraw: 'layer', pageId: meta.pageId, panelId: meta.panelId, layerKey: meta.layerKey };
  }
  return null;
}

/**
 * Only the one page, as a story bundle so the guest reads it with the same checks as an imported file.
 * Script links are dropped: the guest has no script, and dangling ids would point nowhere.
 */
export function pageBundle(
  state: StoryData,
  pageId: ID,
  exportArt: (panelIds: ID[]) => Record<ID, PanelArt>,
): ProjectBundle | null {
  const page = state.pages[pageId];
  const chapter = page ? state.chapters[page.chapterId] : undefined;
  const project = chapter ? state.projects[chapter.projectId] : undefined;
  if (!page || !chapter || !project) {
    return null;
  }
  const panels = Object.fromEntries(Object.entries(page.panels).map(([id, panel]) => [id, { ...panel, blockIds: [] }]));
  const bubbles = page.bubbles.map(({ blockId: _block, characterId: _character, ...bubble }) => bubble);
  const bare: Project = {
    ...project,
    acts: [{ id: 'act', title: '', chapterIds: [chapter.id] }],
    coverUri: undefined,
    lastOpened: undefined,
    deletedAt: undefined,
  };
  const bundle: ProjectBundle = {
    version: 1,
    app: 'manganova',
    exportedAt: Date.now(),
    project: bare,
    chapters: [{ ...chapter, characterIds: [], sceneIds: [], pageIds: [pageId] }],
    scenes: [],
    characters: [],
    relations: [],
    world: [],
    pages: [{ ...page, panels, bubbles }],
    art: exportArt(collectPanelIds(page.layout)),
  };
  // Imported pictures live in this phone's files; the other phone could not open the path.
  return mapBundleImages(bundle, () => undefined);
}

export type LocalCopy = {
  bundle: ProjectBundle;
  pageId: ID;
  /** Host panel id → this phone's panel id. */
  panels: Record<ID, ID>;
};

/** Checks a page from another phone with the same rules as an imported file. Null when it is not one page. */
export function parsePage(json: string): ProjectBundle | null {
  try {
    const parsed = parseProjectBundle(json);
    return parsed.pages.length === 1 && parsed.pages[0].layout ? mapBundleImages(parsed, () => undefined) : null;
  } catch {
    return null;
  }
}

/** The page with fresh local ids, and which local panel each of the host's panels became. */
export function localCopyOf(parsed: ProjectBundle, newId: () => ID = uid): LocalCopy {
  const bundle = remapBundleIds(parsed, newId);
  const page = bundle.pages[0];
  const from = collectPanelIds(parsed.pages[0].layout);
  const to = collectPanelIds(page.layout);
  const panels: Record<ID, ID> = {};
  from.forEach((id, index) => {
    panels[id] = to[index];
  });
  return { bundle, pageId: page.id, panels };
}

/** Host id → local id, and back for what this phone sends. */
export class IdMap {
  private toLocal = new Map<ID, ID>();
  private toHost = new Map<ID, ID>();

  set(hostId: ID, localId: ID): void {
    this.toLocal.set(hostId, localId);
    this.toHost.set(localId, hostId);
  }

  local(hostId: ID): ID | undefined {
    return this.toLocal.get(hostId);
  }

  host(localId: ID): ID | undefined {
    return this.toHost.get(localId);
  }
}

/** The identity map, on the host whose ids are the room's ids. */
export function identityMap(ids: ID[]): IdMap {
  const map = new IdMap();
  ids.forEach(id => map.set(id, id));
  return map;
}

/**
 * Which layer a person's strokes go into. A layer seen before is remembered by key; otherwise one with
 * their name is reused, so a page that arrives later (late join, end of session) still lines up.
 */
export function layerFor(art: PanelArt | null, known: ID | undefined, name: string): ID | null {
  if (!art) {
    return null;
  }
  if (known && art.layers.some(layer => layer.id === known)) {
    return known;
  }
  return art.layers.find(layer => layer.name === name)?.id ?? null;
}

const stroke = z.object({
  tool: z.enum(['gpen', 'pencil', 'brush', 'eraser', 'line', 'rect', 'ellipse', 'fill']),
  color: z.string().max(32),
  size: z.number().finite(),
  opacity: z.number().finite(),
  points: z.array(z.number().finite()),
  pressure: z.boolean().optional(),
  tone: z.object({ density: z.number().finite() }).optional(),
});

const layerPayload = z.object({ strokes: z.array(stroke).max(20000) });

/** A whole layer sent again after its owner undid, cleared or moved their drawing. */
export function parseLayerPayload(value: unknown): Stroke[] | null {
  const parsed = layerPayload.safeParse(value);
  return parsed.success ? (parsed.data.strokes as Stroke[]) : null;
}

/**
 * Whether a layer only grew since it was last sent: those strokes travel as single messages. Anything
 * else (an undo, a clear, a move) means sending the whole layer again.
 */
export function onlyAppended(sent: readonly Stroke[], now: readonly Stroke[]): boolean {
  if (now.length < sent.length) {
    return false;
  }
  for (let i = 0; i < sent.length; i++) {
    if (now[i] !== sent[i]) {
      return false;
    }
  }
  return true;
}

export type Cursor = { member: MemberId; panelId: ID; x: number; y: number; at: number };

/** Lets one cursor update through per interval; the last one always goes out when the pen lifts. */
export function cursorDue(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= CURSOR_EVERY_MS;
}

export function liveCursors(cursors: Record<MemberId, Cursor>, panelId: ID, now: number): Cursor[] {
  return Object.values(cursors).filter(cursor => cursor.panelId === panelId && now - cursor.at < CURSOR_STALE_MS);
}

export function isReaction(emoji: string): boolean {
  return (REACTIONS as readonly string[]).includes(emoji);
}
