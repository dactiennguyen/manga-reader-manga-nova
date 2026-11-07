import {
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkPaint,
  type SkPath,
  type SkPathBuilder,
  type SkPicture,
} from '@shopify/react-native-skia';

import { boxCorners, isFillTool, isShapeTool, type Box } from '../core/art/artMath';
import { guideHandles, type Guide, type Point } from '../core/art/guides';
import type { Vec2 } from '../core/art/freehand';
import {
  addLivePoint,
  createLiveOutline,
  isBaked,
  readLiveOutline,
  readLiveTail,
  type LiveOutline,
} from '../core/art/liveOutline';
import { freehandOptions, isOutlineTool } from '../core/art/strokes';
import type { Stroke } from '../core/model/types';
import { buildStrokePaint, buildStrokePath, makeToneShader, outlinePath, recordBounds, shapePath } from './drawArt';
import { PAPER } from './ink';

/**
 * The stroke under the pen, built on the UI thread. Finished geometry goes into `sealed` every SEAL_EVERY
 * points, so each touch event only rebuilds a short tail. The sealed part of a freehand outline is a run of
 * ribbons that share their cross edges: inside one path those edges cancel, so the fill has no seams and
 * covers exactly what the whole outline covers.
 */

const SEAL_EVERY = 32;

type LiveKind = 'outline' | 'center' | 'fill' | 'shape';

export type LiveStroke = {
  kind: LiveKind;
  stroke: Stroke;
  paint: SkPaint;
  /** The thin edge a lasso shows while it is open. */
  edge: SkPaint | null;
  step: number;
  /** Numbers of stroke.points already read. */
  fed: number;
  /** Points as [x, y], for the center and fill kinds. */
  pts: number[][];
  outline: LiveOutline | null;
  sealed: SkPath | null;
  /** Center and fill: quads below this index are sealed. */
  sealedQuads: number;
  /** Outline: the last left and right indices inside the sealed ribbons, -1 before the first ribbon. */
  sealedLeft: number;
  sealedRight: number;
};

export type PendingStroke = { seq: number; path: SkPath | null; paint: SkPaint; layerId: string };

export function emptyPicture(): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return recorder.finishRecordingAsPicture();
}

function kindOf(stroke: Stroke): LiveKind {
  'worklet';
  if (isShapeTool(stroke.tool)) {
    return 'shape';
  }
  if (isFillTool(stroke.tool)) {
    return 'fill';
  }
  return isOutlineTool(stroke.tool) ? 'outline' : 'center';
}

export function beginLiveStroke(stroke: Stroke): LiveStroke {
  'worklet';
  const kind = kindOf(stroke);
  const shader = stroke.tone ? makeToneShader(stroke.color, stroke.tone.density) : null;
  let edge: SkPaint | null = null;
  if (kind === 'fill') {
    edge = Skia.Paint();
    edge.setAntiAlias(true);
    edge.setStyle(PaintStyle.Stroke);
    edge.setStrokeWidth(1);
    edge.setColor(Skia.Color(stroke.color));
    edge.setAlphaf(0.6);
  }
  return {
    kind,
    stroke,
    paint: buildStrokePaint(stroke, shader),
    edge,
    step: stroke.pressure ? 3 : 2,
    fed: 0,
    pts: [],
    outline: kind === 'outline' ? createLiveOutline(freehandOptions(stroke, false)) : null,
    sealed: null,
    sealedQuads: 1,
    sealedLeft: -1,
    sealedRight: -1,
  };
}

function quadThrough(builder: SkPathBuilder, p: number[], next: number[]): void {
  'worklet';
  builder.quadTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
}

function builderFrom(sealed: SkPath | null): SkPathBuilder {
  'worklet';
  return sealed ? Skia.PathBuilder.MakeFromPath(sealed) : Skia.PathBuilder.Make();
}

/** Walks a list with midpoint quads, starting from the current point of the builder. */
function chain(builder: SkPathBuilder, list: number[][], from: number): void {
  'worklet';
  for (let i = from; i < list.length - 1; i++) {
    quadThrough(builder, list[i], list[i + 1]);
  }
}

function sealRibbon(live: LiveStroke, left: Vec2[], right: Vec2[], startCap: Vec2[]): void {
  'worklet';
  const toLeft = left.length - 2;
  const toRight = right.length - 2;
  const fromLeft = live.sealedLeft;
  const fromRight = live.sealedRight;
  if (toLeft - fromLeft < SEAL_EVERY || toRight - fromRight < SEAL_EVERY) {
    return;
  }
  const builder = builderFrom(live.sealed);
  const first = fromLeft < 0;
  if (first) {
    builder.moveTo(left[0][0], left[0][1]);
  } else {
    builder.moveTo((left[fromLeft][0] + left[fromLeft + 1][0]) / 2, (left[fromLeft][1] + left[fromLeft + 1][1]) / 2);
  }
  for (let i = first ? 1 : fromLeft + 1; i <= toLeft; i++) {
    quadThrough(builder, left[i], left[i + 1]);
  }
  builder.lineTo((right[toRight][0] + right[toRight + 1][0]) / 2, (right[toRight][1] + right[toRight + 1][1]) / 2);
  const stop = first ? 1 : fromRight + 1;
  for (let i = toRight; i >= stop; i--) {
    quadThrough(builder, right[i], right[i - 1]);
  }
  if (first && startCap.length) {
    chain(builder, [right[0], ...startCap], 0);
  }
  builder.close();
  live.sealed = builder.build();
  live.sealedLeft = toLeft;
  live.sealedRight = toRight;
}

function outlineLivePath(live: LiveStroke): SkPath | null {
  'worklet';
  const outline = live.outline as LiveOutline;
  if (!isBaked(outline)) {
    return outlinePath(readLiveOutline(outline));
  }
  const tail = readLiveTail(outline);
  sealRibbon(live, outline.left, outline.right, tail.startCap);
  if (!live.sealed) {
    return outlinePath(readLiveOutline(outline));
  }
  const { left, right } = outline;
  const list: number[][] = [];
  for (let i = live.sealedLeft; i < left.length; i++) {
    list.push(left[i]);
  }
  list.push(...tail.tailLeft, ...tail.endCap);
  for (let i = tail.tailRight.length - 1; i >= 0; i--) {
    list.push(tail.tailRight[i]);
  }
  for (let i = right.length - 1; i >= live.sealedRight; i--) {
    list.push(right[i]);
  }
  const builder = builderFrom(live.sealed);
  builder.moveTo((list[0][0] + list[1][0]) / 2, (list[0][1] + list[1][1]) / 2);
  chain(builder, list, 1);
  builder.close();
  return builder.build();
}

function sealQuads(live: LiveStroke, startX: number, startY: number): void {
  'worklet';
  const { pts } = live;
  const stable = pts.length - 1;
  if (stable - live.sealedQuads < SEAL_EVERY) {
    return;
  }
  const builder = builderFrom(live.sealed);
  if (!live.sealed) {
    builder.moveTo(startX, startY);
  }
  for (let i = live.sealedQuads; i < stable; i++) {
    quadThrough(builder, pts[i], pts[i + 1]);
  }
  live.sealed = builder.build();
  live.sealedQuads = stable;
}

function centerLivePath(live: LiveStroke): SkPath | null {
  'worklet';
  const { pts } = live;
  if (!pts.length) {
    return null;
  }
  sealQuads(live, pts[0][0], pts[0][1]);
  const builder = builderFrom(live.sealed);
  if (!live.sealed) {
    builder.moveTo(pts[0][0], pts[0][1]);
  }
  if (pts.length === 1) {
    builder.lineTo(pts[0][0] + 0.01, pts[0][1] + 0.01);
  }
  for (let i = live.sealedQuads; i < pts.length - 1; i++) {
    quadThrough(builder, pts[i], pts[i + 1]);
  }
  if (pts.length > 1) {
    const last = pts[pts.length - 1];
    builder.lineTo(last[0], last[1]);
  }
  return builder.build();
}

function fillLivePath(live: LiveStroke): SkPath | null {
  'worklet';
  const { pts } = live;
  const n = pts.length;
  if (n < 3) {
    return null;
  }
  const startX = (pts[0][0] + pts[1][0]) / 2;
  const startY = (pts[0][1] + pts[1][1]) / 2;
  sealQuads(live, startX, startY);
  const builder = builderFrom(live.sealed);
  if (!live.sealed) {
    builder.moveTo(startX, startY);
  }
  for (let i = live.sealedQuads; i < n - 1; i++) {
    quadThrough(builder, pts[i], pts[i + 1]);
  }
  quadThrough(builder, pts[n - 1], pts[0]);
  quadThrough(builder, pts[0], pts[1]);
  builder.close();
  return builder.build();
}

function feed(live: LiveStroke, stroke: Stroke): void {
  'worklet';
  const { points } = stroke;
  const { step } = live;
  for (let i = live.fed; i + step - 1 < points.length; i += step) {
    const p = step === 3 ? [points[i], points[i + 1], points[i + 2]] : [points[i], points[i + 1]];
    if (live.outline) {
      addLivePoint(live.outline, p);
    } else {
      live.pts.push(p);
    }
    live.fed = i + step;
  }
}

function livePath(live: LiveStroke): SkPath | null {
  'worklet';
  switch (live.kind) {
    case 'shape':
      return shapePath(live.stroke);
    case 'outline':
      return outlineLivePath(live);
    case 'fill':
      return fillLivePath(live);
    default:
      return centerLivePath(live);
  }
}

/** Takes the latest stroke, since a shape's points are replaced rather than appended. */
export function recordLiveStroke(live: LiveStroke, stroke: Stroke): SkPicture {
  'worklet';
  live.stroke = stroke;
  if (live.kind !== 'shape') {
    feed(live, stroke);
  }
  const path = livePath(live);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  if (path) {
    canvas.drawPath(path, live.paint);
    if (live.edge) {
      canvas.drawPath(path, live.edge);
    }
  }
  return recorder.finishRecordingAsPicture();
}

/** The stroke as it will be stored. Runs once, on lift. */
export function pendingFrom(live: LiveStroke, stroke: Stroke, seq: number, layerId: string): PendingStroke {
  'worklet';
  return { seq, path: buildStrokePath(stroke, true), paint: live.paint, layerId };
}

export function recordPending(list: PendingStroke[]): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  for (let i = 0; i < list.length; i++) {
    const path = list[i].path;
    if (path) {
      canvas.drawPath(path, list[i].paint);
    }
  }
  return recorder.finishRecordingAsPicture();
}

/** The move tool's frame and corner handles. `unit` is one screen point in page units. */
export function recordTransformFrame(box: Box, unit: number, color: string): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeWidth(1.5 * unit);
  line.setColor(Skia.Color(color));
  canvas.drawRect(Skia.XYWHRect(box.x, box.y, box.w, box.h), line);
  const fill = Skia.Paint();
  fill.setColor(Skia.Color(PAPER));
  const edge = Skia.Paint();
  edge.setAntiAlias(true);
  edge.setStyle(PaintStyle.Stroke);
  edge.setStrokeWidth(2 * unit);
  edge.setColor(Skia.Color(color));
  const half = 7 * unit;
  const corners = boxCorners(box);
  for (let i = 0; i < corners.length; i++) {
    const rect = Skia.XYWHRect(corners[i].x - half, corners[i].y - half, half * 2, half * 2);
    canvas.drawRect(rect, fill);
    canvas.drawRect(rect, edge);
  }
  return recorder.finishRecordingAsPicture();
}

const GUIDE_RAYS = 36;

function guideLine(color: string, unit: number): SkPaint {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(unit);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(0.5);
  return paint;
}

function drawRays(canvas: SkCanvas, from: Point, reach: number, paint: SkPaint): void {
  'worklet';
  for (let i = 0; i < GUIDE_RAYS; i++) {
    const angle = (i / GUIDE_RAYS) * Math.PI * 2;
    canvas.drawLine(from.x, from.y, from.x + Math.cos(angle) * reach, from.y + Math.sin(angle) * reach, paint);
  }
}

/** The ruler's lines, clipped to the panel with the art. */
export function recordGuideLines(guide: Guide | null, bbox: Box, unit: number, color: string): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  if (guide) {
    const paint = guideLine(color, unit);
    const reach = Math.hypot(bbox.w, bbox.h) * 3;
    if (guide.kind === 'symmetry') {
      canvas.drawLine(guide.x, bbox.y, guide.x, bbox.y + bbox.h, paint);
    } else {
      drawRays(canvas, guide.a, reach, paint);
    }
    if (guide.kind === 'twoPoint') {
      drawRays(canvas, guide.b, reach, paint);
    }
  }
  return recorder.finishRecordingAsPicture();
}

/** The ruler's dots sit above the panel edge, so a point outside the panel can still be grabbed. */
export function recordGuideHandles(guide: Guide | null, bbox: Box, unit: number, color: string): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  if (guide) {
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    fill.setColor(Skia.Color(color));
    const edge = Skia.Paint();
    edge.setAntiAlias(true);
    edge.setStyle(PaintStyle.Stroke);
    edge.setStrokeWidth(2 * unit);
    edge.setColor(Skia.Color(PAPER));
    const handles = guideHandles(guide, bbox);
    for (let i = 0; i < handles.length; i++) {
      canvas.drawCircle(handles[i].x, handles[i].y, 9 * unit, fill);
      canvas.drawCircle(handles[i].x, handles[i].y, 9 * unit, edge);
    }
  }
  return recorder.finishRecordingAsPicture();
}
