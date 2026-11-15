import { slugify } from '../util/id';
import { PRESET_NAME_MAX, normalizeBrushPreset, type BrushPreset } from './brushes';
import { PRESETS_MAX, SET_NAME_MAX, normalizeTonePreset, uniqueName, type ArtPresets } from './presets';
import { addToSet, findSet, roomLeft, uniqueSetName, type AddResult, type PresetKind } from './presetSets';
import type { TonePreset } from './tone';

/**
 * A set of brushes and tones as a small file (`.mnbrush`), to share through the share sheet or over Play
 * together. It is JSON with a format name and a version. Everything read from one is checked by the same
 * clean-and-clamp step stored presets go through, so a broken or hostile file cannot reach the drawing code.
 *
 *   { "format": "manganova.brushes", "version": 1, "name": "Inking",
 *     "brushes": [{ name, base, size, sizeMin, sizeMax, opacity, brush }],
 *     "tones": [{ name, kind, density, pitch, angle, weight, density2, direction }] }
 */

export const BRUSH_FILE_EXTENSION = 'mnbrush';
export const BRUSH_FILE_FORMAT = 'manganova.brushes';
export const BRUSH_FILE_VERSION = 1;
/** A full set of 60 brushes and 60 tones is about 40 KB; anything far bigger is not one. */
export const BRUSH_FILE_MAX_CHARS = 256 * 1024;

/** A set read from a file. Ids are only for this file (b0, t0…): importing gives new ones. */
export type BrushFile = { name: string; brushes: BrushPreset[]; tones: TonePreset[] };

export type BrushFileError = 'size' | 'json' | 'format' | 'newer' | 'empty';

export type ParsedBrushFile = { ok: true; file: BrushFile; dropped: number } | { ok: false; reason: BrushFileError };

/** The set as a file, or null for a set that does not exist. `name` is what the set is called on screen. */
export function brushFileForSet(presets: ArtPresets, setId: string, name: string): BrushFile | null {
  if (!findSet(presets, setId)) {
    return null;
  }
  return {
    name: name.trim().slice(0, SET_NAME_MAX),
    brushes: presets.brushes.filter(item => item.set === setId),
    tones: presets.tones.filter(item => item.set === setId),
  };
}

export function serializeBrushFile(file: BrushFile): string {
  return JSON.stringify({
    format: BRUSH_FILE_FORMAT,
    version: BRUSH_FILE_VERSION,
    name: file.name,
    brushes: file.brushes.map(({ name, base, size, sizeMin, sizeMax, opacity, brush }) => ({
      name,
      base,
      size,
      sizeMin,
      sizeMax,
      opacity,
      brush,
    })),
    tones: file.tones.map(({ name, kind, density, pitch, angle, weight, density2, direction }) => ({
      name,
      kind,
      density,
      pitch,
      angle,
      weight,
      density2,
      direction,
    })),
  });
}

/** A file name for the set, such as `inking.mnbrush`. */
export function brushFileName(name: string): string {
  return `${slugify(name, 40)}.${BRUSH_FILE_EXTENSION}`;
}

export function isBrushFileName(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().endsWith(`.${BRUSH_FILE_EXTENSION}`);
}

/** Cheap check on the first bytes of a file opened from outside: a brush file is JSON, a story is a zip. */
export function looksLikeBrushFile(head: string): boolean {
  return /^\s*\{/.test(head);
}

function presetName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, PRESET_NAME_MAX) : '';
}

/**
 * Reads a file. A preset that is not one is dropped and counted; numbers out of range are clamped. A file
 * from a newer app version is refused with its own reason, so the person can be told to update.
 */
export function parseBrushFile(text: string): ParsedBrushFile {
  if (text.length > BRUSH_FILE_MAX_CHARS) {
    return { ok: false, reason: 'size' };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'format' };
  }
  const value = data as Record<string, unknown>;
  if (value.format !== BRUSH_FILE_FORMAT || typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 1) {
    return { ok: false, reason: 'format' };
  }
  if (value.version > BRUSH_FILE_VERSION) {
    return { ok: false, reason: 'newer' };
  }
  const rawBrushes = Array.isArray(value.brushes) ? value.brushes : [];
  const rawTones = Array.isArray(value.tones) ? value.tones : [];
  let dropped = Math.max(0, rawBrushes.length - PRESETS_MAX) + Math.max(0, rawTones.length - PRESETS_MAX);
  const brushes: BrushPreset[] = [];
  rawBrushes.slice(0, PRESETS_MAX).forEach((raw, index) => {
    const name = presetName((raw as { name?: unknown } | null)?.name);
    // The id and set in a file mean nothing on this phone: they are replaced before checking.
    const preset = raw && typeof raw === 'object' ? normalizeBrushPreset({ ...raw, id: `b${index}`, set: undefined, name }) : null;
    if (preset && name) {
      brushes.push(preset);
    } else {
      dropped++;
    }
  });
  const tones: TonePreset[] = [];
  rawTones.slice(0, PRESETS_MAX).forEach((raw, index) => {
    const name = presetName((raw as { name?: unknown } | null)?.name);
    const preset = raw && typeof raw === 'object' ? normalizeTonePreset({ ...raw, id: `t${index}`, set: undefined, name }) : null;
    if (preset && name) {
      tones.push(preset);
    } else {
      dropped++;
    }
  });
  if (!brushes.length && !tones.length) {
    return { ok: false, reason: 'empty' };
  }
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, SET_NAME_MAX) : '';
  return { ok: true, file: { name, brushes, tones }, dropped };
}

/** One preset of an incoming file, as the import screen lists it. */
export type ImportRow = {
  kind: PresetKind;
  /** Its id in the file (b0, t3…). */
  id: string;
  name: string;
  /** A preset of the same kind already has this name. */
  conflict: boolean;
  /** The name it gets when imported: the same, or "Name (2)" when taken. */
  finalName: string;
};

export type ImportPlan = {
  rows: ImportRow[];
  room: { brushes: number; tones: number; sets: number };
};

/**
 * What importing would do, for the preview. Names are worked out for the chosen presets in file order,
 * the same way the import does it, so the preview shows the names the presets will really get.
 */
export function planImport(presets: ArtPresets, file: BrushFile, chosen: ReadonlySet<string>): ImportPlan {
  const rowsFor = (kind: PresetKind, items: { id: string; name: string }[], existing: string[]): ImportRow[] => {
    const owned = new Set(existing);
    const taken = [...existing];
    return items.map(item => {
      const conflict = owned.has(item.name);
      if (!chosen.has(item.id)) {
        return { kind, id: item.id, name: item.name, conflict, finalName: item.name };
      }
      const finalName = uniqueName(item.name, taken);
      taken.push(finalName);
      return { kind, id: item.id, name: item.name, conflict, finalName };
    });
  };
  return {
    rows: [
      ...rowsFor(
        'brush',
        file.brushes,
        presets.brushes.map(item => item.name),
      ),
      ...rowsFor(
        'tone',
        file.tones,
        presets.tones.map(item => item.name),
      ),
    ],
    room: roomLeft(presets),
  };
}

/** Where imported presets go: a new set (named after the file unless the person changed it) or one that exists. */
export type ImportTarget = { setId: string } | { newSet: { id: string; name: string } };

export type ImportResult = AddResult | { ok: false; reason: 'sets'; room: { brushes: number; tones: number } };

/**
 * Imports the chosen presets with new ids into the target set. Existing presets are never overwritten; a
 * taken name gets a number. Nothing is imported when it does not all fit.
 */
export function importBrushFile(
  presets: ArtPresets,
  file: BrushFile,
  chosen: ReadonlySet<string>,
  target: ImportTarget,
  newId: () => string,
  labelOf?: Parameters<typeof uniqueSetName>[2],
): ImportResult {
  const incoming = {
    brushes: file.brushes.filter(item => chosen.has(item.id)),
    tones: file.tones.filter(item => chosen.has(item.id)),
  };
  let base = presets;
  let setId: string;
  if ('newSet' in target) {
    const room = roomLeft(presets);
    if (!room.sets) {
      return { ok: false, reason: 'sets', room: { brushes: room.brushes, tones: room.tones } };
    }
    setId = target.newSet.id;
    const name = uniqueSetName(presets, target.newSet.name.trim() || file.name || 'Set', labelOf);
    base = { ...presets, sets: [...presets.sets, { id: setId, name }] };
  } else {
    setId = target.setId;
  }
  const result = addToSet(base, incoming, setId, newId);
  // The new set is only kept when the presets went in.
  return result.ok ? result : { ...result, room: { brushes: roomLeft(presets).brushes, tones: roomLeft(presets).tones } };
}
