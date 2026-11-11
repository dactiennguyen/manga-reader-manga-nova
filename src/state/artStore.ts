import { useSyncExternalStore } from 'react';

import type { ArtRepo, LayerRow } from '../core/ports';
import type { ArtLayer, ID, PanelArt, Stroke } from '../core/model/types';
import { uid } from '../core/util/id';
import { noteStrokes } from './useActivity';

/** Panels kept in memory. Art is the largest thing the app holds. */
const CACHE_PANELS = 3;
const UNDO_LIMIT = 50;

type LayerPatch = { before: LayerRow | null; after: LayerRow };

type PanelHistory = { past: LayerPatch[][]; future: LayerPatch[][] };

let repo: ArtRepo | null = null;
const memory = new Map<ID, PanelArt>();
const cache = new Map<ID, PanelArt>();
const withArt = new Set<ID>();
const histories = new Map<ID, PanelHistory>();
const revs = new Map<ID, number>();
const listeners = new Set<() => void>();
let version = 0;

function notify(panelId: ID): void {
  revs.set(panelId, (revs.get(panelId) ?? 0) + 1);
  version++;
  listeners.forEach(listener => listener());
}

function remember(panelId: ID, art: PanelArt): PanelArt {
  cache.delete(panelId);
  cache.set(panelId, art);
  while (repo && cache.size > CACHE_PANELS) {
    cache.delete(cache.keys().next().value as ID);
  }
  if (artHasContent(art)) {
    withArt.add(panelId);
  } else {
    withArt.delete(panelId);
  }
  return art;
}

export function connectArt(next: ArtRepo | null): void {
  repo = next;
  memory.clear();
  cache.clear();
  histories.clear();
  withArt.clear();
  next?.panelsWithArt().forEach(id => withArt.add(id));
}

export function newLayer(name: string): ArtLayer {
  return { id: uid(), name, visible: true, opacity: 1, locked: false, strokes: [] };
}

export function emptyArt(): PanelArt {
  const sketch = newLayer('Sketch');
  const ink = newLayer('Ink');
  return { layers: [sketch, ink], activeLayerId: sketch.id };
}

export function loadArt(panelId: ID): PanelArt | null {
  const cached = cache.get(panelId);
  if (cached) {
    return remember(panelId, cached);
  }
  const art = repo ? repo.loadPanel(panelId) : memory.get(panelId) ?? null;
  return art ? remember(panelId, art) : null;
}

/** Whole-panel write for import, copy and first use. Layers get new ids, so read the result back. */
export function saveArt(panelId: ID, art: PanelArt): PanelArt {
  const saved = repo ? repo.savePanel(panelId, art) : art;
  if (!repo) {
    memory.set(panelId, saved);
  }
  histories.delete(panelId);
  remember(panelId, saved);
  notify(panelId);
  return saved;
}

export function copyArt(fromPanelId: ID, toPanelId: ID): void {
  const art = loadArt(fromPanelId);
  if (art) {
    saveArt(toPanelId, JSON.parse(JSON.stringify(art)) as PanelArt);
  }
}

export function artHasContent(art: PanelArt | null): boolean {
  return !!art && art.layers.some(layer => layer.strokes.length > 0 || !!layer.image);
}

export function panelHasArt(panelId: ID): boolean {
  return withArt.has(panelId);
}

function rowOf(panelId: ID, layer: ArtLayer, pos: number, deleted = false): LayerRow {
  return {
    id: layer.id,
    panelId,
    pos,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    locked: layer.locked,
    image: layer.image,
    gen: layer.gen ?? 0,
    head: layer.head ?? layer.strokes.length,
    deleted,
  };
}

function historyOf(panelId: ID): PanelHistory {
  let history = histories.get(panelId);
  if (!history) {
    history = { past: [], future: [] };
    histories.set(panelId, history);
  }
  return history;
}

function record(panelId: ID, patches: LayerPatch[]): void {
  const history = historyOf(panelId);
  history.past = [...history.past, patches].slice(-UNDO_LIMIT);
  history.future = [];
}

function update(panelId: ID, change: (art: PanelArt) => PanelArt): PanelArt {
  const art = loadArt(panelId) ?? { layers: [] };
  const next = change(art);
  if (!repo) {
    memory.set(panelId, next);
  }
  remember(panelId, next);
  notify(panelId);
  return next;
}

function currentRow(panelId: ID, layerId: ID): LayerRow {
  const art = loadArt(panelId);
  const pos = art?.layers.findIndex(layer => layer.id === layerId) ?? -1;
  if (!art || pos < 0) {
    throw new Error(`Layer not found: ${layerId}`);
  }
  return rowOf(panelId, art.layers[pos], pos);
}

/** Goes to disk before returning, so a stroke survives the app dying right after the pen lifts. */
export function commitStroke(panelId: ID, layerId: ID, ...strokes: Stroke[]): void {
  const before = currentRow(panelId, layerId);
  const state = repo
    ? repo.appendStrokes(layerId, strokes)
    : { gen: before.gen, head: before.head + strokes.length };
  update(panelId, art => ({
    ...art,
    layers: art.layers.map(layer =>
      layer.id === layerId ? { ...layer, strokes: [...layer.strokes, ...strokes], ...state } : layer,
    ),
  }));
  record(panelId, [{ before, after: { ...before, ...state } }]);
  noteStrokes(strokes.length);
}

/** Replaces a layer's strokes as a new generation, so undo only has to point back at the old one. */
export function rewriteLayer(panelId: ID, layerId: ID, strokes: Stroke[], patch: Partial<ArtLayer> = {}): void {
  const before = currentRow(panelId, layerId);
  const state = repo ? repo.writeGeneration(layerId, strokes) : { gen: before.gen + 1, head: strokes.length };
  const after: LayerRow = { ...before, ...state, image: 'image' in patch ? patch.image : before.image };
  repo?.putLayer(after);
  update(panelId, art => ({
    ...art,
    layers: art.layers.map(layer => (layer.id === layerId ? { ...layer, ...patch, strokes, ...state } : layer)),
  }));
  record(panelId, [{ before, after }]);
}

/**
 * Changes made by someone else in a shared page. They are saved like any stroke but stay out of this
 * phone's undo history: undo here only ever takes back what this person drew. Rows of the layer already
 * in the history follow its new head, so undoing a local layer move cannot roll the other person back.
 */
function followForeign(panelId: ID, layerId: ID, state: { gen: number; head: number }): void {
  const history = histories.get(panelId);
  if (!history) {
    return;
  }
  const fix = (row: LayerRow | null): LayerRow | null => (row && row.id === layerId ? { ...row, ...state } : row);
  const fixAll = (steps: LayerPatch[][]) =>
    steps.map(patches => patches.map(patch => ({ before: fix(patch.before), after: fix(patch.after) as LayerRow })));
  history.past = fixAll(history.past);
  history.future = fixAll(history.future);
}

export function commitForeignStrokes(panelId: ID, layerId: ID, strokes: Stroke[]): void {
  const before = currentRow(panelId, layerId);
  const state = repo
    ? repo.appendStrokes(layerId, strokes)
    : { gen: before.gen, head: before.head + strokes.length };
  update(panelId, art => ({
    ...art,
    layers: art.layers.map(layer =>
      layer.id === layerId ? { ...layer, strokes: [...layer.strokes, ...strokes], ...state } : layer,
    ),
  }));
  followForeign(panelId, layerId, state);
}

/** The other person undid, cleared or moved their drawing: their whole layer arrives again. */
export function rewriteForeignLayer(panelId: ID, layerId: ID, strokes: Stroke[]): void {
  const before = currentRow(panelId, layerId);
  const state = repo ? repo.writeGeneration(layerId, strokes) : { gen: before.gen + 1, head: strokes.length };
  repo?.putLayer({ ...before, ...state });
  update(panelId, art => ({
    ...art,
    layers: art.layers.map(layer => (layer.id === layerId ? { ...layer, strokes, ...state } : layer)),
  }));
  followForeign(panelId, layerId, state);
}

/** On top of the stack, without taking the active layer from the person drawing here. */
export function addForeignLayer(panelId: ID, name: string, init: Partial<ArtLayer> = {}): ID {
  const layer: ArtLayer = { ...newLayer(name), ...init, gen: 0, head: init.strokes?.length ?? 0 };
  const pos = loadArt(panelId)?.layers.length ?? 0;
  repo?.putLayer({ ...rowOf(panelId, layer, pos), head: 0 });
  if (layer.strokes.length) {
    repo?.appendStrokes(layer.id, layer.strokes);
  }
  update(panelId, art => ({
    ...art,
    layers: [...art.layers, layer],
    activeLayerId: art.activeLayerId ?? layer.id,
  }));
  return layer.id;
}

export type LayerEdit = Partial<Pick<ArtLayer, 'name' | 'visible' | 'opacity' | 'locked' | 'image'>>;

export function editLayer(panelId: ID, layerId: ID, edit: LayerEdit): void {
  const before = currentRow(panelId, layerId);
  const after: LayerRow = { ...before, ...edit };
  repo?.putLayer(after);
  update(panelId, art => ({
    ...art,
    layers: art.layers.map(layer => (layer.id === layerId ? { ...layer, ...edit } : layer)),
  }));
  record(panelId, [{ before, after }]);
}

/** Inserts at `at` in the stack, the end by default. Layers above it move up in the same undo step. */
export function addLayer(panelId: ID, name: string, init: Partial<ArtLayer> = {}, at?: number): ID {
  const layer: ArtLayer = { ...newLayer(name), ...init, gen: 0, head: init.strokes?.length ?? 0 };
  const current = loadArt(panelId)?.layers ?? [];
  const pos = Math.max(0, Math.min(at ?? current.length, current.length));
  const after = rowOf(panelId, layer, pos);
  // Strokes the layer starts with are appended to an empty row, so they belong to this same undo step.
  repo?.putLayer({ ...after, head: 0 });
  if (layer.strokes.length) {
    repo?.appendStrokes(layer.id, layer.strokes);
  }
  const patches: LayerPatch[] = [{ before: null, after }];
  current.slice(pos).forEach((above, index) => {
    const before = rowOf(panelId, above, pos + index);
    const moved = { ...before, pos: before.pos + 1 };
    repo?.putLayer(moved);
    patches.push({ before, after: moved });
  });
  update(panelId, art => {
    const layers = [...art.layers];
    layers.splice(pos, 0, layer);
    return { ...art, layers, activeLayerId: layer.id };
  });
  repo?.setActiveLayer(panelId, layer.id);
  record(panelId, patches);
  return layer.id;
}

/** Folds one layer into another as a single undo step. The caller decides the merged content. */
export function mergeLayers(
  panelId: ID,
  upperId: ID,
  lowerId: ID,
  merged: { strokes: Stroke[]; image?: ArtLayer['image'] },
): void {
  const upper = currentRow(panelId, upperId);
  const lower = currentRow(panelId, lowerId);
  const state = repo ? repo.writeGeneration(lowerId, merged.strokes) : { gen: lower.gen + 1, head: merged.strokes.length };
  const lowerAfter: LayerRow = { ...lower, ...state, image: merged.image };
  const upperAfter: LayerRow = { ...upper, deleted: true };
  repo?.putLayer(lowerAfter);
  repo?.putLayer(upperAfter);
  update(panelId, art => ({
    ...art,
    activeLayerId: lowerId,
    layers: art.layers
      .filter(layer => layer.id !== upperId)
      .map(layer =>
        layer.id === lowerId ? { ...layer, strokes: merged.strokes, image: merged.image, ...state } : layer,
      ),
  }));
  repo?.setActiveLayer(panelId, lowerId);
  persistOrder(panelId, loadArt(panelId)?.layers ?? []);
  record(panelId, [
    { before: lower, after: lowerAfter },
    { before: upper, after: upperAfter },
  ]);
}

export function removeLayer(panelId: ID, layerId: ID): void {
  const before = currentRow(panelId, layerId);
  const after = { ...before, deleted: true };
  repo?.putLayer(after);
  const art = update(panelId, current => {
    const layers = current.layers.filter(layer => layer.id !== layerId);
    const activeLayerId = current.activeLayerId === layerId ? layers[layers.length - 1]?.id : current.activeLayerId;
    return { ...current, layers, activeLayerId };
  });
  repo?.setActiveLayer(panelId, art.activeLayerId);
  persistOrder(panelId, art.layers);
  record(panelId, [{ before, after }]);
}

export function reorderLayers(panelId: ID, orderedIds: ID[]): void {
  const art = loadArt(panelId);
  if (!art) {
    return;
  }
  const patches: LayerPatch[] = [];
  const layers = orderedIds
    .map(id => art.layers.find(layer => layer.id === id))
    .filter((layer): layer is ArtLayer => !!layer);
  layers.forEach((layer, pos) => {
    const before = rowOf(panelId, layer, art.layers.indexOf(layer));
    if (before.pos !== pos) {
      const after = { ...before, pos };
      repo?.putLayer(after);
      patches.push({ before, after });
    }
  });
  update(panelId, current => ({ ...current, layers }));
  if (patches.length) {
    record(panelId, patches);
  }
}

export function setActiveLayer(panelId: ID, layerId: ID): void {
  repo?.setActiveLayer(panelId, layerId);
  update(panelId, art => ({ ...art, activeLayerId: layerId }));
}

/** Rows being restored go back to their index; every other layer keeps its relative order. */
function placeLayers(layers: ArtLayer[], rows: { row: LayerRow | null }[]): ArtLayer[] {
  const targets = new Map<ID, number>();
  rows.forEach(({ row }) => {
    if (row && !row.deleted) {
      targets.set(row.id, row.pos);
    }
  });
  const placed = layers.filter(layer => !targets.has(layer.id));
  [...targets.entries()]
    .sort((a, b) => a[1] - b[1])
    .forEach(([id, pos]) => {
      const layer = layers.find(item => item.id === id);
      if (layer) {
        placed.splice(Math.min(pos, placed.length), 0, layer);
      }
    });
  return placed;
}

/** Keeps pos equal to the array index on disk, so a cold start shows the same stack. */
function persistOrder(panelId: ID, layers: ArtLayer[]): void {
  layers.forEach((layer, pos) => repo?.putLayer(rowOf(panelId, layer, pos)));
}

function applyRows(panelId: ID, rows: { row: LayerRow | null; other: LayerRow | null }[]): void {
  update(panelId, art => {
    let layers = [...art.layers];
    for (const { row, other } of rows) {
      const id = (row ?? other)!.id;
      if (!row || row.deleted) {
        if (row) {
          repo?.putLayer(row);
        } else if (other) {
          repo?.putLayer({ ...other, deleted: true });
        }
        layers = layers.filter(layer => layer.id !== id);
        continue;
      }
      repo?.putLayer(row);
      const seen = layers.find(layer => layer.id === id);
      const sameGen = seen && (seen.gen ?? 0) === row.gen;
      const strokes =
        seen && sameGen && row.head <= seen.strokes.length
          ? seen.strokes.slice(0, row.head)
          : repo
          ? repo.loadStrokes(id, row.gen, row.head)
          : seen?.strokes ?? [];
      const next: ArtLayer = {
        id,
        name: row.name,
        visible: row.visible,
        opacity: row.opacity,
        locked: row.locked,
        image: row.image,
        gen: row.gen,
        head: row.head,
        strokes,
      };
      layers = seen ? layers.map(layer => (layer.id === id ? next : layer)) : [...layers, next];
    }
    const sorted = placeLayers(layers, rows);
    persistOrder(panelId, sorted);
    const activeLayerId = sorted.some(layer => layer.id === art.activeLayerId)
      ? art.activeLayerId
      : sorted[sorted.length - 1]?.id;
    return { ...art, layers: sorted, activeLayerId };
  });
}

export function undoArt(panelId: ID): boolean {
  const history = historyOf(panelId);
  const patches = history.past[history.past.length - 1];
  if (!patches) {
    return false;
  }
  history.past = history.past.slice(0, -1);
  history.future = [...history.future, patches];
  applyRows(
    panelId,
    patches.map(patch => ({ row: patch.before, other: patch.after })),
  );
  return true;
}

export function redoArt(panelId: ID): boolean {
  const history = historyOf(panelId);
  const patches = history.future[history.future.length - 1];
  if (!patches) {
    return false;
  }
  history.future = history.future.slice(0, -1);
  history.past = [...history.past, patches];
  applyRows(
    panelId,
    patches.map(patch => ({ row: patch.after, other: patch.before })),
  );
  return true;
}

export function canUndoArt(panelId: ID): boolean {
  return (histories.get(panelId)?.past.length ?? 0) > 0;
}

export function canRedoArt(panelId: ID): boolean {
  return (histories.get(panelId)?.future.length ?? 0) > 0;
}

export function artRev(panelId: ID): number {
  return revs.get(panelId) ?? 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every art change, outside React: drawing together sends this person's strokes as they land. */
export const subscribeArt = subscribe;

export function useArtRev(panelId: ID | undefined): number {
  return useSyncExternalStore(subscribe, () => (panelId ? artRev(panelId) : 0));
}

export function useArtVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export function exportArt(panelIds: ID[]): Record<ID, PanelArt> {
  const out: Record<ID, PanelArt> = {};
  for (const id of panelIds) {
    const art = loadArt(id);
    if (art) {
      out[id] = art;
    }
  }
  return out;
}

export function importArt(arts: Record<ID, PanelArt>): void {
  for (const [id, art] of Object.entries(arts)) {
    saveArt(id, art);
  }
}
