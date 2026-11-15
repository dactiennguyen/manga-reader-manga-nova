import type { BrushBase, BrushPreset } from './brushes';
import { DEFAULT_SET_ID, PRESETS_MAX, SETS_MAX, SET_NAME_MAX, inKnownSet, uniqueName, type ArtPresets, type PresetSet } from './presets';
import type { TonePreset } from './tone';

/**
 * Sets of brushes and tones: the "My brushes and tones" library. Each preset is in exactly one set; the
 * default set always exists and cannot be deleted. Every change here is pure and returns the same object
 * when nothing changed, so the store does not save for nothing.
 */

export type PresetKind = 'brush' | 'tone';

export type SetContents = { brushes: BrushPreset[]; tones: TonePreset[] };

export function findSet(presets: ArtPresets, id: string): PresetSet | undefined {
  return presets.sets.find(set => set.id === id);
}

export function setContents(presets: ArtPresets, setId: string): SetContents {
  return {
    brushes: presets.brushes.filter(item => item.set === setId),
    tones: presets.tones.filter(item => item.set === setId),
  };
}

/** Room left under the limits: how many more brushes, tones and sets can be kept. */
export function roomLeft(presets: ArtPresets): { brushes: number; tones: number; sets: number } {
  return {
    brushes: Math.max(0, PRESETS_MAX - presets.brushes.length),
    tones: Math.max(0, PRESETS_MAX - presets.tones.length),
    sets: Math.max(0, SETS_MAX - presets.sets.length),
  };
}

function cleanSetName(name: string): string {
  return name.trim().slice(0, SET_NAME_MAX);
}

/** A set name not used by another set; `labelOf` turns the default set's empty name into what is shown. */
export function uniqueSetName(presets: ArtPresets, name: string, labelOf: (set: PresetSet) => string = set => set.name): string {
  return uniqueName(cleanSetName(name), presets.sets.map(labelOf)).slice(0, SET_NAME_MAX);
}

/** A new empty set at the end. Nothing changes at the limit or without a name. */
export function addSet(presets: ArtPresets, id: string, name: string): ArtPresets {
  const clean = cleanSetName(name);
  if (!clean || presets.sets.length >= SETS_MAX || findSet(presets, id)) {
    return presets;
  }
  return { ...presets, sets: [...presets.sets, { id, name: clean }] };
}

export function renameSet(presets: ArtPresets, id: string, name: string): ArtPresets {
  const clean = cleanSetName(name);
  const set = findSet(presets, id);
  if (!clean || !set || set.name === clean) {
    return presets;
  }
  return { ...presets, sets: presets.sets.map(item => (item.id === id ? { ...item, name: clean } : item)) };
}

/**
 * Deletes a set and every preset in it, the way deleting a folder does. The default set stays. Drawings
 * keep their look, since strokes store their own numbers.
 */
export function removeSet(presets: ArtPresets, id: string): ArtPresets {
  if (id === DEFAULT_SET_ID || !findSet(presets, id)) {
    return presets;
  }
  const brushes = presets.brushes.filter(item => item.set !== id);
  const kept = new Set(brushes.map(item => item.id));
  const active: ArtPresets['active'] = {};
  for (const [base, choice] of Object.entries(presets.active) as [BrushBase, string][]) {
    // A built-in choice is not in the list, so only the person's own deleted brushes are dropped.
    if (kept.has(choice) || !presets.brushes.some(item => item.id === choice)) {
      active[base] = choice;
    }
  }
  return {
    ...presets,
    sets: presets.sets.filter(set => set.id !== id),
    brushes,
    tones: presets.tones.filter(item => item.set !== id),
    active,
  };
}

export function moveSet(presets: ArtPresets, id: string, delta: number): ArtPresets {
  const from = presets.sets.findIndex(set => set.id === id);
  const to = from + delta;
  if (from < 0 || delta === 0 || to < 0 || to >= presets.sets.length) {
    return presets;
  }
  const sets = [...presets.sets];
  const [set] = sets.splice(from, 1);
  sets.splice(to, 0, set);
  return { ...presets, sets };
}

/** Puts a preset into another set, as the last one there. */
export function moveToSet(presets: ArtPresets, kind: PresetKind, id: string, setId: string): ArtPresets {
  if (!findSet(presets, setId)) {
    return presets;
  }
  const shift = <T extends { id: string; set?: string }>(list: T[]): T[] => {
    const item = list.find(entry => entry.id === id);
    if (!item || item.set === setId) {
      return list;
    }
    return [...list.filter(entry => entry.id !== id), { ...item, set: setId }];
  };
  if (kind === 'brush') {
    const brushes = shift(presets.brushes);
    return brushes === presets.brushes ? presets : { ...presets, brushes };
  }
  const tones = shift(presets.tones);
  return tones === presets.tones ? presets : { ...presets, tones };
}

export type AddResult =
  | { ok: true; presets: ArtPresets; added: { brushes: number; tones: number } }
  | { ok: false; reason: 'full' | 'nothing'; room: { brushes: number; tones: number } };

/**
 * Adds copies of presets to a set with new ids, never touching an existing preset. A name already taken
 * gets " (2)" and up. All or nothing: when they do not fit under the limits, nothing is added and the
 * result says how much room is left.
 */
export function addToSet(presets: ArtPresets, incoming: SetContents, setId: string, newId: () => string): AddResult {
  const left = roomLeft(presets);
  const room = { brushes: left.brushes, tones: left.tones };
  if (!incoming.brushes.length && !incoming.tones.length) {
    return { ok: false, reason: 'nothing', room };
  }
  if (incoming.brushes.length > room.brushes || incoming.tones.length > room.tones || !findSet(presets, setId)) {
    return { ok: false, reason: 'full', room };
  }
  const brushNames = presets.brushes.map(item => item.name);
  const toneNames = presets.tones.map(item => item.name);
  const brushes = incoming.brushes.map(source => {
    const name = uniqueName(source.name, brushNames);
    brushNames.push(name);
    return inKnownSet(presets.sets, { ...source, brush: { ...source.brush }, id: newId(), name, set: setId });
  });
  const tones = incoming.tones.map(source => {
    const name = uniqueName(source.name, toneNames);
    toneNames.push(name);
    return inKnownSet(presets.sets, { ...source, id: newId(), name, set: setId });
  });
  return {
    ok: true,
    presets: { ...presets, brushes: [...presets.brushes, ...brushes], tones: [...presets.tones, ...tones] },
    added: { brushes: brushes.length, tones: tones.length },
  };
}

/** Lower case without accents, so "inking" finds "Inking" and "but" finds "Bút". */
export function searchKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}

export function matchesSearch(name: string, query: string): boolean {
  const q = searchKey(query);
  return !q || searchKey(name).includes(q);
}
