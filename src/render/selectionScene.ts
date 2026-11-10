import { PaintStyle, Skia, type SkPath, type SkPicture } from '@shopify/react-native-skia';

import { frameCorners, rotateHandle, type Affine } from '../core/art/affine';
import type { Box } from '../core/art/artMath';
import { selectionRuns } from '../core/art/selection';
import type { ArtLayer, ID } from '../core/model/types';
import { drawLayerImage, drawStroke, recordBounds, recordPicture } from './drawArt';
import { PAPER } from './ink';

/**
 * The active layer while part of it is selected. Its strokes are split into pictures of selected and
 * unselected stretches, recorded once on the JS thread. Each drag frame the UI thread only replays them,
 * the selected ones under the transform, so no path is rebuilt until the transform is applied.
 */
export type SelectionScene = {
  layerId: ID;
  /** The selected strokes' box before any transform. */
  box: Box;
  runs: SkPicture[];
  moving: boolean[];
};

export type LassoTrail = { path: SkPath; fed: number };

export function buildSelectionScene(
  layer: Pick<ArtLayer, 'id' | 'strokes' | 'image'>,
  indices: number[],
  box: Box,
): SelectionScene {
  const runs: SkPicture[] = [];
  const moving: boolean[] = [];
  if (layer.image) {
    runs.push(recordPicture(canvas => drawLayerImage(canvas, layer)));
    moving.push(false);
  }
  selectionRuns(layer.strokes.length, indices).forEach(run => {
    runs.push(recordPicture(canvas => run.indices.forEach(index => drawStroke(canvas, layer.strokes[index]))));
    moving.push(run.moving);
  });
  return { layerId: layer.id, box, runs, moving };
}

export function recordSelectionScene(scene: SelectionScene, m: Affine): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  const matrix = Skia.Matrix([m.a, m.c, m.tx, m.b, m.d, m.ty, 0, 0, 1]);
  for (let i = 0; i < scene.runs.length; i++) {
    if (scene.moving[i]) {
      canvas.save();
      canvas.concat(matrix);
      canvas.drawPicture(scene.runs[i]);
      canvas.restore();
    } else {
      canvas.drawPicture(scene.runs[i]);
    }
  }
  return recorder.finishRecordingAsPicture();
}

/** The frame around the selection: corner handles to scale, and a round handle above it to turn. */
export function recordSelectionFrame(box: Box, m: Affine, unit: number, stem: number, color: string): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  const corners = frameCorners(box, m);
  const turn = rotateHandle(box, m, stem * unit);
  const outline = Skia.PathBuilder.Make();
  outline.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    outline.lineTo(corners[i].x, corners[i].y);
  }
  outline.close();
  outline.moveTo(turn.top.x, turn.top.y).lineTo(turn.handle.x, turn.handle.y);
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeWidth(1.5 * unit);
  line.setColor(Skia.Color(color));
  canvas.drawPath(outline.build(), line);
  const paper = Skia.Paint();
  paper.setAntiAlias(true);
  paper.setColor(Skia.Color(PAPER));
  const edge = Skia.Paint();
  edge.setAntiAlias(true);
  edge.setStyle(PaintStyle.Stroke);
  edge.setStrokeWidth(2 * unit);
  edge.setColor(Skia.Color(color));
  for (let i = 0; i < corners.length; i++) {
    canvas.drawCircle(corners[i].x, corners[i].y, 7 * unit, paper);
    canvas.drawCircle(corners[i].x, corners[i].y, 7 * unit, edge);
  }
  // Filled, so it reads as a different control from the corners.
  const solid = Skia.Paint();
  solid.setAntiAlias(true);
  solid.setColor(Skia.Color(color));
  edge.setColor(Skia.Color(PAPER));
  canvas.drawCircle(turn.handle.x, turn.handle.y, 9 * unit, solid);
  canvas.drawCircle(turn.handle.x, turn.handle.y, 9 * unit, edge);
  return recorder.finishRecordingAsPicture();
}

/** Adds the lasso points that arrived since the last call. Copying the path is cheaper than walking them all. */
export function extendLasso(trail: LassoTrail | null, points: number[]): LassoTrail {
  'worklet';
  // A trail longer than the points belongs to an earlier lasso.
  const from = trail && trail.fed <= points.length ? trail : null;
  const builder = from ? Skia.PathBuilder.MakeFromPath(from.path) : Skia.PathBuilder.Make();
  for (let i = from ? from.fed : 0; i + 1 < points.length; i += 2) {
    if (i === 0) {
      builder.moveTo(points[0], points[1]);
    } else {
      builder.lineTo(points[i], points[i + 1]);
    }
  }
  return { path: builder.build(), fed: points.length };
}

/** A light line under a coloured one, so the lasso shows on white paper and on black ink alike. */
export function recordLasso(path: SkPath, unit: number, color: string): SkPicture {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(recordBounds());
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(4 * unit);
  paint.setColor(Skia.Color(PAPER));
  canvas.drawPath(path, paint);
  paint.setStrokeWidth(1.5 * unit);
  paint.setColor(Skia.Color(color));
  canvas.drawPath(path, paint);
  return recorder.finishRecordingAsPicture();
}
