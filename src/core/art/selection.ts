import type { Stroke } from '../model/types';
import { affineScale, applyAffine, keepsAxes, type Affine } from './affine';
import { layerBounds, shapeBox, strokeStep, type Box } from './artMath';

/**
 * Picking strokes with a lasso and writing a transform into them. A stroke is selected when more than half
 * of its sample points lie inside the lasso. Polygons and samples are flat lists of x, y pairs.
 */

/** Points along a straight line, and around a rectangle or ellipse, that stand in for the shape. */
const LINE_SAMPLES = 9;
const EDGE_SAMPLES = 4;
const ELLIPSE_SAMPLES = 16;
/** Points on the outline a turned ellipse becomes. The smoothed path stays within 0.1% of the radius. */
const ELLIPSE_POINTS = 64;
/** The canvas draws each run as its own picture on every drag frame, so the count is capped. */
export const SELECTION_RUNS_MAX = 128;

export type SelectionRun = { moving: boolean; indices: number[] };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Even-odd test. The polygon closes itself from its last point to its first. */
export function pointInPolygon(poly: number[], x: number, y: number): boolean {
  let inside = false;
  const n = Math.floor(poly.length / 2);
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = poly[i * 2];
    const ay = poly[i * 2 + 1];
    const bx = poly[j * 2];
    const by = poly[j * 2 + 1];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

/** The points that decide whether a stroke is inside a lasso. Pressure values are left out. */
export function strokeSamples(stroke: Stroke): number[] {
  const { points } = stroke;
  const out: number[] = [];
  if (stroke.tool === 'line' || stroke.tool === 'rect' || stroke.tool === 'ellipse') {
    if (points.length < 4) {
      return points.slice(0, 2);
    }
    const [x0, y0, x1, y1] = points;
    if (stroke.tool === 'line') {
      for (let i = 0; i < LINE_SAMPLES; i++) {
        const k = i / (LINE_SAMPLES - 1);
        out.push(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      }
    } else if (stroke.tool === 'rect') {
      const corners = [x0, y0, x1, y0, x1, y1, x0, y1];
      for (let side = 0; side < 4; side++) {
        const ax = corners[side * 2];
        const ay = corners[side * 2 + 1];
        const bx = corners[((side + 1) % 4) * 2];
        const by = corners[((side + 1) % 4) * 2 + 1];
        for (let i = 0; i < EDGE_SAMPLES; i++) {
          const k = i / EDGE_SAMPLES;
          out.push(ax + (bx - ax) * k, ay + (by - ay) * k);
        }
      }
    } else {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      for (let i = 0; i < ELLIPSE_SAMPLES; i++) {
        const angle = (i / ELLIPSE_SAMPLES) * Math.PI * 2;
        out.push(cx + (Math.cos(angle) * (x1 - x0)) / 2, cy + (Math.sin(angle) * (y1 - y0)) / 2);
      }
    }
    return out;
  }
  const step = strokeStep(stroke);
  for (let i = 0; i + 1 < points.length; i += step) {
    out.push(points[i], points[i + 1]);
  }
  return out;
}

/** The selection rule: strictly more than half of the stroke's sample points are inside the lasso. */
export function isInsideLasso(stroke: Stroke, lasso: number[]): boolean {
  if (lasso.length < 6) {
    return false;
  }
  const samples = strokeSamples(stroke);
  const total = samples.length / 2;
  let inside = 0;
  for (let i = 0; i < total; i++) {
    if (pointInPolygon(lasso, samples[i * 2], samples[i * 2 + 1])) {
      inside++;
    }
  }
  return total > 0 && inside * 2 > total;
}

/** Indices of the selected strokes, in drawing order. Eraser strokes follow the same rule as ink. */
export function pickStrokes(strokes: Stroke[], lasso: number[]): number[] {
  const out: number[] = [];
  strokes.forEach((stroke, index) => {
    if (isInsideLasso(stroke, lasso)) {
      out.push(index);
    }
  });
  return out;
}

/** The box around the selected ink, or null when nothing drawn is selected. Eraser strokes add no size. */
export function selectionBounds(strokes: Stroke[], indices: number[]): Box | null {
  const box = layerBounds({ strokes: indices.map(index => strokes[index]).filter(Boolean) });
  return box ? { x: box.x, y: box.y, w: Math.max(1, box.w), h: Math.max(1, box.h) } : null;
}

function mapPairs(points: number[], m: Affine): number[] {
  const out = new Array<number>(points.length);
  for (let i = 0; i + 1 < points.length; i += 2) {
    const p = applyAffine(m, points[i], points[i + 1]);
    out[i] = round2(p.x);
    out[i + 1] = round2(p.y);
  }
  return out;
}

/**
 * The area a rectangle stroke covers, as one closed polygon: the outer edge, then the inner edge the other
 * way round. Every corner is listed twice, because the fill path rounds single points into curves. The two
 * passes between the edges run along the same segment and cancel.
 */
export function rectRing(stroke: Pick<Stroke, 'points' | 'size'>): number[] {
  const box = shapeBox(stroke.points);
  if (!box) {
    return [];
  }
  const half = stroke.size / 2;
  const corners = (x: number, y: number, w: number, h: number, reverse: boolean) => {
    const list = [x, y, x + w, y, x + w, y + h, x, y + h];
    const order = reverse ? [0, 3, 2, 1, 0] : [0, 1, 2, 3, 0];
    const out: number[] = [];
    order.forEach(index => out.push(list[index * 2], list[index * 2 + 1], list[index * 2], list[index * 2 + 1]));
    return out;
  };
  const outer = corners(box.x - half, box.y - half, box.w + stroke.size, box.h + stroke.size, false);
  if (box.w <= stroke.size || box.h <= stroke.size) {
    return outer.slice(0, 16);
  }
  return [...outer, ...corners(box.x + half, box.y + half, box.w - stroke.size, box.h - stroke.size, true)];
}

/**
 * An ellipse stroke as the centre line of a freehand stroke. It starts and ends half way along an edge, and
 * the points sit a little outside the ellipse, because the path that joins them cuts the corners.
 */
export function ellipseOutline(stroke: Pick<Stroke, 'points'>): number[] {
  const box = shapeBox(stroke.points);
  if (!box) {
    return [];
  }
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const grow = 1 / Math.cos(Math.PI / ELLIPSE_POINTS);
  const rx = (Math.max(0.01, box.w) / 2) * grow;
  const ry = (Math.max(0.01, box.h) / 2) * grow;
  const ring: number[] = [];
  for (let i = 0; i < ELLIPSE_POINTS; i++) {
    const angle = (i / ELLIPSE_POINTS) * Math.PI * 2;
    ring.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
  }
  const last = ring.length - 2;
  const seamX = (ring[last] + ring[0]) / 2;
  const seamY = (ring[last + 1] + ring[1]) / 2;
  return [seamX, seamY, ...ring, seamX, seamY];
}

/**
 * Writes an affine map into a stroke. Pressure and tone are kept, and the width follows the scale. A line
 * maps exactly. A rectangle or ellipse stays one while it stays level; turned, it has no two corners that
 * describe it, so the rectangle becomes a filled ring and the ellipse a freehand outline of the same shape.
 */
export function transformStrokeAffine(stroke: Stroke, m: Affine): Stroke {
  const size = Math.max(0.1, round2(stroke.size * affineScale(m)));
  if ((stroke.tool === 'rect' || stroke.tool === 'ellipse') && stroke.points.length >= 4 && !keepsAxes(m)) {
    // Neither result has pressure values in its points.
    const rest: Stroke = { ...stroke };
    delete rest.pressure;
    return stroke.tool === 'rect'
      ? { ...rest, tool: 'fill', size, points: mapPairs(rectRing(stroke), m) }
      : { ...rest, tool: 'pencil', size, points: mapPairs(ellipseOutline(stroke), m) };
  }
  const step = strokeStep(stroke);
  const points = stroke.points.slice();
  for (let i = 0; i + 1 < points.length; i += step) {
    const p = applyAffine(m, points[i], points[i + 1]);
    points[i] = round2(p.x);
    points[i + 1] = round2(p.y);
  }
  return { ...stroke, points, size };
}

/** The layer's strokes with the transform written into the selected ones. Order and count do not change. */
export function transformSelected(strokes: Stroke[], indices: number[], m: Affine): Stroke[] {
  const picked = new Set(indices);
  return strokes.map((stroke, index) => (picked.has(index) ? transformStrokeAffine(stroke, m) : stroke));
}

export function removeSelected(strokes: Stroke[], indices: number[]): Stroke[] {
  const picked = new Set(indices);
  return strokes.filter((_, index) => !picked.has(index));
}

/**
 * Splits a layer into stretches of selected and unselected strokes, in drawing order, so the preview keeps
 * every stroke and eraser where it belongs. Past `maxRuns` the rest is folded into two last runs, with the
 * selected strokes on top: only the preview loses the exact order then, never the stored result.
 */
export function selectionRuns(count: number, indices: number[], maxRuns = SELECTION_RUNS_MAX): SelectionRun[] {
  const picked = new Set(indices);
  const runs: SelectionRun[] = [];
  for (let index = 0; index < count; index++) {
    const moving = picked.has(index);
    const last = runs[runs.length - 1];
    if (last && last.moving === moving) {
      last.indices.push(index);
    } else {
      runs.push({ moving, indices: [index] });
    }
  }
  const limit = Math.max(2, maxRuns);
  if (runs.length <= limit) {
    return runs;
  }
  const kept = runs.slice(0, limit - 2);
  const rest = runs.slice(limit - 2);
  const still = rest.filter(run => !run.moving).flatMap(run => run.indices);
  const moved = rest.filter(run => run.moving).flatMap(run => run.indices);
  return [...kept, { moving: false, indices: still }, { moving: true, indices: moved }];
}
