import { msg } from '../i18n';
import type { BrushGrain, Stroke, StrokeBrush, StrokeTool } from '../model/types';

/**
 * Custom brushes. A preset is a recipe the person keeps; each stroke stores the StrokeBrush it was drawn
 * with, so changing or deleting a preset never changes a drawing. Strokes without `brush` draw the way
 * their tool always did. Everything that reads a stored brush clamps it: it may come from a file.
 */

export type BrushBase = 'gpen' | 'pencil' | 'brush';

export const BRUSH_BASES: { id: BrushBase; label: string }[] = [
  { id: 'gpen', label: msg('G-pen') },
  { id: 'pencil', label: msg('Pencil') },
  { id: 'brush', label: msg('Brush') },
];

export const BRUSH_GRAINS: { id: BrushGrain; label: string }[] = [
  { id: 'none', label: msg('None') },
  { id: 'pencil', label: msg('Pencil grain') },
  { id: 'dry', label: msg('Dry brush') },
  { id: 'charcoal', label: msg('Charcoal') },
  { id: 'spatter', label: msg('Ink spatter') },
];

export const BRUSH_SIZE_MIN = 1;
export const BRUSH_SIZE_MAX = 80;
export const TAPER_MAX = 8;
export const PRESET_NAME_MAX = 40;
/** Below this, pressure does not fade the ink and the stroke is one filled outline. */
const FADE_EPSILON = 0.01;
/** At or above this the edge is crisp and no blur is added. */
const HARD_EDGE = 0.98;

export type BrushPreset = {
  id: string;
  name: string;
  base: BrushBase;
  /** The size the brush starts at, and the range its size slider covers. */
  size: number;
  sizeMin: number;
  sizeMax: number;
  opacity: number;
  brush: StrokeBrush;
  /** The set it is kept in (presets.ts). Built-ins have none. */
  set?: string;
};

export const DEFAULT_BRUSH: StrokeBrush = {
  pressureSize: 0.6,
  pressureOpacity: 0,
  hardness: 1,
  taperStart: 1,
  taperEnd: 2,
  smoothing: 0.5,
  grain: 'none',
};

export function isBrushBase(tool: StrokeTool | string): tool is BrushBase {
  'worklet';
  return tool === 'gpen' || tool === 'pencil' || tool === 'brush';
}

function isGrain(value: unknown): value is BrushGrain {
  'worklet';
  return value === 'none' || value === 'pencil' || value === 'dry' || value === 'charcoal' || value === 'spatter';
}

function unit(value: unknown, fallback: number): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function taper(value: unknown, fallback: number): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(TAPER_MAX, value)) : fallback;
}

/** A stored brush with every field present and in range. */
export function resolveBrush(brush: StrokeBrush): StrokeBrush {
  'worklet';
  return {
    pressureSize: unit(brush.pressureSize, DEFAULT_BRUSH.pressureSize),
    pressureOpacity: unit(brush.pressureOpacity, 0),
    hardness: unit(brush.hardness, 1),
    taperStart: taper(brush.taperStart, DEFAULT_BRUSH.taperStart),
    taperEnd: taper(brush.taperEnd, DEFAULT_BRUSH.taperEnd),
    smoothing: unit(brush.smoothing, DEFAULT_BRUSH.smoothing),
    grain: isGrain(brush.grain) ? brush.grain : 'none',
  };
}

/** A brush read from storage, a file or the network, or undefined when it is not one. */
export function normalizeBrush(raw: unknown): StrokeBrush | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const r = resolveBrush(raw as StrokeBrush);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    pressureSize: round(r.pressureSize),
    pressureOpacity: round(r.pressureOpacity),
    hardness: round(r.hardness),
    taperStart: round(r.taperStart),
    taperEnd: round(r.taperEnd),
    smoothing: round(r.smoothing),
    grain: r.grain,
  };
}

/** The brush a stroke draws with, or null for a stroke that draws the original way. */
export function strokeBrush(stroke: Pick<Stroke, 'tool' | 'brush'>): StrokeBrush | null {
  'worklet';
  return stroke.brush && isBrushBase(stroke.tool) ? resolveBrush(stroke.brush) : null;
}

/** A brush that fades with pressure is drawn as overlapping dabs instead of one outline. */
export function usesDabs(brush: StrokeBrush): boolean {
  'worklet';
  return brush.pressureOpacity > FADE_EPSILON;
}

/** perfect-freehand's streamline for a smoothing value. 0.2 is a light touch, 0.95 a heavy stabilizer. */
export function brushStreamline(smoothing: number): number {
  'worklet';
  return 0.2 + Math.max(0, Math.min(1, smoothing)) * 0.75;
}

/** How much pressure narrows the line, as perfect-freehand's thinning. */
export function brushThinning(pressureSize: number): number {
  'worklet';
  return Math.max(0, Math.min(1, pressureSize)) * 0.95;
}

/** The ink's opacity at a pressure from 0 to 1. Full pressure always gives the brush's own opacity. */
export function pressureAlpha(pressure: number, pressureOpacity: number, opacity: number): number {
  'worklet';
  const p = Math.max(0, Math.min(1, pressure));
  return Math.max(0, Math.min(1, opacity * (1 - Math.max(0, Math.min(1, pressureOpacity)) * (1 - p))));
}

/**
 * The alpha of one dab so that `overlap` dabs on top of each other reach `target`: dabs blend over each
 * other, so n of them at alpha a cover 1 - (1 - a)^n.
 */
export function dabAlpha(target: number, overlap: number): number {
  'worklet';
  const t = Math.max(0, Math.min(0.999, target));
  return 1 - Math.pow(1 - t, 1 / Math.max(1, overlap));
}

/** The blur that softens the edge, in page units. Zero for a crisp edge. */
export function edgeSoftness(brush: StrokeBrush, size: number): number {
  'worklet';
  return brush.hardness >= HARD_EDGE ? 0 : (1 - brush.hardness) * size * 0.3;
}

const preset = (
  id: string,
  name: string,
  base: BrushBase,
  sizes: [number, number, number],
  opacity: number,
  brush: Partial<StrokeBrush>,
): BrushPreset => ({
  id,
  name,
  base,
  size: sizes[0],
  sizeMin: sizes[1],
  sizeMax: sizes[2],
  opacity,
  brush: { ...DEFAULT_BRUSH, ...brush },
});

/** Starting points. They cannot be changed, only duplicated, so a drawing can always name them again. */
export const BUILTIN_BRUSHES: BrushPreset[] = [
  preset('builtin-mapping-pen', msg('Mapping pen'), 'gpen', [3, 1, 10], 1, {
    pressureSize: 0.85,
    taperStart: 2,
    taperEnd: 3,
  }),
  preset('builtin-marker', msg('Marker'), 'pencil', [8, 2, 30], 0.85, {
    pressureSize: 0,
    hardness: 0.95,
    taperStart: 0,
    taperEnd: 0,
    smoothing: 0.4,
  }),
  preset('builtin-soft-pencil', msg('Soft pencil'), 'pencil', [4, 1, 16], 0.9, {
    pressureSize: 0.3,
    pressureOpacity: 0.6,
    hardness: 0.85,
    taperStart: 0.5,
    taperEnd: 0.5,
    smoothing: 0.3,
    grain: 'pencil',
  }),
  preset('builtin-sumi', msg('Ink brush'), 'brush', [18, 4, 60], 1, {
    pressureSize: 0.9,
    taperStart: 3,
    taperEnd: 5,
    smoothing: 0.6,
  }),
  preset('builtin-dry-brush', msg('Dry brush'), 'brush', [22, 6, 60], 1, {
    pressureSize: 0.6,
    taperStart: 1,
    taperEnd: 3,
    grain: 'dry',
  }),
  preset('builtin-charcoal', msg('Charcoal'), 'pencil', [10, 3, 40], 0.9, {
    pressureSize: 0.4,
    pressureOpacity: 0.4,
    hardness: 0.75,
    taperStart: 0.5,
    taperEnd: 1,
    smoothing: 0.4,
    grain: 'charcoal',
  }),
  preset('builtin-spatter', msg('Ink spatter'), 'brush', [14, 4, 50], 1, {
    pressureSize: 0.5,
    taperStart: 1,
    taperEnd: 2,
    grain: 'spatter',
  }),
  preset('builtin-airbrush', msg('Airbrush'), 'brush', [30, 8, 80], 0.5, {
    pressureSize: 0.2,
    pressureOpacity: 1,
    hardness: 0,
    taperStart: 0,
    taperEnd: 0,
    smoothing: 0.6,
  }),
];

export function isBuiltinBrush(id: string): boolean {
  return BUILTIN_BRUSHES.some(item => item.id === id);
}

/** A preset with its numbers in range and its size range in order. */
export function normalizeBrushPreset(raw: unknown): BrushPreset | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id || !isBrushBase(String(value.base))) {
    return null;
  }
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  const lo = num(value.sizeMin, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, BRUSH_SIZE_MIN);
  const hi = num(value.sizeMax, lo, BRUSH_SIZE_MAX, Math.max(lo, 40));
  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name.slice(0, PRESET_NAME_MAX) : '',
    base: value.base as BrushBase,
    size: num(value.size, lo, hi, lo),
    sizeMin: lo,
    sizeMax: hi,
    opacity: num(value.opacity, 0.05, 1, 1),
    brush: normalizeBrush(value.brush) ?? { ...DEFAULT_BRUSH },
    ...presetSetField(value.set),
  };
}

/** Max length of a set id. */
export const SET_ID_MAX = 80;

/** The `set` field of a stored preset, or nothing when it has none or a broken one. */
export function presetSetField(raw: unknown): { set?: string } {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= SET_ID_MAX ? { set: raw } : {};
}
