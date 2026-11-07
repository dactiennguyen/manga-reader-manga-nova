import type { PanelShape, Pt, Rect } from '../layout/layout';
import { HANDLE_HIT_DP } from '../layout/pageView';
import type { Bubble } from '../model/types';
import { bubbleCenter, hitTestBubble, rotatePoint, toBubbleLocal } from './bubbles';

export type Guide = { axis: 'x' | 'y'; at: number };

type DragMode = 'move' | 'resize' | 'rotate' | 'tail' | 'center' | 'view';

export type DragPick = { mode: DragMode; start: Bubble | null; corner: number };

export type SnapTargets = { xs: number[]; ys: number[] };

export const ROTATE_OFFSET = 36;

const BODY_SLOP_DP = 4;
const SNAP_DP = 6;
const ANGLE_SNAP = 4;
const SNAP_ANGLES = [0, 15, -15, 45, -45, 90, -90, 180, -180];
const MIN_W = 60;
const MIN_H = 40;
const TAIL_INSET = 0.12;

function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function rotateHandle(bubble: Pick<Bubble, 'x' | 'y' | 'w'>, k: number): Pt {
  return { x: bubble.x + bubble.w / 2, y: bubble.y - ROTATE_OFFSET / k };
}

export function localCorners(bubble: Pick<Bubble, 'x' | 'y' | 'w' | 'h'>): Pt[] {
  const { x, y, w, h } = bubble;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function bubbleAt(bubbles: Bubble[], p: Pt, k: number): Bubble | null {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    if (hitTestBubble(bubbles[i], p, BODY_SLOP_DP / k)) {
      return bubbles[i];
    }
  }
  return null;
}

/** Tail first, then rotate, then a corner, then the body. Handles overlap on a small bubble. */
export function hitSelected(bubble: Bubble, p: Pt, k: number): DragPick | null {
  const tolerance = HANDLE_HIT_DP / k;
  const local = toBubbleLocal(bubble, p);
  if (bubble.tail && distance(bubble.tail, p) < tolerance) {
    return { mode: 'tail', start: bubble, corner: 0 };
  }
  if (distance(rotateHandle(bubble, k), local) < tolerance) {
    return { mode: 'rotate', start: bubble, corner: 0 };
  }
  const corner = localCorners(bubble).findIndex(point => distance(point, local) < tolerance);
  if (corner >= 0) {
    return { mode: 'resize', start: bubble, corner };
  }
  return hitTestBubble(bubble, p, BODY_SLOP_DP / k) ? { mode: 'move', start: bubble, corner: 0 } : null;
}

export function pickDrag(input: {
  p: Pt;
  k: number;
  selected: Bubble | null;
  effectCenter: Pt | null;
  /** Bubbles a drag may grab when nothing selected is hit. Empty while placing something new. */
  grabbable: Bubble[];
}): DragPick {
  const { p, k, selected, effectCenter, grabbable } = input;
  const handle = selected ? hitSelected(selected, p, k) : null;
  if (handle) {
    return handle;
  }
  if (effectCenter && distance(effectCenter, p) < HANDLE_HIT_DP / k) {
    return { mode: 'center', start: null, corner: 0 };
  }
  const hit = bubbleAt(grabbable, p, k);
  return hit ? { mode: 'move', start: hit, corner: 0 } : { mode: 'view', start: null, corner: 0 };
}

export function snapTo(value: number, targets: number[], tolerance: number): number | null {
  let best: number | null = null;
  for (const target of targets) {
    if (Math.abs(target - value) <= tolerance && (best === null || Math.abs(target - value) < Math.abs(best - value))) {
      best = target;
    }
  }
  return best;
}

/** Other bubble centers, plus each panel's edges and middle. */
export function snapTargets(bubbles: Bubble[], movingId: string, shapes: Pick<PanelShape, 'bbox'>[]): SnapTargets {
  const others = bubbles.filter(bubble => bubble.id !== movingId).map(bubbleCenter);
  const boxes = shapes.map(shape => shape.bbox);
  return {
    xs: [...others.map(o => o.x), ...boxes.flatMap(bb => [bb.x, bb.x + bb.w / 2, bb.x + bb.w])],
    ys: [...others.map(o => o.y), ...boxes.flatMap(bb => [bb.y, bb.y + bb.h / 2, bb.y + bb.h])],
  };
}

export function moveBubble(start: Bubble, dx: number, dy: number, k: number, targets: SnapTargets): { bubble: Bubble; guides: Guide[] } {
  const center = bubbleCenter(start);
  const sx = snapTo(center.x + dx, targets.xs, SNAP_DP / k);
  const sy = snapTo(center.y + dy, targets.ys, SNAP_DP / k);
  const mx = sx === null ? dx : sx - center.x;
  const my = sy === null ? dy : sy - center.y;
  const guides: Guide[] = [];
  if (sx !== null) {
    guides.push({ axis: 'x', at: sx });
  }
  if (sy !== null) {
    guides.push({ axis: 'y', at: sy });
  }
  return {
    guides,
    bubble: {
      ...start,
      x: start.x + mx,
      y: start.y + my,
      tail: start.tail ? { x: start.tail.x + mx, y: start.tail.y + my } : null,
    },
  };
}

/** The corner opposite the dragged one stays put, also on a rotated bubble. */
export function resizeBubble(start: Bubble, corner: number, p: Pt): Bubble {
  const center = bubbleCenter(start);
  const q = rotatePoint(p, center, -start.rotation);
  const left = corner === 0 || corner === 3;
  const top = corner === 0 || corner === 1;
  const ax = left ? start.x + start.w : start.x;
  const ay = top ? start.y + start.h : start.y;
  const w = Math.max(MIN_W, left ? ax - q.x : q.x - ax);
  const h = Math.max(MIN_H, top ? ay - q.y : q.y - ay);
  const local = { x: left ? ax - w / 2 : ax + w / 2, y: top ? ay - h / 2 : ay + h / 2 };
  const world = rotatePoint(local, center, start.rotation);
  return { ...start, x: world.x - w / 2, y: world.y - h / 2, w, h };
}

export function rotateBubble(start: Bubble, p: Pt): Bubble {
  const center = bubbleCenter(start);
  const raw = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI + 90;
  const angle = raw > 180 ? raw - 360 : raw;
  return { ...start, rotation: snapTo(angle, SNAP_ANGLES, ANGLE_SNAP) ?? Math.round(angle) };
}

/** A tail dropped back inside its bubble means the writer wants no tail. */
export function settleTail(bubble: Bubble): Bubble {
  const inside = bubble.tail && hitTestBubble(bubble, bubble.tail, -Math.min(bubble.w, bubble.h) * TAIL_INSET);
  return inside ? { ...bubble, tail: null } : bubble;
}

export function clampToBox(p: Pt, box: Rect): Pt {
  return {
    x: Math.max(box.x, Math.min(box.x + box.w, p.x)),
    y: Math.max(box.y, Math.min(box.y + box.h, p.y)),
  };
}
