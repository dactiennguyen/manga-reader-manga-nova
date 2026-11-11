import { IDENTITY_AFFINE, moveBy } from '../src/core/art/affine';
import type { ArtLayer, Stroke } from '../src/core/model/types';
import {
  buildSelectionScene,
  extendLasso,
  recordSelectionFrame,
  recordSelectionScene,
  type LassoTrail,
} from '../src/render/selectionScene';
import { counters, type FakePath, type FakePicture } from './helpers/fakeSkia';

jest.mock('@shopify/react-native-skia', () => require('./helpers/fakeSkia'));
// No image is decoded here. The scene only has to keep a place for it.
jest.mock('../src/render/images', () => ({ getImage: () => null }));

const stroke = (x: number): Stroke => ({ tool: 'pencil', color: '#000000', size: 2, opacity: 1, points: [x, 0, x, 9] });

const layer: ArtLayer = {
  id: 'l',
  name: 'L',
  visible: true,
  opacity: 1,
  locked: false,
  strokes: [0, 1, 2, 3, 4, 5].map(stroke),
};

const box = { x: 0, y: 0, w: 10, h: 10 };

type Draw = { picture?: FakePicture; save?: true; restore?: true; concat?: { values: number[] } };

const draws = (picture: unknown) => (picture as FakePicture).draws as Draw[];

describe('selection scene', () => {
  it('splits the layer into pictures of selected and unselected stretches, in drawing order', () => {
    const scene = buildSelectionScene(layer, [1, 2, 5], box);
    expect(scene.layerId).toBe('l');
    expect(scene.moving).toEqual([false, true, false, true]);
    expect(scene.runs.map(run => draws(run).length)).toEqual([1, 2, 2, 1]);
  });

  it('keeps the layer image still, under everything', () => {
    const scene = buildSelectionScene({ ...layer, image: { uri: 'x', x: 0, y: 0, w: 5, h: 5 } }, [0], box);
    expect(scene.moving).toEqual([false, true, false]);
    expect(draws(scene.runs[0])).toHaveLength(0);
  });

  it('replays the pictures each frame and builds no path, with only the selected ones under the transform', () => {
    const scene = buildSelectionScene(layer, [1, 2, 5], box);
    const before = counters.drawPath;
    const frame = draws(recordSelectionScene(scene, moveBy(30, 40)));
    expect(counters.drawPath).toBe(before);
    expect(frame.map(item => Object.keys(item)[0])).toEqual([
      'picture',
      'save',
      'concat',
      'picture',
      'restore',
      'picture',
      'save',
      'concat',
      'picture',
      'restore',
    ]);
    expect(frame[0].picture).toBe(scene.runs[0]);
    expect(frame[3].picture).toBe(scene.runs[1]);
    // Row-major, as Skia reads a 3x3 matrix.
    expect(frame[2].concat?.values).toEqual([1, 0, 30, 0, 1, 40, 0, 0, 1]);
  });

  it('draws a frame for the selection', () => {
    const before = counters.drawPath;
    recordSelectionFrame(box, IDENTITY_AFFINE, 1, 36, '#FF0000');
    expect(counters.drawPath - before).toBe(1);
  });
});

describe('lasso trail', () => {
  const verbs = (trail: LassoTrail) => (trail.path as unknown as FakePath).verbs;

  it('adds only the points that are new', () => {
    const first = extendLasso(null, [1, 2]);
    expect(verbs(first)).toEqual([['move', 1, 2]]);
    const next = extendLasso(first, [1, 2, 3, 4, 5, 6]);
    expect(verbs(next)).toEqual([
      ['move', 1, 2],
      ['line', 3, 4],
      ['line', 5, 6],
    ]);
    expect(next.fed).toBe(6);
  });

  it('starts over when the points belong to a new lasso', () => {
    const old = extendLasso(null, [1, 2, 3, 4, 5, 6]);
    expect(verbs(extendLasso(old, [9, 9]))).toEqual([['move', 9, 9]]);
  });
});
