import type { PanelArt, Stroke } from '../model/types';
import { isFillTool } from './artMath';
import type { Easing, StrokeOptions } from './freehand';

export const STROKE_POINT_LIMIT = 4096;

function brushEasing(t: number): number {
  'worklet';
  return t * t;
}

function penEasing(t: number): number {
  'worklet';
  return Math.sin((t * Math.PI) / 2);
}

export function freehandOptions(stroke: Pick<Stroke, 'tool' | 'size' | 'pressure'>, last = true): StrokeOptions {
  'worklet';
  const brush = stroke.tool === 'brush';
  const easing: Easing = brush ? brushEasing : penEasing;
  return {
    size: stroke.size,
    thinning: brush ? 0.86 : 0.64,
    smoothing: brush ? 0.6 : 0.52,
    streamline: brush ? 0.4 : 0.5,
    easing,
    simulatePressure: !stroke.pressure,
    start: { taper: brush ? stroke.size * 2.5 : stroke.size * 1.2, cap: true },
    end: { taper: brush ? stroke.size * 4.5 : stroke.size * 2.4, cap: true },
    last,
  };
}

export function toTriples(stroke: Pick<Stroke, 'points' | 'pressure'>): number[][] {
  'worklet';
  const out: number[][] = [];
  const step = stroke.pressure ? 3 : 2;
  for (let i = 0; i + step - 1 < stroke.points.length; i += step) {
    out.push(
      stroke.pressure
        ? [stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]]
        : [stroke.points[i], stroke.points[i + 1]],
    );
  }
  return out;
}

export function isOutlineTool(tool: Stroke['tool']): boolean {
  'worklet';
  return tool === 'gpen' || tool === 'brush';
}

/** Filled outline, stroked centre line, or closed lasso: the three ways a freehand stroke becomes a path. */
export function strokeKind(tool: Stroke['tool']): 'outline' | 'fill' | 'center' {
  'worklet';
  return isOutlineTool(tool) ? 'outline' : isFillTool(tool) ? 'fill' : 'center';
}

export function appendPoint(points: number[], x: number, y: number, minDistance: number): boolean {
  'worklet';
  const px = Math.round(x * 10) / 10;
  const py = Math.round(y * 10) / 10;
  const n = points.length;
  if (n >= 2 && Math.hypot(points[n - 2] - px, points[n - 1] - py) < minDistance) {
    return false;
  }
  points.push(px, py);
  return true;
}

export function fitImageRect(
  imageW: number,
  imageH: number,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(box.w / Math.max(1, imageW), box.h / Math.max(1, imageH));
  const w = Math.round(imageW * scale * 10) / 10;
  const h = Math.round(imageH * scale * 10) / 10;
  return {
    x: Math.round((box.x + (box.w - w) / 2) * 10) / 10,
    y: Math.round((box.y + (box.h - h) / 2) * 10) / 10,
    w,
    h,
  };
}

export function artImageUris(art: PanelArt | null): string[] {
  return art ? art.layers.flatMap(layer => (layer.image ? [layer.image.uri] : [])) : [];
}

export function artHasVisibleContent(art: PanelArt | null): boolean {
  return !!art && art.layers.some(layer => layer.visible && (layer.strokes.length > 0 || !!layer.image));
}
