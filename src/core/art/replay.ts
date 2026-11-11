import type { ArtLayer, PanelArt } from '../model/types';

/**
 * Replaying a drawing shows its strokes in the order they sit in the layers, bottom layer first.
 * A layer's imported image counts as one step, before that layer's strokes.
 */

export const REPLAY_MAX_FRAMES = 240;

/** How long the finished drawing stays on screen at the end of a video. */
export const REPLAY_HOLD_SECONDS = 1.2;

const REPLAY_TARGET_SECONDS = 8;
const REPLAY_MIN_FPS = 6;
const REPLAY_MAX_FPS = 30;

function layerSteps(layer: ArtLayer): number {
  return layer.visible ? (layer.image ? 1 : 0) + layer.strokes.length : 0;
}

export function replaySteps(art: PanelArt | null): number {
  return art ? art.layers.reduce((sum, layer) => sum + layerSteps(layer), 0) : 0;
}

/** The drawing as it was after `step` steps. Stroke objects are kept, so their cached paths are reused. */
export function artAtStep(art: PanelArt, step: number): PanelArt {
  let left = Math.max(0, Math.floor(step));
  const layers: ArtLayer[] = [];
  for (const layer of art.layers) {
    if (left <= 0) {
      break;
    }
    if (!layer.visible) {
      continue;
    }
    const strokes = layer.strokes.slice(0, Math.max(0, left - (layer.image ? 1 : 0)));
    layers.push({ ...layer, strokes });
    left -= layerSteps(layer);
  }
  return { layers };
}

/** Several panels play one after another, in the order given: a page replays in reading order. */
export function sceneSteps(parts: readonly (PanelArt | null)[]): number {
  return parts.reduce((sum, art) => sum + replaySteps(art), 0);
}

/** Each panel as it was after `step` steps of the whole scene. Panels not reached yet are empty. */
export function sceneAtStep(parts: readonly (PanelArt | null)[], step: number): PanelArt[] {
  let left = Math.max(0, Math.floor(step));
  return parts.map(art => {
    if (!art) {
      return { layers: [] };
    }
    const shown = artAtStep(art, left);
    left = Math.max(0, left - replaySteps(art));
    return shown;
  });
}

/** The step shown by each frame: every step when they fit, evenly spread when they do not. Ends on the full drawing. */
export function replayFrames(total: number, maxFrames = REPLAY_MAX_FRAMES): number[] {
  if (total <= 0) {
    return [];
  }
  const count = Math.min(total, Math.max(1, maxFrames));
  return Array.from({ length: count }, (_, index) => Math.round(((index + 1) * total) / count));
}

/** Few strokes play slowly enough to follow, many play at full speed. */
export function replayFps(frameCount: number): number {
  return Math.max(REPLAY_MIN_FPS, Math.min(REPLAY_MAX_FPS, Math.ceil(frameCount / REPLAY_TARGET_SECONDS)));
}

/** Video encoders need even sides. The longer side becomes `maxSide`. */
export function replayVideoSize(box: { w: number; h: number }, maxSide = 1080): { w: number; h: number } {
  const scale = maxSide / Math.max(box.w, box.h);
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { w: even(box.w), h: even(box.h) };
}
