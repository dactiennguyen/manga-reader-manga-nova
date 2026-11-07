import {
  edgeVelocity,
  gridBoxes,
  insertionIndex,
  locateIn,
  moveAcross,
  moveItem,
  nearestIndex,
  nearestSection,
  previewOffsets,
  sameSlot,
  type GridSpec,
} from '../src/core/reorder/reorder';

const size = { w: 100, h: 150 };
const manga: GridSpec = { width: 300, pad: 10, gap: 10, columns: 2, firstSolo: true, rtl: true };

describe('moveItem', () => {
  it('moves forward and backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('clamps the target and ignores a bad source', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 5, 0)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a'], 0, 0)).toEqual(['a']);
  });
});

describe('gridBoxes', () => {
  it('lays manga pages right to left with a solo first page', () => {
    const boxes = gridBoxes([size, size, size, size], manga);
    expect(boxes[0]).toEqual({ x: 100, y: 10, w: 100, h: 150 });
    expect(boxes[1]).toEqual({ x: 150, y: 170, w: 100, h: 150 });
    expect(boxes[2]).toEqual({ x: 50, y: 170, w: 100, h: 150 });
    expect(boxes[3]).toEqual({ x: 100, y: 330, w: 100, h: 150 });
  });

  it('lays left to right when not rtl', () => {
    const boxes = gridBoxes([size, size, size], { ...manga, rtl: false });
    expect(boxes[1].x).toBe(50);
    expect(boxes[2].x).toBe(150);
  });

  it('stacks a single column with varying heights', () => {
    const boxes = gridBoxes([size, { w: 100, h: 300 }, size], { ...manga, columns: 1, firstSolo: false, rtl: false });
    expect(boxes.map(box => box.y)).toEqual([10, 170, 480]);
    expect(gridBoxes([], manga)).toEqual([]);
  });
});

describe('nearestIndex', () => {
  const boxes = gridBoxes([size, size, size, size], manga);

  it('picks the slot under the point', () => {
    expect(nearestIndex(boxes, 150, 60)).toBe(0);
    expect(nearestIndex(boxes, 220, 250)).toBe(1);
    expect(nearestIndex(boxes, 80, 250)).toBe(2);
    expect(nearestIndex(boxes, 150, 2000)).toBe(3);
    expect(nearestIndex([], 0, 0)).toBe(-1);
  });
});

describe('previewOffsets', () => {
  it('returns zero offsets when nothing moves', () => {
    expect(previewOffsets([size, size, size], manga, 1, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('shifts the items between source and target', () => {
    const offsets = previewOffsets([size, size, size, size], manga, 3, 1);
    expect(offsets[0]).toEqual({ x: 0, y: 0 });
    expect(offsets[1]).toEqual({ x: -100, y: 0 });
    expect(offsets[2]).toEqual({ x: 50, y: 160 });
    expect(offsets[3]).toEqual({ x: 50, y: -160 });
  });

  it('accounts for different heights in a single column', () => {
    const spec = { ...manga, columns: 1, firstSolo: false, rtl: false };
    const offsets = previewOffsets([size, { w: 100, h: 300 }, size], spec, 0, 2);
    expect(offsets).toEqual([
      { x: 0, y: 470 },
      { x: 0, y: -160 },
      { x: 0, y: -160 },
    ]);
  });
});

describe('insertionIndex and nearestSection', () => {
  const boxes = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 0, y: 110, w: 100, h: 60 },
  ];

  it('finds the slot between cards', () => {
    expect(insertionIndex(boxes, -20)).toBe(0);
    expect(insertionIndex(boxes, 49)).toBe(0);
    expect(insertionIndex(boxes, 51)).toBe(1);
    expect(insertionIndex(boxes, 500)).toBe(2);
    expect(insertionIndex([], 10)).toBe(0);
  });

  it('finds the closest section', () => {
    const zones = [
      { x: 0, y: 0, w: 100, h: 400 },
      { x: 120, y: 0, w: 100, h: 400 },
    ];
    expect(nearestSection(zones, 50, 50)).toBe(0);
    expect(nearestSection(zones, 115, 50)).toBe(1);
    expect(nearestSection(zones, 900, 900)).toBe(1);
    expect(nearestSection([], 0, 0)).toBe(-1);
  });
});

describe('moveAcross', () => {
  const acts = [['a', 'b', 'c'], ['d'], []];

  it('reorders inside a section using the index without the moved item', () => {
    expect(moveAcross(acts, 'a', { section: 0, index: 2 })).toEqual([['b', 'c', 'a'], ['d'], []]);
    expect(moveAcross(acts, 'c', { section: 0, index: 0 })).toEqual([['c', 'a', 'b'], ['d'], []]);
  });

  it('moves into another section, including an empty one', () => {
    expect(moveAcross(acts, 'b', { section: 1, index: 0 })).toEqual([['a', 'c'], ['b', 'd'], []]);
    expect(moveAcross(acts, 'b', { section: 2, index: 5 })).toEqual([['a', 'c'], ['d'], ['b']]);
  });

  it('keeps the story order consistent and ignores unknown targets', () => {
    expect(moveAcross(acts, 'd', { section: 0, index: 1 }).flat()).toEqual(['a', 'd', 'b', 'c']);
    expect(moveAcross(acts, 'x', { section: 0, index: 0 })).toEqual(acts);
    expect(moveAcross(acts, 'a', { section: 9, index: 0 })).toEqual(acts);
  });

  it('detects a drop in the same place', () => {
    expect(sameSlot(locateIn(acts, 'b'), { section: 0, index: 1 })).toBe(true);
    expect(sameSlot(locateIn(acts, 'b'), { section: 1, index: 1 })).toBe(false);
    expect(sameSlot(locateIn(acts, 'x'), { section: 0, index: 0 })).toBe(false);
  });
});

describe('edgeVelocity', () => {
  it('scrolls only near the edges and scales with depth', () => {
    expect(edgeVelocity(300, 600, 80, 12)).toBe(0);
    expect(edgeVelocity(40, 600, 80, 12)).toBe(-6);
    expect(edgeVelocity(-50, 600, 80, 12)).toBe(-12);
    expect(edgeVelocity(560, 600, 80, 12)).toBe(6);
    expect(edgeVelocity(900, 600, 80, 12)).toBe(12);
    expect(edgeVelocity(10, 0, 80, 12)).toBe(0);
  });
});
