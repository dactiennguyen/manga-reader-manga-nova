import { msg } from '../i18n';
import type { StrokeTone, ToneKind } from '../model/types';
import type { Box } from './artMath';

/**
 * Screentones. A stroke stores the tone it was painted with as numbers (StrokeTone), so the same stroke
 * draws the same on every phone and after an export. A tone preset is only a recipe for those numbers.
 *
 * Old strokes have `{ density }` alone and keep drawing exactly as before: dots TONE_PITCH apart, turned
 * 45 degrees. Everything here clamps what it reads, since a stroke can come from a file or a friend.
 */

/** Old tones: dots this many page units apart, turned this many degrees. */
export const TONE_PITCH = 6;
export const LEGACY_TONE_ANGLE = 45;

export const TONE_KINDS: { id: ToneKind; label: string }[] = [
  { id: 'dots', label: msg('Dots') },
  { id: 'lines', label: msg('Parallel lines') },
  { id: 'cross', label: msg('Cross-hatch') },
  { id: 'noise', label: msg('Sand') },
  { id: 'gradient', label: msg('Gradient') },
];

export const TONE_LIMITS = {
  density: { min: 0.02, max: 0.75 },
  /** Dots, lines and cross-hatch. */
  pitch: { min: 3, max: 24 },
  /** Sand: the size of one grain. */
  grain: { min: 0.4, max: 3 },
  weight: { min: 0.3, max: 12 },
} as const;

/** Sand repeats every this many page units. Large enough not to show on a page 1000 wide. */
export const NOISE_TILE = 48;
/** Upper bound on grains in one sand tile, so a file cannot ask for millions. */
export const NOISE_GRAINS_MAX = 8000;

export type ResolvedTone = {
  kind: ToneKind;
  /** True for a tone stored as `{ density }` only: it draws with the original code. */
  legacy: boolean;
  density: number;
  pitch: number;
  angle: number;
  weight: number;
  density2: number;
  span: [number, number, number, number] | null;
};

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function isToneKind(value: unknown): value is ToneKind {
  'worklet';
  return value === 'dots' || value === 'lines' || value === 'cross' || value === 'noise' || value === 'gradient';
}

/** Angles repeat every 180 degrees for every pattern here. */
export function normalizeAngle(value: number): number {
  'worklet';
  const a = value % 180;
  return a < 0 ? a + 180 : a;
}

/** Every field of a stored tone, filled in and clamped. Cheap: runs whenever a tone is drawn. */
export function resolveTone(tone: StrokeTone): ResolvedTone {
  'worklet';
  const density = clampNum(tone.density, 0, 1, 0.25);
  if (!isToneKind(tone.kind)) {
    return {
      kind: 'dots',
      legacy: true,
      density,
      pitch: TONE_PITCH,
      angle: LEGACY_TONE_ANGLE,
      weight: 0,
      density2: density,
      span: null,
    };
  }
  const kind = tone.kind;
  const grain = kind === 'noise';
  const pitch = grain
    ? clampNum(tone.pitch, TONE_LIMITS.grain.min, TONE_LIMITS.grain.max, 1)
    : clampNum(tone.pitch, TONE_LIMITS.pitch.min, TONE_LIMITS.pitch.max, TONE_PITCH);
  const weight = clampNum(tone.weight, TONE_LIMITS.weight.min, Math.max(TONE_LIMITS.weight.min, pitch * 0.9), pitch * 0.25);
  const span = tone.span;
  const goodSpan =
    Array.isArray(span) && span.length === 4 && span.every(v => typeof v === 'number' && Number.isFinite(v));
  return {
    kind,
    legacy: false,
    density: clampNum(tone.density, 0, TONE_LIMITS.density.max, 0.25),
    pitch,
    angle: normalizeAngle(clampNum(tone.angle, -360, 360, LEGACY_TONE_ANGLE)),
    weight,
    density2: clampNum(tone.density2, 0, TONE_LIMITS.density.max, density),
    span: goodSpan ? [span[0], span[1], span[2], span[3]] : null,
  };
}

/** A tone read from storage, a file or the network, or undefined when it is not one. */
export function normalizeTone(raw: unknown): StrokeTone | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.density !== 'number' || !Number.isFinite(value.density)) {
    return undefined;
  }
  if (!isToneKind(value.kind)) {
    return { density: value.density };
  }
  const r = resolveTone(value as StrokeTone);
  const out: StrokeTone = { density: r.density, kind: r.kind, pitch: r.pitch, angle: r.angle };
  if (r.kind === 'lines' || r.kind === 'cross') {
    out.weight = r.weight;
  }
  if (r.kind === 'gradient') {
    out.density2 = r.density2;
    if (r.span) {
      out.span = r.span;
    }
  }
  return out;
}

/** The radius of one dot so that it inks `density` of its cell. The same rule old tones use. */
export function dotRadius(density: number, pitch: number): number {
  'worklet';
  const d = Math.max(0.01, Math.min(0.75, density));
  return pitch * Math.sqrt(d / Math.PI);
}

/**
 * Where a gradient starts and ends so it crosses the whole box in `direction` degrees: 0 runs left to
 * right, 90 top to bottom.
 */
export function gradientSpan(direction: number, box: Box): [number, number, number, number] {
  'worklet';
  const rad = (direction * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const reach = (Math.abs(ux) * box.w + Math.abs(uy) * box.h) / 2;
  // Adding 0 turns -0 into 0, so the same span always writes the same JSON.
  const r = (v: number) => Math.round(v * 10) / 10 + 0;
  return [r(cx - ux * reach), r(cy - uy * reach), r(cx + ux * reach), r(cy + uy * reach)];
}

/** How far along the gradient a point is, 0 at its start and 1 at its end. Mirrors the shader. */
export function gradientT(span: [number, number, number, number], x: number, y: number): number {
  'worklet';
  const dx = span[2] - span[0];
  const dy = span[3] - span[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) {
    return 0;
  }
  return Math.max(0, Math.min(1, ((x - span[0]) * dx + (y - span[1]) * dy) / len2));
}

export function gradientDensityAt(tone: ResolvedTone, x: number, y: number): number {
  'worklet';
  if (!tone.span) {
    return tone.density;
  }
  const t = gradientT(tone.span, x, y);
  return tone.density + (tone.density2 - tone.density) * t;
}

/** Moves a gradient with its stroke. Every other tone stays fixed to the page, the way old tones do. */
export function mapToneSpan(
  tone: StrokeTone,
  map: (x: number, y: number) => { x: number; y: number },
): StrokeTone {
  'worklet';
  if (!tone.span) {
    return tone;
  }
  const a = map(tone.span[0], tone.span[1]);
  const b = map(tone.span[2], tone.span[3]);
  const r = (v: number) => Math.round(v * 100) / 100;
  return { ...tone, span: [r(a.x), r(a.y), r(b.x), r(b.y)] };
}

/** A gradient laid over the box a lasso fill turned out to cover. Other tones come back as they are. */
export function fitToneToBox(tone: StrokeTone, box: Box | null): StrokeTone {
  'worklet';
  if (tone.kind !== 'gradient' || !tone.span || !box) {
    return tone;
  }
  const dx = tone.span[2] - tone.span[0];
  const dy = tone.span[3] - tone.span[1];
  const direction = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { ...tone, span: gradientSpan(direction, box) };
}

/** The box around x, y pairs, or null for fewer than two points. */
export function pairsBox(points: number[]): Box | null {
  'worklet';
  if (points.length < 4) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxX = Math.max(maxX, points[i]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return { x: minX, y: minY, w: Math.max(0.1, maxX - minX), h: Math.max(0.1, maxY - minY) };
}

/** A prime below 2^26, so the square of anything below it is still an exact whole number. */
const HASH_P = 67108859;

function modP(v: number): number {
  'worklet';
  return ((Math.floor(v) % HASH_P) + HASH_P) % HASH_P;
}

/**
 * A stateless hash of two integers to a number in [0, 1). Squaring steps in whole numbers below 2^53, so
 * the result is exact and the same on every phone, and not a straight line in its inputs.
 */
export function hash01(a: number, b: number): number {
  'worklet';
  let s = (modP(a) * 7919 + modP(b) * 104729 + 12345) % HASH_P;
  s = (s * s + 12347) % HASH_P;
  s = (s * s + 99991) % HASH_P;
  s = (s * s + 7) % HASH_P;
  return s / HASH_P;
}

/**
 * The grains of one sand tile as x, y, r triples. A grain near an edge is listed again on the far side,
 * so the tile repeats without a seam. Random circles cover 1 - e^(-n·πr²/area) of the tile, so the count
 * is chosen for the asked density.
 */
export function noiseGrains(density: number, grain: number, tile = NOISE_TILE, seed = 7): number[] {
  'worklet';
  const d = Math.max(0.01, Math.min(0.75, density));
  const r = Math.max(0.1, grain / 2);
  // Grain radii vary from 0.6r to 1.4r, which averages to about 1.053r².
  const count = Math.min(NOISE_GRAINS_MAX, Math.round((-Math.log(1 - d) * tile * tile) / (Math.PI * r * r * 1.053)));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = hash01(seed, i * 3) * tile;
    const y = hash01(seed, i * 3 + 1) * tile;
    const gr = Math.round(r * (0.6 + hash01(seed, i * 3 + 2) * 0.8) * 100) / 100;
    for (let ox = -tile; ox <= tile; ox += tile) {
      for (let oy = -tile; oy <= tile; oy += tile) {
        const px = x + ox;
        const py = y + oy;
        if (px + gr >= 0 && px - gr <= tile && py + gr >= 0 && py - gr <= tile) {
          out.push(Math.round(px * 100) / 100, Math.round(py * 100) / 100, gr);
        }
      }
    }
  }
  return out;
}

/** A tone recipe the person keeps. Only what its kind uses matters. */
export type TonePreset = {
  id: string;
  name: string;
  kind: ToneKind;
  /** Dots, sand and the start of a gradient. */
  density: number;
  /** Spacing of dots and lines, or the grain size of sand. */
  pitch: number;
  /** Screen angle of dots and lines. */
  angle: number;
  /** Line width of lines and cross-hatch. */
  weight: number;
  /** Gradient: density at the far end. */
  density2: number;
  /** Gradient: 0 runs left to right, 90 top to bottom. */
  direction: number;
  /** The set it is kept in (presets.ts). Built-ins have none. */
  set?: string;
};

const makeTone = (id: string, name: string, kind: ToneKind, more: Partial<TonePreset>): TonePreset => ({
  id,
  name,
  kind,
  density: 0.3,
  pitch: TONE_PITCH,
  angle: LEGACY_TONE_ANGLE,
  weight: 1.2,
  density2: 0.6,
  direction: 90,
  ...more,
});

export const BUILTIN_TONES: TonePreset[] = [
  makeTone('builtin-fine-dots', msg('Fine dots'), 'dots', { density: 0.3, pitch: 4 }),
  makeTone('builtin-coarse-dots', msg('Coarse dots'), 'dots', { density: 0.35, pitch: 10 }),
  makeTone('builtin-lines', msg('Parallel lines'), 'lines', { pitch: 6, weight: 1.4 }),
  makeTone('builtin-cross', msg('Cross-hatch'), 'cross', { pitch: 7, weight: 1.1 }),
  makeTone('builtin-sand', msg('Sand'), 'noise', { density: 0.25, pitch: 0.8 }),
  makeTone('builtin-gradient', msg('Gradient'), 'gradient', { density: 0.04, density2: 0.6, direction: 90 }),
];

export function isBuiltinTone(id: string): boolean {
  return BUILTIN_TONES.some(item => item.id === id);
}

/**
 * The numbers a stroke stores for a preset. A gradient is laid across `box`: the panel for brush tone, the
 * filled area for a lasso fill (see fitToneToBox).
 */
export function toneFromPreset(preset: TonePreset, box: Box): StrokeTone {
  const angle = normalizeAngle(preset.angle);
  switch (preset.kind) {
    case 'lines':
    case 'cross': {
      const pitch = Math.max(TONE_LIMITS.pitch.min, Math.min(TONE_LIMITS.pitch.max, preset.pitch));
      const weight = Math.max(TONE_LIMITS.weight.min, Math.min(pitch * 0.9, preset.weight));
      const share = weight / pitch;
      const density = preset.kind === 'cross' ? share * (2 - share) : share;
      return { density: Math.round(density * 1000) / 1000, kind: preset.kind, pitch, angle, weight };
    }
    case 'noise':
      return { density: preset.density, kind: 'noise', pitch: preset.pitch, angle: 0 };
    case 'gradient':
      return {
        density: preset.density,
        kind: 'gradient',
        pitch: preset.pitch,
        angle,
        density2: preset.density2,
        span: gradientSpan(preset.direction, box),
      };
    default:
      return { density: preset.density, kind: 'dots', pitch: preset.pitch, angle };
  }
}

/** A short line under a tone's name, such as "Dots · 30%". */
export function toneSummaryParts(preset: TonePreset): { kind: string; value: string } {
  const label = TONE_KINDS.find(item => item.id === preset.kind)?.label ?? '';
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  switch (preset.kind) {
    case 'lines':
    case 'cross':
      return { kind: label, value: `${Math.round(preset.pitch * 10) / 10} / ${Math.round(preset.weight * 10) / 10}` };
    case 'gradient':
      return { kind: label, value: `${pct(preset.density)} → ${pct(preset.density2)}` };
    default:
      return { kind: label, value: pct(preset.density) };
  }
}

/** For caching shaders: two tones with the same key draw the same. */
export function toneKey(tone: StrokeTone): string {
  const r = resolveTone(tone);
  return r.legacy
    ? `L${r.density}`
    : `${r.kind}|${r.density}|${r.pitch}|${r.angle}|${r.weight}|${r.density2}|${r.span ? r.span.join(',') : ''}`;
}
