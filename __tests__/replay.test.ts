import {
  artAtStep,
  replayFps,
  replayFrames,
  replaySteps,
  replayVideoSize,
  sceneAtStep,
  sceneSteps,
} from '../src/core/art/replay';
import type { ArtLayer, PanelArt, Stroke } from '../src/core/model/types';

const stroke = (n: number): Stroke => ({ tool: 'gpen', color: '#000', size: n, opacity: 1, points: [0, 0, n, n] });

const layer = (id: string, strokes: number, patch: Partial<ArtLayer> = {}): ArtLayer => ({
  id,
  name: id,
  visible: true,
  opacity: 1,
  locked: false,
  strokes: Array.from({ length: strokes }, (_, i) => stroke(i + 1)),
  ...patch,
});

const image = { uri: 'images/a.webp', x: 0, y: 0, w: 10, h: 10 };

const art: PanelArt = {
  layers: [layer('sketch', 3), layer('hidden', 5, { visible: false }), layer('ink', 2, { image })],
  activeLayerId: 'ink',
};

describe('replay steps', () => {
  it('counts strokes and images of visible layers only', () => {
    expect(replaySteps(art)).toBe(3 + 1 + 2);
    expect(replaySteps(null)).toBe(0);
  });

  it('builds the drawing bottom layer first', () => {
    expect(artAtStep(art, 0).layers).toEqual([]);
    const two = artAtStep(art, 2);
    expect(two.layers.map(item => [item.id, item.strokes.length])).toEqual([['sketch', 2]]);
    expect(two.layers[0].strokes[0]).toBe(art.layers[0].strokes[0]);
  });

  it('shows a layer image as one step before its strokes', () => {
    const four = artAtStep(art, 4);
    expect(four.layers.map(item => [item.id, item.strokes.length, !!item.image])).toEqual([
      ['sketch', 3, false],
      ['ink', 0, true],
    ]);
    expect(artAtStep(art, 5).layers[1].strokes).toHaveLength(1);
  });

  it('ends on every visible layer in full, and never shows a hidden one', () => {
    const full = artAtStep(art, replaySteps(art) + 10);
    expect(full.layers.map(item => [item.id, item.strokes.length])).toEqual([
      ['sketch', 3],
      ['ink', 2],
    ]);
  });
});

describe('replay frames', () => {
  it('uses one frame per step when they fit', () => {
    expect(replayFrames(4)).toEqual([1, 2, 3, 4]);
    expect(replayFrames(0)).toEqual([]);
  });

  it('spreads many steps over the frame limit and ends on the last step', () => {
    const frames = replayFrames(1000, 240);
    expect(frames).toHaveLength(240);
    expect(frames[frames.length - 1]).toBe(1000);
    frames.forEach((value, index) => index && expect(value).toBeGreaterThan(frames[index - 1]));
  });

  it('plays short drawings slowly and long ones at 30 fps', () => {
    expect(replayFps(10)).toBe(6);
    expect(replayFps(120)).toBe(15);
    expect(replayFps(240)).toBe(30);
  });

  it('gives the video even sides with the longer one at the limit', () => {
    expect(replayVideoSize({ w: 912, h: 437 })).toEqual({ w: 1080, h: 518 });
    expect(replayVideoSize({ w: 300, h: 901 })).toEqual({ w: 360, h: 1080 });
  });
});

describe('replaying several panels', () => {
  const first: PanelArt = { layers: [layer('a', 2)] };
  const second: PanelArt = { layers: [layer('b', 3)] };

  it('adds up the steps and skips a panel with no drawing', () => {
    expect(sceneSteps([first, null, second])).toBe(5);
  });

  it('finishes one panel before starting the next', () => {
    const count = (step: number) => sceneAtStep([first, null, second], step).map(art => art.layers[0]?.strokes.length ?? 0);
    expect(count(0)).toEqual([0, 0, 0]);
    expect(count(1)).toEqual([1, 0, 0]);
    expect(count(2)).toEqual([2, 0, 0]);
    expect(count(4)).toEqual([2, 0, 2]);
    expect(count(99)).toEqual([2, 0, 3]);
  });
});
