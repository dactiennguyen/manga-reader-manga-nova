import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { padNumber } from '../../core/export/plan';
import type { ID } from '../../core/model/types';
import { inkOf, isStillFrame, planTrailer, type TrailerPlan } from '../../core/studio/trailer';
import { uid } from '../../core/util/id';
import { dayKey } from '../../core/util/time';
import { DIRS, RNFS, ensureDirs, framesToVideo, removeFile, resetDir } from '../../native/files';
import { loadArt } from '../../state/artStore';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import {
  TrailerCancelled,
  disposeTrailerAssets,
  drawTrailerFrame,
  loadTrailerAssets,
  type TrailerAssets,
} from './trailerFrame';

export { TrailerCancelled };

export type TrailerVideo = { path: string; fileName: string };

/** Read when a video is made, not when the module loads: Home imports this file just to show the sheet. */
const trailerDir = () => `${DIRS.tmp}/trailers`;

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** The trailer of a story as it is now, or null when nothing is drawn yet. */
export function trailerPlanFor(projectId: ID): TrailerPlan | null {
  return planTrailer({
    state: useStory.getState(),
    projectId,
    penName: useSettings.getState().penName,
    strokesOf: panelId => inkOf(loadArt(panelId)),
  });
}

/**
 * Draws every frame offscreen and hands them to the platform encoder, like the drawing replay. The still
 * middle of the title and end cards is written once and repeated. The video lands in the cache, one at a
 * time; the person saves or shares it from there.
 */
export async function makeTrailerVideo(
  plan: TrailerPlan,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
  /** Panels already cut for the preview. They stay with the caller. */
  ready?: TrailerAssets,
): Promise<TrailerVideo> {
  await ensureDirs();
  const assets = ready ?? (await loadTrailerAssets(plan, isCancelled));
  const release = () => {
    if (!ready) {
      disposeTrailerAssets(assets);
    }
  };
  const surface = Skia.Surface.Make(plan.size.w, plan.size.h);
  if (!surface) {
    release();
    throw new Error('Not enough memory to draw the video.');
  }
  const tmpDir = `${DIRS.tmp}/trailer-${uid()}`;
  await resetDir(tmpDir);
  try {
    const canvas = surface.getCanvas();
    const paths: string[] = [];
    let still: { shot: number; path: string } | null = null;
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      if (isCancelled()) {
        throw new TrailerCancelled();
      }
      const shot = plan.shots.findIndex(item => frame < item.start + item.frames);
      if (still && still.shot === shot && isStillFrame(plan, frame)) {
        paths.push(still.path);
        onProgress(frame + 1, plan.totalFrames);
        continue;
      }
      drawTrailerFrame(canvas, plan, assets, frame);
      surface.flush();
      const image = surface.makeImageSnapshot();
      const file = `${tmpDir}/${padNumber(frame + 1)}.jpg`;
      await RNFS.writeFile(file, image.encodeToBase64(ImageFormat.JPEG, 88), 'base64');
      image.dispose();
      paths.push(file);
      still = isStillFrame(plan, frame) ? { shot, path: file } : null;
      onProgress(frame + 1, plan.totalFrames);
      await yieldToUi();
    }
    await resetDir(trailerDir());
    const fileName = `manganova-trailer-${dayKey()}.mp4`;
    const path = `${trailerDir()}/${fileName}`;
    await framesToVideo(paths, path, plan.fps);
    if (isCancelled()) {
      await removeFile(path);
      throw new TrailerCancelled();
    }
    return { path, fileName };
  } finally {
    surface.dispose();
    release();
    await removeFile(tmpDir);
  }
}
