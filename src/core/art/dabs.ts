import type { Stroke, StrokeBrush } from '../model/types';
import { brushStreamline, brushThinning, dabAlpha, pressureAlpha, usesDabs } from './brushes';
import {
  DEFAULT_PRESSURE,
  MIN_STREAMLINE_T,
  STREAMLINE_T_RANGE,
  endTaperEase,
  getStrokeRadius,
  simulatePressure,
  startTaperEase,
  type Easing,
} from './freehand';
import { toolEasing } from './strokes';
import { hash01 } from './tone';

/**
 * Dabs: round stamps laid along a stroke. A brush that fades with pressure is drawn as dabs, since one
 * filled outline can only have one opacity. Ink spatter uses the same walk to drop its droplets.
 *
 * The walk is a running function of the points, so a growing stroke only adds dabs and never moves one.
 * The only thing that changes at the end is the end taper, which shrinks the last dabs as the stroke
 * grows; readers apply it with dabRadius(). Inputs are rounded to 0.01 first, so a stroke read back from
 * its Float32 blob walks exactly like the one in memory, and spatter lands in the same places.
 */

/** Dabs are this share of their diameter apart, so about five overlap at any point. */
export const DAB_SPACING = 0.2;
export const DAB_OVERLAP = 1 / DAB_SPACING;
const MIN_SPACING = 0.35;
/** A very long stroke stops adding dabs here, so one stroke cannot freeze the canvas. */
export const DABS_MAX = 16000;
/** Share of dabs that throw a droplet. */
const SPATTER_RATE = 0.16;

export type DabSpec = {
  size: number;
  thinning: number;
  easing: Easing;
  streamT: number;
  simulate: boolean;
  /** In page units. */
  taperStart: number;
  taperEnd: number;
  pressureOpacity: number;
  opacity: number;
  /** Lay the stroke's own dabs. False when the stroke is an outline and only spatters. */
  body: boolean;
  spatter: boolean;
};

export type DabWalker = {
  spec: DabSpec;
  seed: number;
  /** Numbers of stroke.points already read. */
  fed: number;
  started: boolean;
  x: number;
  y: number;
  p: number;
  running: number;
  carry: number;
  count: number;
  /** x, y, radius with the start taper, alpha and distance along the stroke, per dab. */
  dabs: number[];
  /** x, y, radius and distance along the stroke, per droplet. */
  drops: number[];
};

export const DAB_STRIDE = 5;
export const DROP_STRIDE = 4;

export function dabSpecOf(stroke: Pick<Stroke, 'tool' | 'size' | 'opacity' | 'pressure'>, brush: StrokeBrush): DabSpec {
  'worklet';
  return {
    size: stroke.size,
    thinning: brushThinning(brush.pressureSize),
    easing: toolEasing(stroke.tool, true),
    streamT: MIN_STREAMLINE_T + (1 - brushStreamline(brush.smoothing)) * STREAMLINE_T_RANGE,
    simulate: !stroke.pressure,
    taperStart: stroke.size * brush.taperStart,
    taperEnd: stroke.size * brush.taperEnd,
    pressureOpacity: brush.pressureOpacity,
    opacity: stroke.opacity,
    body: usesDabs(brush),
    spatter: brush.grain === 'spatter',
  };
}

export function createDabWalker(spec: DabSpec): DabWalker {
  'worklet';
  return {
    spec,
    seed: 0,
    fed: 0,
    started: false,
    x: 0,
    y: 0,
    p: DEFAULT_PRESSURE,
    running: 0,
    carry: 0,
    count: 0,
    dabs: [],
    drops: [],
  };
}

function round2(v: number): number {
  'worklet';
  return Math.round(v * 100) / 100;
}

/** Same rule as perfect-freehand: without thinning the width ignores pressure. */
export function dabBaseRadius(spec: DabSpec, pressure: number): number {
  'worklet';
  return spec.thinning ? getStrokeRadius(spec.size, spec.thinning, pressure, spec.easing) : spec.size / 2;
}

function startTaper(spec: DabSpec, at: number): number {
  'worklet';
  return spec.taperStart > 0 && at < spec.taperStart ? startTaperEase(at / spec.taperStart) : 1;
}

function place(w: DabWalker, x: number, y: number, p: number, at: number): void {
  'worklet';
  const s = w.spec;
  const r = Math.max(0.05, dabBaseRadius(s, p) * startTaper(s, at));
  const k = w.count;
  w.count = k + 1;
  if (s.body) {
    w.dabs.push(x, y, r, dabAlpha(pressureAlpha(p, s.pressureOpacity, s.opacity), DAB_OVERLAP), at);
  }
  if (s.spatter && hash01(w.seed, k * 4) < SPATTER_RATE) {
    const angle = hash01(w.seed, k * 4 + 1) * Math.PI * 2;
    const reach = r * (1.3 + hash01(w.seed, k * 4 + 2) * 1.9);
    const dr = Math.max(0.15, r * (0.08 + hash01(w.seed, k * 4 + 3) * 0.22));
    w.drops.push(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, dr, at);
  }
}

function spacingAt(spec: DabSpec, p: number, at: number): number {
  'worklet';
  return Math.max(MIN_SPACING, DAB_SPACING * 2 * dabBaseRadius(spec, p) * startTaper(spec, at));
}

function walkTo(w: DabWalker, nx: number, ny: number, np: number): void {
  'worklet';
  const dx = nx - w.x;
  const dy = ny - w.y;
  const seg = Math.sqrt(dx * dx + dy * dy);
  if (seg > 0) {
    let pos = 0;
    while (w.count < DABS_MAX) {
      const here = w.p + (np - w.p) * (pos / seg);
      const need = Math.max(0, spacingAt(w.spec, here, w.running + pos) - w.carry);
      if (pos + need > seg) {
        w.carry += seg - pos;
        break;
      }
      pos += need;
      w.carry = 0;
      const u = pos / seg;
      place(w, w.x + dx * u, w.y + dy * u, w.p + (np - w.p) * u, w.running + pos);
    }
    w.running += seg;
  }
  w.x = nx;
  w.y = ny;
  w.p = np;
}

/** The seed for a stroke's spatter. Whole units of the first point, which survive the Float32 blob. */
export function dabSeed(x: number, y: number): number {
  'worklet';
  return Math.floor(x) * 7919 + Math.floor(y) * 104729;
}

/** Reads the points not read yet. `step` is 3 with pressure and 2 without. */
export function feedDabs(w: DabWalker, points: number[], step: number): void {
  'worklet';
  const s = w.spec;
  for (let i = w.fed; i + step - 1 < points.length; i += step) {
    const x = round2(points[i]);
    const y = round2(points[i + 1]);
    const pin = step === 3 ? round2(points[i + 2]) : DEFAULT_PRESSURE;
    w.fed = i + step;
    if (!w.started) {
      w.started = true;
      w.seed = dabSeed(x, y);
      w.x = x;
      w.y = y;
      w.p = s.simulate ? DEFAULT_PRESSURE : pin;
      place(w, x, y, w.p, 0);
      continue;
    }
    const sx = w.x + (x - w.x) * s.streamT;
    const sy = w.y + (y - w.y) * s.streamT;
    const np = s.simulate ? simulatePressure(w.p, Math.sqrt((sx - w.x) ** 2 + (sy - w.y) ** 2), s.size) : pin;
    walkTo(w, sx, sy, np);
  }
}

/** A radius with the end taper for the stroke's current length. */
export function dabRadius(w: DabWalker, r: number, at: number): number {
  'worklet';
  const end = w.spec.taperEnd;
  const left = w.running - at;
  return end > 0 && left < end ? r * endTaperEase(Math.max(0, left) / end) : r;
}

/** How many dabs and droplets can no longer change, since they sit before the end taper. */
export function settledDabs(w: DabWalker): { dabs: number; drops: number } {
  'worklet';
  const limit = w.running - w.spec.taperEnd;
  let dabs = Math.floor(w.dabs.length / DAB_STRIDE);
  while (dabs > 0 && w.dabs[(dabs - 1) * DAB_STRIDE + 4] > limit) {
    dabs--;
  }
  let drops = Math.floor(w.drops.length / DROP_STRIDE);
  while (drops > 0 && w.drops[(drops - 1) * DROP_STRIDE + 3] > limit) {
    drops--;
  }
  return { dabs, drops };
}

/** The whole walk for a finished stroke. */
export function walkStroke(stroke: Stroke, brush: StrokeBrush): DabWalker {
  'worklet';
  const w = createDabWalker(dabSpecOf(stroke, brush));
  feedDabs(w, stroke.points, stroke.pressure ? 3 : 2);
  return w;
}
