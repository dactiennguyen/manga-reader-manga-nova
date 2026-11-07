import {
  AlphaType,
  BlendMode,
  ColorType,
  FilterMode,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  type SkCanvas,
  type SkPaint,
  type SkPath,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';

import { TONE_PITCH, isFillTool, isShapeTool, shapeBox, toneRadius } from '../core/art/artMath';
import { getStroke } from '../core/art/freehand';
import { freehandOptions, isOutlineTool, toTriples } from '../core/art/strokes';
import type { ArtLayer, ID, PanelArt, Stroke } from '../core/model/types';
import { getImage } from './images';

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

export function buildStrokePath(stroke: Stroke, last: boolean): SkPath | null {
  'worklet';
  if (isShapeTool(stroke.tool)) {
    return shapePath(stroke);
  }
  if (isFillTool(stroke.tool)) {
    return closedPath(toTriples({ points: stroke.points }));
  }
  const points = toTriples(stroke);
  if (!points.length) {
    return null;
  }
  if (isOutlineTool(stroke.tool)) {
    return outlinePath(getStroke(points, freehandOptions(stroke, last)));
  }
  return centerPath(points);
}

export function makeToneShader(color: string, density: number): SkShader {
  'worklet';
  const rect = Skia.XYWHRect(0, 0, TONE_PITCH, TONE_PITCH);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(rect);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  canvas.drawCircle(TONE_PITCH / 2, TONE_PITCH / 2, toneRadius(density), paint);
  const matrix = Skia.Matrix();
  matrix.rotate(Math.PI / 4);
  return recorder
    .finishRecordingAsPicture()
    .makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, matrix, rect);
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
  if (isOutlineTool(stroke.tool) || isFillTool(stroke.tool)) {
    paint.setStyle(PaintStyle.Fill);
  } else {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(stroke.size);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(stroke.tool === 'rect' ? StrokeJoin.Miter : StrokeJoin.Round);
  }
  return paint;
}

const toneCache = new Map<string, SkShader>();

export function toneShader(color: string, density: number): SkShader {
  const key = `${color}|${density}`;
  const cached = toneCache.get(key);
  if (cached) {
    return cached;
  }
  const shader = makeToneShader(color, density);
  if (toneCache.size >= 64) {
    toneCache.clear();
  }
  toneCache.set(key, shader);
  return shader;
}

export function strokePaint(stroke: Stroke): SkPaint {
  return buildStrokePaint(stroke, stroke.tone ? toneShader(stroke.color, stroke.tone.density) : null);
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

export function drawStroke(canvas: SkCanvas, stroke: Stroke): void {
  const path = strokePath(stroke);
  if (path) {
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
