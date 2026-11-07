import type { ArtLayer, Stroke } from '../src/core/model/types';
import { SEAL_SIZE, appendToScene, syncLayerScene } from '../src/render/layerScene';
import { counters, type FakePicture } from './helpers/fakeSkia';

jest.mock('@shopify/react-native-skia', () => require('./helpers/fakeSkia'));

const stroke = (x: number): Stroke => ({ tool: 'pencil', color: '#000000', size: 2, opacity: 1, points: [x, 0, x, 9] });

const layer = (count: number, gen = 0): ArtLayer => ({
  id: 'l',
  name: 'L',
  visible: true,
  opacity: 1,
  locked: false,
  gen,
  head: count,
  strokes: Array.from({ length: count }, (_, i) => stroke(i)),
});

const picturesIn = (picture: unknown) => (picture as FakePicture).draws;

describe('layer scene', () => {
  it('groups strokes into sealed pictures with a short tail', () => {
    const scene = syncLayerScene(layer(300), undefined, 0);
    expect(scene.sealed).toHaveLength(2);
    expect(scene.tail).toHaveLength(300 - 2 * SEAL_SIZE);
    expect(picturesIn(scene.picture)).toHaveLength(2 + scene.tail.length);
  });

  it('records only the tail after a new stroke', () => {
    const scene = syncLayerScene(layer(130), undefined, 0);
    const before = counters.drawPath;
    const next = appendToScene(scene, stroke(999));
    expect(counters.drawPath - before).toBe(3);
    expect(next.sealed).toBe(scene.sealed);
    expect(next.count).toBe(131);
  });

  it('seals when the tail fills up, and does not redraw sealed strokes afterwards', () => {
    let scene = syncLayerScene(layer(SEAL_SIZE - 1), undefined, 0);
    expect(scene.sealed).toHaveLength(0);
    scene = appendToScene(scene, stroke(1));
    expect(scene.sealed).toHaveLength(1);
    expect(scene.tail).toHaveLength(0);
    const before = counters.drawPath;
    scene = appendToScene(scene, stroke(2));
    expect(counters.drawPath - before).toBe(1);
  });

  it('keeps sealed pictures through an undo that stays past them', () => {
    const scene = syncLayerScene(layer(200), undefined, 0);
    const undone = syncLayerScene(layer(190), scene, 0);
    expect(undone.sealed[0]).toBe(scene.sealed[0]);
    expect(undone.tail).toHaveLength(190 - SEAL_SIZE);
  });

  it('drops a sealed picture an undo reaches into', () => {
    const scene = syncLayerScene(layer(200), undefined, 0);
    const undone = syncLayerScene(layer(100), scene, 0);
    expect(undone.sealed).toHaveLength(0);
    expect(undone.tail).toHaveLength(100);
  });

  it('rebuilds everything on a new generation', () => {
    const scene = syncLayerScene(layer(200), undefined, 0);
    const moved = syncLayerScene(layer(200, 1), scene, 0);
    expect(moved.sealed[0]).not.toBe(scene.sealed[0]);
    expect(moved.gen).toBe(1);
  });

  it('returns the same scene when nothing changed', () => {
    const scene = syncLayerScene(layer(10), undefined, 0);
    expect(syncLayerScene(layer(10), scene, 5)).toBe(scene);
  });
});
