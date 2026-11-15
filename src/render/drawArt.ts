import {
  AlphaType,
  BlendMode,
  BlurStyle,
  ColorType,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkPaint,
  type SkPath,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';

import { shapeBox } from '../core/art/artMath';
import { edgeSoftness, strokeBrush } from '../core/art/brushes';
import { DAB_STRIDE, DROP_STRIDE, dabRadius, walkStroke, type DabWalker } from '../core/art/dabs';
import { getStroke } from '../core/art/freehand';
import { freehandOptions, renderKind, toTriples } from '../core/art/strokes';
import type { ArtLayer, ID, PanelArt, Stroke } from '../core/model/types';
import { getImage } from './images';
import { makeToneShader, strokeShader } from './strokeStyle';

export { makeToneShader };

export type ArtDrawOptions = { skipLayerId?: ID; onlyLayerIds?: ID[] };

export const RECORD_BOUNDS = 40000;

export function outlinePath(outline: number[][]): SkPath | null {
  'worklet';
  if (outline.length < 3) {
    return null;
  }
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length - 1; i++) {
    const p = outline[i];
    const n = outline[i + 1];
    builder.quadTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
  }
  builder.close();
  return builder.build();
}

export function centerPath(points: number[][]): SkPath | null {
  'worklet';
  if (!points.length) {
    return null;
  }
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(points[0][0], points[0][1]);
  if (points.length === 1) {
    builder.lineTo(points[0][0] + 0.01, points[0][1] + 0.01);
  }
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const n = points[i + 1];
    builder.quadTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
  }
  if (points.length > 1) {
    const lastPoint = points[points.length - 1];
    builder.lineTo(lastPoint[0], lastPoint[1]);
  }
  return builder.build();
}

export function shapePath(stroke: Stroke): SkPath | null {
  'worklet';
  const box = shapeBox(stroke.points);
  if (!box) {
    return null;
  }
  if (stroke.tool === 'line') {
    const x0 = stroke.points[0];
    const y0 = stroke.points[1];
    const x1 = stroke.points[2];
    const y1 = stroke.points[3];
    const same = x0 === x1 && y0 === y1;
    return Skia.PathBuilder.Make()
      .moveTo(x0, y0)
      .lineTo(same ? x1 + 0.01 : x1, same ? y1 + 0.01 : y1)
      .build();
  }
  const rect = Skia.XYWHRect(box.x, box.y, Math.max(0.01, box.w), Math.max(0.01, box.h));
  return stroke.tool === 'ellipse' ? Skia.Path.Oval(rect) : Skia.Path.Rect(rect);
}

export function closedPath(points: number[][]): SkPath | null {
  'worklet';
  if (points.length < 3) {
    return null;
  }
  const n = points.length;
  const builder = Skia.PathBuilder.Make();
  builder.moveTo((points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2);
  for (let i = 1; i <= n; i++) {
    const p = points[i % n];
    const q = points[(i + 1) % n];
    builder.quadTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  builder.close();
  return builder.build();
}

/** The stroke's filled or stroked path. Null for a dab stroke, which has no single path (see drawDabs). */
export function buildStrokePath(stroke: Stroke, last: boolean): SkPath | null {
  'worklet';
  const kind = renderKind(stroke);
  if (kind === 'shape') {
    return shapePath(stroke);
  }
  if (kind === 'fill') {
    return closedPath(toTriples({ points: stroke.points }));
  }
  if (kind === 'dabs') {
    return null;
  }
  const points = toTriples(stroke);
  if (!points.length) {
    return null;
  }
  if (kind === 'outline') {
    return outlinePath(getStroke(points, freehandOptions(stroke, last)));
  }
  return centerPath(points);
}

export function buildStrokePaint(stroke: Stroke, shader: SkShader | null): SkPaint {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  if (stroke.tool === 'eraser') {
    paint.setBlendMode(BlendMode.Clear);
  } else {
    paint.setColor(Skia.Color(stroke.color));
    paint.setAlphaf(stroke.opacity);
    if (shader) {
      paint.setShader(shader);
    }
  }
  const custom = strokeBrush(stroke);
  if (custom) {
    const soft = edgeSoftness(custom, stroke.size);
    if (soft > 0) {
      // Follows the zoom, so a soft edge looks the same on screen and in an export.
      paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, soft, true));
    }
  }
  const kind = renderKind(stroke);
  if (kind === 'outline' || kind === 'fill' || kind === 'dabs') {
    paint.setStyle(PaintStyle.Fill);
  } else {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(stroke.size);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(stroke.tool === 'rect' ? StrokeJoin.Miter : StrokeJoin.Round);
  }
  return paint;
}

export function strokePaint(stroke: Stroke): SkPaint {
  return buildStrokePaint(stroke, strokeShader(stroke));
}

/**
 * Draws dabs and droplets from `from` up to `to`, with the end taper for the walk's current length. Dab
 * alpha replaces the paint's own, which is the stroke's opacity, so droplets get that back.
 */
export function drawDabs(
  canvas: SkCanvas,
  w: DabWalker,
  paint: SkPaint,
  from: { dabs: number; drops: number },
  to: { dabs: number; drops: number },
): void {
  'worklet';
  const { dabs, drops } = w;
  for (let i = from.dabs; i < to.dabs; i++) {
    const at = i * DAB_STRIDE;
    const r = dabRadius(w, dabs[at + 2], dabs[at + 4]);
    if (r > 0.02) {
      paint.setAlphaf(dabs[at + 3]);
      canvas.drawCircle(dabs[at], dabs[at + 1], r, paint);
    }
  }
  if (to.drops > from.drops) {
    paint.setAlphaf(w.spec.opacity);
    for (let i = from.drops; i < to.drops; i++) {
      const at = i * DROP_STRIDE;
      const r = dabRadius(w, drops[at + 2], drops[at + 3]);
      if (r > 0.02) {
        canvas.drawCircle(drops[at], drops[at + 1], r, paint);
      }
    }
  }
}

export function walkerEnd(w: DabWalker): { dabs: number; drops: number } {
  'worklet';
  return { dabs: Math.floor(w.dabs.length / DAB_STRIDE), drops: Math.floor(w.drops.length / DROP_STRIDE) };
}

export const WALK_START = { dabs: 0, drops: 0 };

/** The dab walk of a stroke that has dabs or spatter, or null. */
export function buildStrokeWalk(stroke: Stroke): DabWalker | null {
  'worklet';
  const custom = strokeBrush(stroke);
  if (!custom || (renderKind(stroke) !== 'dabs' && custom.grain !== 'spatter')) {
    return null;
  }
  return walkStroke(stroke, custom);
}

const walkCache = new WeakMap<Stroke, DabWalker | null>();

function strokeWalk(stroke: Stroke): DabWalker | null {
  if (walkCache.has(stroke)) {
    return walkCache.get(stroke) ?? null;
  }
  const walk = buildStrokeWalk(stroke);
  walkCache.set(stroke, walk);
  return walk;
}

const pathCache = new WeakMap<Stroke, SkPath | null>();

export function strokePath(stroke: Stroke): SkPath | null {
  if (pathCache.has(stroke)) {
    return pathCache.get(stroke) ?? null;
  }
  const path = buildStrokePath(stroke, true);
  pathCache.set(stroke, path);
  return path;
}

const dabPictures = new WeakMap<Stroke, SkPicture>();

/**
 * A stroke with dabs is recorded once into its own picture. A layer re-records its unsealed strokes after
 * every new stroke, and replaying hundreds of dabs each time would stall the JS thread.
 */
function dabPicture(stroke: Stroke, path: SkPath | null, walk: DabWalker): SkPicture {
  const cached = dabPictures.get(stroke);
  if (cached) {
    return cached;
  }
  const picture = recordPicture(canvas => {
    const paint = strokePaint(stroke);
    if (path) {
      canvas.drawPath(path, paint);
    }
    drawDabs(canvas, walk, paint, WALK_START, walkerEnd(walk));
  });
  dabPictures.set(stroke, picture);
  return picture;
}

export function drawStroke(canvas: SkCanvas, stroke: Stroke): void {
  const path = strokePath(stroke);
  const walk = strokeWalk(stroke);
  if (walk) {
    canvas.drawPicture(dabPicture(stroke, path, walk));
  } else if (path) {
    canvas.drawPath(path, strokePaint(stroke));
  }
}

export function drawLayerImage(canvas: SkCanvas, layer: Pick<ArtLayer, 'image'>): void {
  if (!layer.image) {
    return;
  }
  const image = getImage(layer.image.uri);
  if (image) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(layer.image.x, layer.image.y, layer.image.w, layer.image.h),
      paint,
    );
  }
}

export function drawLayerContent(canvas: SkCanvas, layer: Pick<ArtLayer, 'strokes' | 'image'>): void {
  drawLayerImage(canvas, layer);
  for (const stroke of layer.strokes) {
    drawStroke(canvas, stroke);
  }
}

export function drawLayer(canvas: SkCanvas, layer: ArtLayer): void {
  if (!layer.visible || (!layer.strokes.length && !layer.image)) {
    return;
  }
  const layerPaint = Skia.Paint();
  layerPaint.setAlphaf(layer.opacity);
  canvas.saveLayer(layerPaint);
  drawLayerContent(canvas, layer);
  canvas.restore();
}

export function drawArt(canvas: SkCanvas, art: PanelArt | null, options: ArtDrawOptions = {}): void {
  if (!art) {
    return;
  }
  for (const layer of art.layers) {
    if (layer.id === options.skipLayerId) {
      continue;
    }
    if (options.onlyLayerIds && !options.onlyLayerIds.includes(layer.id)) {
      continue;
    }
    drawLayer(canvas, layer);
  }
}

export function recordBounds() {
  'worklet';
  return Skia.XYWHRect(-RECORD_BOUNDS, -RECORD_BOUNDS, RECORD_BOUNDS * 2, RECORD_BOUNDS * 2);
}

export function recordPicture(draw: (canvas: SkCanvas) => void): SkPicture {
  const recorder = Skia.PictureRecorder();
  draw(recorder.beginRecording(recordBounds()));
  return recorder.finishRecordingAsPicture();
}

export function recordLayerContent(layer: Pick<ArtLayer, 'strokes' | 'image'>): SkPicture {
  return recordPicture(canvas => drawLayerContent(canvas, layer));
}

export function sampleArtColor(art: PanelArt, x: number, y: number): string | null {
  const surface = Skia.Surface.Make(1, 1);
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  canvas.translate(-x, -y);
  drawArt(canvas, art);
  surface.flush();
  const pixels = surface
    .makeImageSnapshot()
    .readPixels(0, 0, { width: 1, height: 1, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!pixels || pixels.length < 4 || pixels[3] < 8) {
    return null;
  }
  const alpha = pixels[3] / 255;
  const hex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * alpha + 255 * (1 - alpha))))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(pixels[0])}${hex(pixels[1])}${hex(pixels[2])}`.toUpperCase();
}
