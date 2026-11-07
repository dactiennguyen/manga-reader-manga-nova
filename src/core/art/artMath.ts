import type { ArtLayer, LayerImage, Stroke, StrokeTool } from '../model/types';

export type Box = { x: number; y: number; w: number; h: number };

export type LayerTransform = { s: number; tx: number; ty: number };

export const IDENTITY_TRANSFORM: LayerTransform = { s: 1, tx: 0, ty: 0 };

export const TONE_PITCH = 6;
export const TONE_DENSITIES = [0.1, 0.25, 0.4, 0.6];

function round1(v: number): number {
  'worklet';
  return Math.round(v * 10) / 10;
}

export function isShapeTool(tool: StrokeTool): boolean {
  'worklet';
  return tool === 'line' || tool === 'rect' || tool === 'ellipse';
}

export function isFillTool(tool: StrokeTool): boolean {
  'worklet';
  return tool === 'fill';
}

export function strokeStep(stroke: Pick<Stroke, 'tool' | 'pressure'>): number {
  'worklet';
  return stroke.pressure && !isShapeTool(stroke.tool) && !isFillTool(stroke.tool) ? 3 : 2;
}

export function shapeBox(points: number[]): Box | null {
  'worklet';
  if (points.length < 4) {
    return null;
  }
  const [x0, y0, x1, y1] = points;
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

export function toneRadius(density: number, pitch = TONE_PITCH): number {
  'worklet';
  const d = Math.max(0.01, Math.min(0.75, density));
  return pitch * Math.sqrt(d / Math.PI);
}

export function appendPressurePoint(
  points: number[],
  x: number,
  y: number,
  pressure: number,
  minDistance: number,
): boolean {
  'worklet';
  const px = round1(x);
  const py = round1(y);
  const n = points.length;
  if (n >= 3 && Math.hypot(points[n - 3] - px, points[n - 2] - py) < minDistance) {
    return false;
  }
  points.push(px, py, Math.round(Math.max(0.02, Math.min(1, pressure)) * 100) / 100);
  return true;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isIdentityTransform(t: LayerTransform): boolean {
  'worklet';
  return Math.abs(t.s - 1) < 1e-4 && Math.abs(t.tx) < 0.05 && Math.abs(t.ty) < 0.05;
}

export function transformStroke(stroke: Stroke, t: LayerTransform): Stroke {
  const step = strokeStep(stroke);
  const points = new Array<number>(stroke.points.length);
  for (let i = 0; i < stroke.points.length; i++) {
    const k = i % step;
    const v = stroke.points[i];
    points[i] = k === 0 ? round2(v * t.s + t.tx) : k === 1 ? round2(v * t.s + t.ty) : v;
  }
  return { ...stroke, points, size: Math.max(0.1, Math.round(stroke.size * t.s * 100) / 100) };
}

export function transformImage(image: LayerImage, t: LayerTransform): LayerImage {
  return {
    ...image,
    x: round1(image.x * t.s + t.tx),
    y: round1(image.y * t.s + t.ty),
    w: round1(image.w * t.s),
    h: round1(image.h * t.s),
  };
}

export function transformLayer<T extends Pick<ArtLayer, 'strokes' | 'image'>>(layer: T, t: LayerTransform): T {
  return {
    ...layer,
    strokes: layer.strokes.map(stroke => transformStroke(stroke, t)),
    ...(layer.image ? { image: transformImage(layer.image, t) } : null),
  };
}

export function layerBounds(layer: Pick<ArtLayer, 'strokes' | 'image'>): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number, pad: number) => {
    minX = Math.min(minX, x - pad);
    minY = Math.min(minY, y - pad);
    maxX = Math.max(maxX, x + pad);
    maxY = Math.max(maxY, y + pad);
  };
  if (layer.image) {
    add(layer.image.x, layer.image.y, 0);
    add(layer.image.x + layer.image.w, layer.image.y + layer.image.h, 0);
  }
  for (const stroke of layer.strokes) {
    if (stroke.tool === 'eraser') {
      continue;
    }
    const step = strokeStep(stroke);
    const pad = isFillTool(stroke.tool) ? 0 : stroke.size / 2;
    for (let i = 0; i + 1 < stroke.points.length; i += step) {
      add(stroke.points[i], stroke.points[i + 1], pad);
    }
  }
  if (minX > maxX || minY > maxY) {
    return null;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function transformBox(box: Box, t: LayerTransform): Box {
  'worklet';
  return { x: box.x * t.s + t.tx, y: box.y * t.s + t.ty, w: box.w * t.s, h: box.h * t.s };
}

export function boxCorners(box: Box): { x: number; y: number }[] {
  'worklet';
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
}

export function hitCorner(box: Box, x: number, y: number, reach: number): number {
  'worklet';
  let best = -1;
  let bestDist = reach;
  boxCorners(box).forEach((corner, index) => {
    const dist = Math.hypot(corner.x - x, corner.y - y);
    if (dist <= bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

export function clampScale(s: number): number {
  'worklet';
  return Math.max(0.05, Math.min(20, Number.isFinite(s) ? s : 1));
}

export function scaleAbout(ax: number, ay: number, s: number): LayerTransform {
  'worklet';
  const scale = clampScale(s);
  return { s: scale, tx: ax * (1 - scale), ty: ay * (1 - scale) };
}

export function cornerOffset(box: Box, corner: number, x: number, y: number): { x: number; y: number } {
  'worklet';
  const from = boxCorners(box)[corner];
  return from ? { x: from.x - x, y: from.y - y } : { x: 0, y: 0 };
}

export function cornerScale(box: Box, corner: number, x: number, y: number): LayerTransform {
  'worklet';
  const corners = boxCorners(box);
  const anchor = corners[(corner + 2) % 4];
  const from = corners[corner];
  const base = Math.hypot(from.x - anchor.x, from.y - anchor.y);
  if (base < 0.01) {
    return IDENTITY_TRANSFORM;
  }
  const ux = (from.x - anchor.x) / base;
  const uy = (from.y - anchor.y) / base;
  const along = (x - anchor.x) * ux + (y - anchor.y) * uy;
  return scaleAbout(anchor.x, anchor.y, along / base);
}

export function composeTransform(first: LayerTransform, then: LayerTransform): LayerTransform {
  'worklet';
  const s = clampScale(first.s * then.s);
  const k = s / first.s;
  return { s, tx: first.tx * k + then.tx, ty: first.ty * k + then.ty };
}

export function pinchTransform(
  from: { cx: number; cy: number; dist: number },
  to: { cx: number; cy: number; dist: number },
): LayerTransform {
  'worklet';
  const s = clampScale(to.dist / Math.max(0.01, from.dist));
  return { s, tx: to.cx - from.cx * s, ty: to.cy - from.cy * s };
}
