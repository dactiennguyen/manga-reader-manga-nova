import type { PanelArt, Stroke, StrokeBrush, StrokeTone, StrokeTool } from '../model/types';
import type { Box } from './artMath';
import {
  BUILTIN_BRUSHES,
  PRESET_NAME_MAX,
  isBrushBase,
  normalizeBrush,
  normalizeBrushPreset,
  type BrushBase,
  type BrushPreset,
} from './brushes';
import { BUILTIN_TONES, TONE_LIMITS, normalizeAngle, normalizeTone, toneFromPreset, type TonePreset } from './tone';

/**
 * The person's own brushes and tones. They belong to the app, not to a story, and are kept in the meta
 * table as one JSON record. Built-in presets live in code and are never stored. Drawings never point at
 * a preset: each stroke keeps its own numbers.
 */

export type ArtPresets = {
  /** In the order the person put them. */
  brushes: BrushPreset[];
  tones: TonePreset[];
  /** The brush each tool draws with. Missing means the tool's own way of drawing. */
  active: Partial<Record<BrushBase, string>>;
};

export const EMPTY_PRESETS: ArtPresets = { brushes: [], tones: [], active: {} };

export const PRESETS_MAX = 60;

/** Tone ids for the four densities the app always had. They store `{ density }` like old strokes. */
export const LEGACY_TONE_PREFIX = 'density:';

export function legacyToneId(density: number): string {
  return `${LEGACY_TONE_PREFIX}${density}`;
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}

export function normalizeTonePreset(raw: unknown): TonePreset | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const v = raw as Record<string, unknown>;
  const kinds = ['dots', 'lines', 'cross', 'noise', 'gradient'];
  if (typeof v.id !== 'string' || !v.id || typeof v.kind !== 'string' || !kinds.includes(v.kind)) {
    return null;
  }
  const kind = v.kind as TonePreset['kind'];
  const grain = kind === 'noise';
  const pitch = grain
    ? num(v.pitch, TONE_LIMITS.grain.min, TONE_LIMITS.grain.max, 1)
    : num(v.pitch, TONE_LIMITS.pitch.min, TONE_LIMITS.pitch.max, 6);
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name.slice(0, PRESET_NAME_MAX) : '',
    kind,
    // A gradient may start from blank paper; a flat tone of nothing would be pointless.
    density: num(v.density, kind === 'gradient' ? 0 : TONE_LIMITS.density.min, TONE_LIMITS.density.max, 0.3),
    pitch,
    angle: normalizeAngle(num(v.angle, -360, 360, 45)),
    weight: num(v.weight, TONE_LIMITS.weight.min, Math.max(TONE_LIMITS.weight.min, pitch * 0.9), 1.2),
    density2: num(v.density2, 0, TONE_LIMITS.density.max, 0.6),
    direction: num(v.direction, -360, 360, 90),
  };
}

/** Reads the stored record. Anything broken is dropped rather than failing the app. */
export function parsePresets(json: string | null | undefined): ArtPresets {
  if (!json) {
    return EMPTY_PRESETS;
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return EMPTY_PRESETS;
  }
  if (!data || typeof data !== 'object') {
    return EMPTY_PRESETS;
  }
  const value = data as Record<string, unknown>;
  const seen = new Set<string>();
  const unique = <T extends { id: string }>(item: T | null): item is T => {
    if (!item || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  };
  const brushes = (Array.isArray(value.brushes) ? value.brushes : [])
    .map(normalizeBrushPreset)
    .filter(unique)
    .slice(0, PRESETS_MAX);
  const tones = (Array.isArray(value.tones) ? value.tones : []).map(normalizeTonePreset).filter(unique).slice(0, PRESETS_MAX);
  const active: ArtPresets['active'] = {};
  const rawActive = value.active && typeof value.active === 'object' ? (value.active as Record<string, unknown>) : {};
  for (const [base, id] of Object.entries(rawActive)) {
    if (isBrushBase(base) && typeof id === 'string' && findBrush({ brushes, tones, active: {} }, id)?.base === base) {
      active[base] = id;
    }
  }
  return { brushes, tones, active };
}

export function serializePresets(presets: ArtPresets): string {
  return JSON.stringify({ version: 1, ...presets });
}

export function findBrush(presets: ArtPresets, id: string | undefined): BrushPreset | undefined {
  if (!id) {
    return undefined;
  }
  return presets.brushes.find(item => item.id === id) ?? BUILTIN_BRUSHES.find(item => item.id === id);
}

export function findTone(presets: ArtPresets, id: string | null | undefined): TonePreset | undefined {
  if (!id) {
    return undefined;
  }
  return presets.tones.find(item => item.id === id) ?? BUILTIN_TONES.find(item => item.id === id);
}

/** "Name", or "Name (2)" and up when the name is taken. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const names = new Set(taken);
  const base = name.trim().slice(0, PRESET_NAME_MAX - 5) || name;
  if (!names.has(base)) {
    return base;
  }
  let n = 2;
  while (names.has(`${base} (${n})`)) {
    n++;
  }
  return `${base} (${n})`;
}

function cleanName(name: string): string {
  return name.trim().slice(0, PRESET_NAME_MAX);
}

/** Adds a copy of any preset, built-in or not, right after the original when it is the person's own. */
export function duplicateBrush(presets: ArtPresets, source: BrushPreset, id: string, name: string): ArtPresets {
  if (presets.brushes.length >= PRESETS_MAX) {
    return presets;
  }
  const copy: BrushPreset = { ...source, brush: { ...source.brush }, id, name: uniqueName(name, presets.brushes.map(b => b.name)) };
  const at = presets.brushes.findIndex(item => item.id === source.id);
  const brushes = [...presets.brushes];
  brushes.splice(at < 0 ? brushes.length : at + 1, 0, copy);
  return { ...presets, brushes };
}

export function saveBrush(presets: ArtPresets, preset: BrushPreset): ArtPresets {
  const clean = normalizeBrushPreset({ ...preset, name: cleanName(preset.name) });
  if (!clean) {
    return presets;
  }
  const exists = presets.brushes.some(item => item.id === clean.id);
  if (!exists && presets.brushes.length >= PRESETS_MAX) {
    return presets;
  }
  const brushes = exists
    ? presets.brushes.map(item => (item.id === clean.id ? clean : item))
    : [...presets.brushes, clean];
  // A brush moved to another tool stops being that old tool's choice.
  const active = { ...presets.active };
  for (const base of Object.keys(active) as BrushBase[]) {
    if (active[base] === clean.id && clean.base !== base) {
      delete active[base];
    }
  }
  return { ...presets, brushes, active };
}

export function renameBrush(presets: ArtPresets, id: string, name: string): ArtPresets {
  const clean = cleanName(name);
  if (!clean) {
    return presets;
  }
  return { ...presets, brushes: presets.brushes.map(item => (item.id === id ? { ...item, name: clean } : item)) };
}

export function removeBrush(presets: ArtPresets, id: string): ArtPresets {
  const active = { ...presets.active };
  for (const base of Object.keys(active) as BrushBase[]) {
    if (active[base] === id) {
      delete active[base];
    }
  }
  return { ...presets, brushes: presets.brushes.filter(item => item.id !== id), active };
}

function move<T extends { id: string }>(list: T[], id: string, delta: number): T[] {
  const from = list.findIndex(item => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function moveBrush(presets: ArtPresets, id: string, delta: number): ArtPresets {
  const brushes = move(presets.brushes, id, delta);
  return brushes === presets.brushes ? presets : { ...presets, brushes };
}

/** Chooses the brush a tool draws with. Null goes back to the tool's own. */
export function chooseBrush(presets: ArtPresets, base: BrushBase, id: string | null): ArtPresets {
  const active = { ...presets.active };
  const found = id ? findBrush(presets, id) : undefined;
  if (found && found.base === base) {
    active[base] = found.id;
  } else {
    delete active[base];
  }
  return { ...presets, active };
}

export function activeBrush(presets: ArtPresets, base: BrushBase): BrushPreset | undefined {
  const found = findBrush(presets, presets.active[base]);
  return found && found.base === base ? found : undefined;
}

export function duplicateTone(presets: ArtPresets, source: TonePreset, id: string, name: string): ArtPresets {
  if (presets.tones.length >= PRESETS_MAX) {
    return presets;
  }
  const copy: TonePreset = { ...source, id, name: uniqueName(name, presets.tones.map(item => item.name)) };
  const at = presets.tones.findIndex(item => item.id === source.id);
  const tones = [...presets.tones];
  tones.splice(at < 0 ? tones.length : at + 1, 0, copy);
  return { ...presets, tones };
}

export function saveTone(presets: ArtPresets, preset: TonePreset): ArtPresets {
  const clean = normalizeTonePreset({ ...preset, name: cleanName(preset.name) });
  if (!clean) {
    return presets;
  }
  const exists = presets.tones.some(item => item.id === clean.id);
  if (!exists && presets.tones.length >= PRESETS_MAX) {
    return presets;
  }
  return {
    ...presets,
    tones: exists ? presets.tones.map(item => (item.id === clean.id ? clean : item)) : [...presets.tones, clean],
  };
}

export function renameTone(presets: ArtPresets, id: string, name: string): ArtPresets {
  const clean = cleanName(name);
  if (!clean) {
    return presets;
  }
  return { ...presets, tones: presets.tones.map(item => (item.id === id ? { ...item, name: clean } : item)) };
}

export function removeTone(presets: ArtPresets, id: string): ArtPresets {
  return { ...presets, tones: presets.tones.filter(item => item.id !== id) };
}

export function moveTone(presets: ArtPresets, id: string, delta: number): ArtPresets {
  const tones = move(presets.tones, id, delta);
  return tones === presets.tones ? presets : { ...presets, tones };
}

/**
 * What a stroke stores for the chosen tone: null for solid, `{ density }` for the four original chips,
 * or the preset's numbers. A deleted preset paints solid rather than guessing.
 */
export function toneForChoice(presets: ArtPresets, choice: string | null, box: Box): StrokeTone | null {
  if (!choice) {
    return null;
  }
  if (choice.startsWith(LEGACY_TONE_PREFIX)) {
    const density = Number(choice.slice(LEGACY_TONE_PREFIX.length));
    return Number.isFinite(density) ? { density } : null;
  }
  const preset = findTone(presets, choice);
  return preset ? toneFromPreset(preset, box) : null;
}

/**
 * A stroke from a file or a friend with its tone and brush checked: a broken one is dropped, a value out
 * of range is clamped. An old stroke comes back unchanged.
 */
export function cleanStroke(stroke: Stroke): Stroke {
  const oldTone = stroke.tone === undefined || (stroke.tone.kind === undefined && normalizeTone(stroke.tone) !== undefined);
  if (stroke.brush === undefined && oldTone) {
    return stroke;
  }
  const out: Stroke = { ...stroke };
  delete out.tone;
  delete out.brush;
  const tone = stroke.tone === undefined ? undefined : normalizeTone(stroke.tone);
  const brush = stroke.brush === undefined ? undefined : normalizeBrush(stroke.brush);
  if (tone) {
    out.tone = tone.kind ? tone : stroke.tone;
  }
  if (brush) {
    out.brush = brush;
  }
  return out;
}

export function cleanArt(art: PanelArt): PanelArt {
  return { ...art, layers: art.layers.map(layer => ({ ...layer, strokes: layer.strokes.map(cleanStroke) })) };
}

const SAMPLE_POINTS = 48;

/**
 * A wave across the box with pressure rising and falling, so a preview shows width, fade and taper. The
 * preview draws it with the canvas's own code, so it cannot drift from what a stroke will look like.
 */
export function sampleStroke(
  tool: StrokeTool,
  box: Box,
  color: string,
  size: number,
  opacity: number,
  brush?: StrokeBrush,
): Stroke {
  const points: number[] = [];
  for (let i = 0; i < SAMPLE_POINTS; i++) {
    const t = i / (SAMPLE_POINTS - 1);
    const x = box.x + box.w * (0.06 + 0.88 * t);
    const y = box.y + box.h * (0.5 - 0.26 * Math.sin(t * Math.PI * 2));
    const pressure = 0.15 + 0.85 * Math.sin(t * Math.PI);
    points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pressure * 100) / 100);
  }
  const stroke: Stroke = { tool, color, size, opacity, points, pressure: true };
  if (brush) {
    stroke.brush = brush;
  }
  return stroke;
}

/** A lasso fill over the box, with enough points on each side that the smoothed edge stays square. */
export function sampleFill(box: Box, color: string, tone: StrokeTone | null): Stroke {
  const points: number[] = [];
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ];
  const steps = 12;
  for (let side = 0; side < 4; side++) {
    const [ax, ay] = corners[side];
    const [bx, by] = corners[(side + 1) % 4];
    for (let i = 0; i < steps; i++) {
      points.push(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
    }
  }
  const stroke: Stroke = { tool: 'fill', color, size: 1, opacity: 1, points };
  if (tone) {
    stroke.tone = tone;
  }
  return stroke;
}
