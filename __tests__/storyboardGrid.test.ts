import { gridBoxes } from '../src/core/reorder/reorder';
import {
  STORYBOARD_SIZES,
  cellWidth,
  gridColumns,
  gridRows,
  gridSpecOf,
  moveArrows,
  pageLabel,
  thumbHeight,
} from '../src/core/reorder/storyboardGrid';

const { cellGap, metaHeight, pad, rowGap } = STORYBOARD_SIZES;

describe('columns', () => {
  it('keeps the phone layout below 600dp', () => {
    expect(gridColumns(360, false)).toBe(2);
    expect(gridColumns(599, false)).toBe(2);
    expect(gridColumns(360, true)).toBe(1);
  });

  it('grows with the width from 600dp', () => {
    expect(gridColumns(600, false)).toBeGreaterThan(2);
    expect(gridColumns(1200, false)).toBeGreaterThan(gridColumns(600, false));
    expect(gridColumns(600, true)).toBeGreaterThan(1);
    expect(gridColumns(1200, true)).toBeGreaterThan(gridColumns(600, true));
  });

  it('keeps facing pages together in a paged grid', () => {
    for (const width of [600, 720, 800, 960, 1280]) {
      expect(gridColumns(width, false) % 2).toBe(0);
    }
  });

  it('fits a whole row inside the padded width', () => {
    for (const width of [320, 360, 412, 600, 800, 1280]) {
      for (const webtoon of [false, true]) {
        const columns = gridColumns(width, webtoon);
        expect(cellWidth(width, columns, webtoon) * columns).toBeLessThanOrEqual(width - pad * 2 + 0.001);
      }
    }
  });
});

describe('grid sizes', () => {
  it('drives the drop boxes from the same numbers the styles use', () => {
    const width = 360;
    const columns = gridColumns(width, false);
    const spec = gridSpecOf(width, columns, false, true);
    const cell = cellWidth(width, columns, false);
    const h = thumbHeight(cell - cellGap, { w: 1000, h: 1414 }, false, Infinity);
    const boxes = gridBoxes(Array.from({ length: 3 }, () => ({ w: cell, h: h + metaHeight })), spec);
    expect(boxes[0].y).toBe(pad);
    expect(boxes[1].y).toBe(pad + h + metaHeight + rowGap);
    expect(boxes[0].x + cell / 2).toBeCloseTo(width / 2);
  });

  it('builds rows the way gridBoxes walks them', () => {
    const spec = gridSpecOf(360, 2, false, true);
    expect(gridRows([1, 2, 3, 4, 5], spec)).toEqual([[1], [2, 3], [4, 5]]);
    expect(gridRows([1, 2, 3], gridSpecOf(360, 1, true, false))).toEqual([[1], [2], [3]]);
  });

  it('puts the earlier page of a right-to-left spread on the right', () => {
    const boxes = gridBoxes(
      Array.from({ length: 3 }, () => ({ w: 100, h: 100 })),
      gridSpecOf(360, 2, false, true),
    );
    expect(boxes[1].x).toBeGreaterThan(boxes[2].x);
  });

  it('caps a webtoon thumbnail and leaves a paged one alone', () => {
    expect(thumbHeight(100, { w: 1000, h: 9000 }, true, 360)).toBe(360);
    expect(thumbHeight(100, { w: 1000, h: 9000 }, false, 360)).toBe(900);
  });
});

describe('move arrows', () => {
  it('points earlier to the right in a right-to-left book', () => {
    expect(moveArrows(false, true, false)).toEqual({ earlier: 'right', later: 'left' });
  });

  it('runs left to right when the book does', () => {
    expect(moveArrows(false, false, false)).toEqual({ earlier: 'left', later: 'right' });
  });

  it('is vertical for a strip and for the list view', () => {
    expect(moveArrows(true, false, false)).toEqual({ earlier: 'up', later: 'down' });
    expect(moveArrows(false, true, true)).toEqual({ earlier: 'up', later: 'down' });
  });
});

describe('page label', () => {
  it('reads the art for a screen reader', () => {
    expect(pageLabel(3, 4, 'Done', false)).toBe('Page 3, 4 panels, done');
    expect(pageLabel(1, 1, 'In progress', true)).toBe('Page 1, 1 panel, in progress, flagged');
  });
});
