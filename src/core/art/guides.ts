import { msg } from '../i18n';
import type { Stroke } from '../model/types';
import { isFillTool, isShapeTool, type Box } from './artMath';

/**
 * Rulers for the canvas. Symmetry repeats a stroke across a vertical axis. Perspective bends a stroke onto
 * the line it started along: towards a vanishing point, or level or upright. Everything here runs on the UI
 * thread, so each function is a worklet declared before it is used.
 */

export type Point = { x: number; y: number };

export type GuideKind = 'symmetry' | 'onePoint' | 'twoPoint';

export type Guide =
  | { kind: 'symmetry'; x: number }
  | { kind: 'onePoint'; a: Point }
  | { kind: 'twoPoint'; a: Point; b: Point };

export const GUIDES: { id: GuideKind; label: string; hint: string }[] = [
  { id: 'symmetry', label: msg('Symmetry'), hint: msg('Each stroke repeats across the line. Drag the dot to move it.') },
  { id: 'onePoint', label: msg('1-point perspective'), hint: msg('Strokes run to the vanishing point. Drag the dot to move it.') },
  { id: 'twoPoint', label: msg('2-point perspective'), hint: msg('Strokes run to either point, or straight up. Drag a dot to move it.') },
];

const HORIZON = 0.4;
const EDGE = 0.04;

export function defaultGuide(kind: GuideKind, bbox: Box): Guide {
  'worklet';
  const y = bbox.y + bbox.h * HORIZON;
  if (kind === 'symmetry') {
    return { kind, x: bbox.x + bbox.w / 2 };
  }
  if (kind === 'onePoint') {
    return { kind, a: { x: bbox.x + bbox.w / 2, y } };
  }
  return { kind, a: { x: bbox.x + bbox.w * EDGE, y }, b: { x: bbox.x + bbox.w * (1 - EDGE), y } };
}

/** Where the dots sit. The symmetry dot rides the top edge, away from the drawing. */
export function guideHandles(guide: Guide, bbox: Box): Point[] {
  'worklet';
  if (guide.kind === 'symmetry') {
    return [{ x: guide.x, y: bbox.y }];
  }
  return guide.kind === 'onePoint' ? [guide.a] : [guide.a, guide.b];
}

export function hitHandle(guide: Guide, bbox: Box, x: number, y: number, reach: number): number {
  'worklet';
  const handles = guideHandles(guide, bbox);
  for (let i = 0; i < handles.length; i++) {
    if (Math.hypot(handles[i].x - x, handles[i].y - y) <= reach) {
      return i;
    }
  }
  return -1;
}

export function moveHandle(guide: Guide, handle: number, p: Point, bbox: Box): Guide {
  'worklet';
  if (guide.kind === 'symmetry') {
    return { kind: 'symmetry', x: Math.max(bbox.x, Math.min(bbox.x + bbox.w, p.x)) };
  }
  if (guide.kind === 'onePoint') {
    return { kind: 'onePoint', a: p };
  }
  return handle === 0 ? { ...guide, a: p } : { ...guide, b: p };
}

/** Fills and erasers stay free, and so do closed shapes: only a line can follow a ruler. */
export function followsPerspective(tool: Stroke['tool']): boolean {
  'worklet';
  return tool !== 'eraser' && !isFillTool(tool) && (!isShapeTool(tool) || tool === 'line');
}

export function snaps(guide: Guide | null, tool: Stroke['tool']): boolean {
  'worklet';
  return !!guide && guide.kind !== 'symmetry' && followsPerspective(tool);
}

function towards(from: Point, to: Point): Point | null {
  'worklet';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length < 0.001 ? null : { x: dx / length, y: dy / length };
}

/** Every direction a stroke starting at `from` may take. */
export function snapDirections(guide: Guide, from: Point): Point[] {
  'worklet';
  const out: Point[] = [];
  if (guide.kind === 'symmetry') {
    return out;
  }
  const first = towards(from, guide.a);
  if (first) {
    out.push(first);
  }
  if (guide.kind === 'twoPoint') {
    const second = towards(from, guide.b);
    if (second) {
      out.push(second);
    }
  } else {
    out.push({ x: 1, y: 0 });
  }
  out.push({ x: 0, y: 1 });
  return out;
}

/** The direction closest to where the pen went, ignoring which way along the line it travelled. */
export function pickDirection(directions: Point[], dx: number, dy: number): Point | null {
  'worklet';
  const length = Math.hypot(dx, dy);
  if (length < 0.001 || directions.length === 0) {
    return null;
  }
  let best = directions[0];
  let bestFit = -1;
  for (let i = 0; i < directions.length; i++) {
    const fit = Math.abs((directions[i].x * dx + directions[i].y * dy) / length);
    if (fit > bestFit) {
      bestFit = fit;
      best = directions[i];
    }
  }
  return best;
}

export function projectOnLine(from: Point, direction: Point, p: Point): Point {
  'worklet';
  const along = (p.x - from.x) * direction.x + (p.y - from.y) * direction.y;
  return { x: from.x + direction.x * along, y: from.y + direction.y * along };
}

export function mirrorAxis(guide: Guide | null): number | null {
  'worklet';
  return guide && guide.kind === 'symmetry' ? guide.x : null;
}

/** Keeps pressure values: a stroke's points are x, y pairs, or x, y, pressure triples. */
export function mirrorStroke(stroke: Stroke, axis: number): Stroke {
  'worklet';
  const step = stroke.pressure ? 3 : 2;
  const points = stroke.points.slice();
  for (let i = 0; i < points.length; i += step) {
    points[i] = Math.round((axis * 2 - points[i]) * 10) / 10;
  }
  return { ...stroke, points };
}
