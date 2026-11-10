import { ClipOp, ImageFormat, Skia } from '@shopify/react-native-skia';

import {
  REPLAY_HOLD_SECONDS,
  artAtStep,
  replayFps,
  replayFrames,
  replaySteps,
  replayVideoSize,
} from '../../core/art/replay';
import { artImageUris } from '../../core/art/strokes';
import { padNumber } from '../../core/export/plan';
import type { PanelShape } from '../../core/layout/layout';
import type { PanelArt } from '../../core/model/types';
import { uid } from '../../core/util/id';
import { dayKey } from '../../core/util/time';
import { DIRS, RNFS, ensureDirs, framesToVideo, removeFile, resetDir } from '../../native/files';
import { drawArt } from '../../render/drawArt';
import { polyPath } from '../../render/drawPage';
import { loadImage } from '../../render/images';
import { PAPER } from '../../render/ink';

export class ReplayCancelled extends Error {}

export type ReplayVideo = { path: string; fileName: string };

const REPLAY_DIR = `${DIRS.tmp}/replays`;

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Draws the panel once per frame, each time with a few more strokes, and hands the frames to the
 * platform encoder. The video lands in the cache: the person shares or saves it from there.
 */
export async function makeReplayVideo(
  art: PanelArt,
  shape: PanelShape,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<ReplayVideo> {
  const frames = replayFrames(replaySteps(art));
  if (frames.length === 0) {
    throw new Error('There is nothing to replay yet.');
  }
  await ensureDirs();
  await Promise.all(artImageUris(art).map(loadImage));
  const size = replayVideoSize(shape.bbox);
  const scale = size.w / shape.bbox.w;
  const surface = Skia.Surface.Make(size.w, size.h);
  if (!surface) {
    throw new Error('Not enough memory to draw the video.');
  }
  const tmpDir = `${DIRS.tmp}/replay-${uid()}`;
  await resetDir(tmpDir);
  try {
    const clip = polyPath(shape.poly);
    const canvas = surface.getCanvas();
    const paths: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      if (isCancelled()) {
        throw new ReplayCancelled();
      }
      canvas.drawColor(Skia.Color(PAPER));
      canvas.save();
      canvas.scale(scale, scale);
      canvas.translate(-shape.bbox.x, -shape.bbox.y);
      canvas.clipPath(clip, ClipOp.Intersect, true);
      drawArt(canvas, artAtStep(art, frames[i]));
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
    await resetDir(REPLAY_DIR);
    const fileName = `manganova-replay-${dayKey()}.mp4`;
    const path = `${REPLAY_DIR}/${fileName}`;
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
