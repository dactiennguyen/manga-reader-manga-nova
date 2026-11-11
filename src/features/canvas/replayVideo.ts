import {
  ClipOp,
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeJoin,
  type SkCanvas,
  type SkPath,
} from '@shopify/react-native-skia';

import {
  REPLAY_HOLD_SECONDS,
  replayFps,
  replayFrames,
  replayVideoSize,
  sceneAtStep,
  sceneSteps,
} from '../../core/art/replay';
import { artImageUris } from '../../core/art/strokes';
import { padNumber } from '../../core/export/plan';
import type { PanelShape, Rect } from '../../core/layout/layout';
import type { PanelArt } from '../../core/model/types';
import { uid } from '../../core/util/id';
import { dayKey } from '../../core/util/time';
import { DIRS, RNFS, ensureDirs, framesToVideo, removeFile, resetDir } from '../../native/files';
import { drawArt } from '../../render/drawArt';
import { PANEL_BORDER, polyPath } from '../../render/drawPage';
import { loadImage } from '../../render/images';
import { INK, PAPER } from '../../render/ink';

export class ReplayCancelled extends Error {}

export type ReplayVideo = { path: string; fileName: string };

/** What is replayed: one panel, or every panel of a page in reading order. */
export type ReplayScene = {
  parts: { shape: PanelShape; art: PanelArt | null }[];
  /** The area shown, in page units. */
  bbox: Rect;
  /** Draws the panel borders, for a whole page. */
  framed: boolean;
};

/** Read when a video is made, not when the module loads: screens import this file just to show the sheet. */
const replayDir = () => `${DIRS.tmp}/replays`;

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export function sceneArts(scene: ReplayScene): (PanelArt | null)[] {
  return scene.parts.map(part => part.art);
}

/** Draws the scene after `step` steps, in page units. `clips` are the panel outlines, built once by the caller. */
export function drawReplayStep(canvas: SkCanvas, scene: ReplayScene, clips: SkPath[], step: number): void {
  const arts = sceneAtStep(sceneArts(scene), step);
  scene.parts.forEach((_, index) => {
    canvas.save();
    canvas.clipPath(clips[index], ClipOp.Intersect, true);
    drawArt(canvas, arts[index]);
    canvas.restore();
  });
  if (scene.framed) {
    const border = Skia.Paint();
    border.setAntiAlias(true);
    border.setStyle(PaintStyle.Stroke);
    border.setStrokeWidth(PANEL_BORDER);
    border.setStrokeJoin(StrokeJoin.Miter);
    border.setColor(Skia.Color(INK));
    clips.forEach(clip => canvas.drawPath(clip, border));
  }
}

export function sceneClips(scene: ReplayScene): SkPath[] {
  return scene.parts.map(part => polyPath(part.shape.poly));
}

/**
 * Draws the scene once per frame, each time with a few more strokes, and hands the frames to the
 * platform encoder. The video lands in the cache: the person shares or saves it from there.
 */
export async function makeReplayVideo(
  scene: ReplayScene,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<ReplayVideo> {
  const arts = sceneArts(scene);
  const frames = replayFrames(sceneSteps(arts));
  if (frames.length === 0) {
    throw new Error('There is nothing to replay yet.');
  }
  await ensureDirs();
  await Promise.all(arts.flatMap(artImageUris).map(loadImage));
  const size = replayVideoSize(scene.bbox);
  const scale = size.w / scene.bbox.w;
  const surface = Skia.Surface.Make(size.w, size.h);
  if (!surface) {
    throw new Error('Not enough memory to draw the video.');
  }
  const tmpDir = `${DIRS.tmp}/replay-${uid()}`;
  await resetDir(tmpDir);
  try {
    const clips = sceneClips(scene);
    const canvas = surface.getCanvas();
    const paths: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      if (isCancelled()) {
        throw new ReplayCancelled();
      }
      canvas.drawColor(Skia.Color(PAPER));
      canvas.save();
      canvas.scale(scale, scale);
      canvas.translate(-scene.bbox.x, -scene.bbox.y);
      drawReplayStep(canvas, scene, clips, frames[i]);
      canvas.restore();
      surface.flush();
      const image = surface.makeImageSnapshot();
      const file = `${tmpDir}/${padNumber(i + 1)}.jpg`;
      await RNFS.writeFile(file, image.encodeToBase64(ImageFormat.JPEG, 90), 'base64');
      image.dispose();
      paths.push(file);
      onProgress(i + 1, frames.length);
      await yieldToUi();
    }
    const fps = replayFps(frames.length);
    const last = paths[paths.length - 1];
    for (let i = 0; i < Math.ceil(fps * REPLAY_HOLD_SECONDS); i++) {
      paths.push(last);
    }
    // One replay is kept at a time, so the cache does not fill with videos.
    await resetDir(replayDir());
    const fileName = `manganova-replay-${dayKey()}.mp4`;
    const path = `${replayDir()}/${fileName}`;
    await framesToVideo(paths, path, fps);
    if (isCancelled()) {
      await removeFile(path);
      throw new ReplayCancelled();
    }
    return { path, fileName };
  } finally {
    surface.dispose();
    await removeFile(tmpDir);
  }
}
