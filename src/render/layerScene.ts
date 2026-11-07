import type { SkPicture } from '@shopify/react-native-skia';

import type { ArtLayer, LayerImage, Stroke } from '../core/model/types';
import { drawLayerImage, drawStroke, recordPicture } from './drawArt';

/** A sealed picture holds this many strokes and is never recorded again. */
export const SEAL_SIZE = 128;

/**
 * One layer as the canvas draws it. Strokes are immutable within a generation, so a sealed picture stays
 * valid for as long as the generation lives and the head stays past it. After a stroke only the tail
 * is recorded again, plus one drawPicture call per sealed group.
 */
export type LayerScene = {
  gen: number;
  count: number;
  image: LayerImage | undefined;
  imageRev: number;
  sealed: SkPicture[];
  tail: Stroke[];
  picture: SkPicture;
};

function sealStrokes(strokes: Stroke[]): SkPicture {
  return recordPicture(canvas => strokes.forEach(stroke => drawStroke(canvas, stroke)));
}

function compose(image: LayerImage | undefined, sealed: SkPicture[], tail: Stroke[]): SkPicture {
  return recordPicture(canvas => {
    drawLayerImage(canvas, { image });
    sealed.forEach(picture => canvas.drawPicture(picture));
    tail.forEach(stroke => drawStroke(canvas, stroke));
  });
}

export function syncLayerScene(layer: ArtLayer, prev: LayerScene | undefined, imageRev: number): LayerScene {
  const gen = layer.gen ?? 0;
  const count = layer.strokes.length;
  const sameStrokes = prev?.gen === gen && prev.count === count;
  const sameImage = prev?.image === layer.image && (!layer.image || prev?.imageRev === imageRev);
  if (prev && sameStrokes && sameImage) {
    return prev;
  }
  const keep = prev?.gen === gen ? Math.min(prev.sealed.length, Math.floor(count / SEAL_SIZE)) : 0;
  const sealed = prev ? prev.sealed.slice(0, keep) : [];
  while ((sealed.length + 1) * SEAL_SIZE <= count) {
    const from = sealed.length * SEAL_SIZE;
    sealed.push(sealStrokes(layer.strokes.slice(from, from + SEAL_SIZE)));
  }
  const tail = layer.strokes.slice(sealed.length * SEAL_SIZE);
  return { gen, count, image: layer.image, imageRev, sealed, tail, picture: compose(layer.image, sealed, tail) };
}

export function appendToScene(scene: LayerScene, ...strokes: Stroke[]): LayerScene {
  let { sealed, tail } = scene;
  for (const stroke of strokes) {
    tail = [...tail, stroke];
    if (tail.length === SEAL_SIZE) {
      sealed = [...sealed, sealStrokes(tail)];
      tail = [];
    }
  }
  return {
    ...scene,
    count: scene.count + strokes.length,
    sealed,
    tail,
    picture: compose(scene.image, sealed, tail),
  };
}
