import type { Box } from './artMath';
import type { Point } from './guides';

/**
 * A 2D affine map: x' = a·x + c·y + tx, y' = b·x + d·y + ty. The canvas only builds moves, uniform scales,
 * turns and mirrors, but the maths holds for any matrix. These run in the gesture reducer, so each one is a
 * worklet declared before it is used.
 */
export type Affine = { a: number; b: number; c: number; d: number; tx: number; ty: number };

export type SelectionOp = 'rotateLeft' | 'rotateRight' | 'flipH' | 'flipV' | 'grow' | 'shrink' | 'reset';

export const IDENTITY_AFFINE: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export const HIT_NONE = -1;
/** 0 to 3 are the corners, in the order of boxCorners. */
export const HIT_ROTATE = 4;
export const HIT_INSIDE = 5;

export const AFFINE_SCALE_MIN = 0.05;
export const AFFINE_SCALE_MAX = 20;
/** A turn this close to a quarter turn lands on it. */
export const ROTATE_SNAP = 0.05;
const BUTTON_SCALE = 1.1;

export function isIdentityAffine(m: Affine): boolean {
  'worklet';
  return (
    Math.abs(m.a - 1) < 1e-4 &&
    Math.abs(m.d - 1) < 1e-4 &&
    Math.abs(m.b) < 1e-4 &&
    Math.abs(m.c) < 1e-4 &&
    Math.abs(m.tx) < 0.05 &&
    Math.abs(m.ty) < 0.05
  );
}

export function applyAffine(m: Affine, x: number, y: number): Point {
  'worklet';
  return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
}

/** The map that does `first`, then `then`. */
export function composeAffine(first: Affine, then: Affine): Affine {
  'worklet';
  return {
    a: then.a * first.a + then.c * first.b,
    b: then.b * first.a + then.d * first.b,
    c: then.a * first.c + then.c * first.d,
    d: then.b * first.c + then.d * first.d,
    tx: then.a * first.tx + then.c * first.ty + then.tx,
    ty: then.b * first.tx + then.d * first.ty + then.ty,
  };
}

export function invertAffine(m: Affine): Affine | null {
  'worklet';
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-9) {
    return null;
  }
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}

/** How much lengths grow. Exact for the uniform maps the canvas builds, the mean of both axes otherwise. */
export function affineScale(m: Affine): number {
  'worklet';
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
}

export function affineAngle(m: Affine): number {
  'worklet';
  return Math.atan2(m.b, m.a);
}

/** True when a level box is still level afterwards: no turn other than quarter turns, and no shear. */
export function keepsAxes(m: Affine): boolean {
  'worklet';
  const eps = 1e-4 * Math.max(1e-6, affineScale(m));
  return (Math.abs(m.b) < eps && Math.abs(m.c) < eps) || (Math.abs(m.a) < eps && Math.abs(m.d) < eps);
}

export function moveBy(dx: number, dy: number): Affine {
  'worklet';
  return { a: 1, b: 0, c: 0, d: 1, tx: dx, ty: dy };
}

export function scaleAround(cx: number, cy: number, s: number): Affine {
  'worklet';
  return { a: s, b: 0, c: 0, d: s, tx: cx * (1 - s), ty: cy * (1 - s) };
}

/** Positive angles turn clockwise on screen, since y grows downwards. */
export function rotateAround(cx: number, cy: number, angle: number): Affine {
  'worklet';
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { a: cos, b: sin, c: -sin, d: cos, tx: cx - cos * cx + sin * cy, ty: cy - sin * cx - cos * cy };
}

/** Mirrors left to right when `horizontal`, top to bottom otherwise. */
export function mirrorAround(cx: number, cy: number, horizontal: boolean): Affine {
  'worklet';
  return horizontal
    ? { a: -1, b: 0, c: 0, d: 1, tx: cx * 2, ty: 0 }
    : { a: 1, b: 0, c: 0, d: -1, tx: 0, ty: cy * 2 };
}

/** Keeps the total scale inside the limits by trimming the factor about to be applied. */
function clampFactor(base: Affine, factor: number): number {
  'worklet';
  const now = Math.max(1e-6, affineScale(base));
  const safe = Number.isFinite(factor) ? factor : 1;
  return Math.max(AFFINE_SCALE_MIN / now, Math.min(AFFINE_SCALE_MAX / now, safe));
}

function boxCornerAt(box: Box, corner: number): Point {
  'worklet';
  const right = corner === 1 || corner === 2;
  const bottom = corner === 2 || corner === 3;
  return { x: box.x + (right ? box.w : 0), y: box.y + (bottom ? box.h : 0) };
}

export function frameCorners(box: Box, m: Affine): Point[] {
  'worklet';
  const out: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const corner = boxCornerAt(box, i);
    out.push(applyAffine(m, corner.x, corner.y));
  }
  return out;
}

export function frameCenter(box: Box, m: Affine): Point {
  'worklet';
  return applyAffine(m, box.x + box.w / 2, box.y + box.h / 2);
}

/** The middle of the frame's top edge, and the turn handle standing `stem` page units beyond it. */
export function rotateHandle(box: Box, m: Affine, stem: number): { top: Point; handle: Point } {
  'worklet';
  const top = applyAffine(m, box.x + box.w / 2, box.y);
  const center = frameCenter(box, m);
  let ux = top.x - center.x;
  let uy = top.y - center.y;
  const length = Math.hypot(ux, uy);
  if (length < 1e-6) {
    const angle = affineAngle(m);
    ux = Math.sin(angle);
    uy = -Math.cos(angle);
  } else {
    ux /= length;
    uy /= length;
  }
  return { top, handle: { x: top.x + ux * stem, y: top.y + uy * stem } };
}

/**
 * What a touch at (x, y) grabs: the turn handle, a corner, the inside, or nothing. `reach` and `stem` are in
 * page units. Inside a small frame the corners give way, so the selection can still be moved.
 */
export function hitFrame(box: Box, m: Affine, x: number, y: number, reach: number, stem: number): number {
  'worklet';
  const turn = rotateHandle(box, m, stem).handle;
  if (Math.hypot(turn.x - x, turn.y - y) <= reach) {
    return HIT_ROTATE;
  }
  const inverse = invertAffine(m);
  const local = inverse ? applyAffine(inverse, x, y) : { x, y };
  const inside =
    local.x >= box.x && local.x <= box.x + box.w && local.y >= box.y && local.y <= box.y + box.h;
  const shortSide = Math.min(box.w, box.h) * affineScale(m);
  const cornerReach = inside ? Math.min(reach, shortSide * 0.3) : reach;
  const corners = frameCorners(box, m);
  let best = HIT_NONE;
  let bestDist = cornerReach;
  for (let i = 0; i < corners.length; i++) {
    const dist = Math.hypot(corners[i].x - x, corners[i].y - y);
    if (dist <= bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  if (best !== HIT_NONE) {
    return best;
  }
  return inside ? HIT_INSIDE : HIT_NONE;
}

/** Where the grabbed corner sits, so a drag can keep its offset from the finger. */
export function frameCorner(box: Box, m: Affine, corner: number): Point {
  'worklet';
  const local = boxCornerAt(box, corner);
  return applyAffine(m, local.x, local.y);
}

/** A corner dragged to (x, y): one scale for both axes, with the opposite corner staying put. */
export function dragScale(box: Box, base: Affine, corner: number, x: number, y: number): Affine {
  'worklet';
  const anchor = frameCorner(box, base, (corner + 2) % 4);
  const from = frameCorner(box, base, corner);
  const dx = from.x - anchor.x;
  const dy = from.y - anchor.y;
  const span = dx * dx + dy * dy;
  if (span < 1e-6) {
    return base;
  }
  const factor = clampFactor(base, ((x - anchor.x) * dx + (y - anchor.y) * dy) / span);
  return composeAffine(base, scaleAround(anchor.x, anchor.y, factor));
}

/** The turn handle dragged from one point to another, about the frame's centre. */
export function dragRotate(box: Box, base: Affine, fromX: number, fromY: number, x: number, y: number): Affine {
  'worklet';
  const center = frameCenter(box, base);
  let angle = Math.atan2(y - center.y, x - center.x) - Math.atan2(fromY - center.y, fromX - center.x);
  const total = affineAngle(base) + angle;
  const quarter = Math.PI / 2;
  const nearest = Math.round(total / quarter) * quarter;
  if (Math.abs(total - nearest) < ROTATE_SNAP) {
    angle += nearest - total;
  }
  return composeAffine(base, rotateAround(center.x, center.y, angle));
}

/** The buttons that stand in for the gestures. Each acts about the centre of the frame as it is now. */
export function applySelectionOp(box: Box, m: Affine, op: SelectionOp): Affine {
  'worklet';
  if (op === 'reset') {
    return IDENTITY_AFFINE;
  }
  const center = frameCenter(box, m);
  if (op === 'rotateLeft' || op === 'rotateRight') {
    return composeAffine(m, rotateAround(center.x, center.y, op === 'rotateLeft' ? -Math.PI / 2 : Math.PI / 2));
  }
  if (op === 'flipH' || op === 'flipV') {
    return composeAffine(m, mirrorAround(center.x, center.y, op === 'flipH'));
  }
  const factor = clampFactor(m, op === 'grow' ? BUTTON_SCALE : 1 / BUTTON_SCALE);
  return composeAffine(m, scaleAround(center.x, center.y, factor));
}
