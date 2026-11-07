import {
  buildSpreads,
  firstPageOfSpread,
  slotAtPoint,
  spreadIndexOfPage,
  spreadLabel,
} from '../src/core/preview/spreads';

describe('buildSpreads', () => {
  it('keeps every page alone when spread view is off', () => {
    expect(buildSpreads(['a', 'b', 'c'], false)).toEqual([['a'], ['b'], ['c']]);
  });

  it('leaves page 1 alone and pairs the rest like the storyboard', () => {
    expect(buildSpreads(['1', '2', '3', '4', '5'], true)).toEqual([['1'], ['2', '3'], ['4', '5']]);
  });

  it('leaves a trailing page alone when the count is even', () => {
    expect(buildSpreads(['1', '2', '3', '4'], true)).toEqual([['1'], ['2', '3'], ['4']]);
  });

  it('handles empty and single page chapters', () => {
    expect(buildSpreads([], true)).toEqual([]);
    expect(buildSpreads(['1'], true)).toEqual([['1']]);
  });
});

describe('spread lookups', () => {
  const groups = buildSpreads(['1', '2', '3', '4', '5', '6'], true);

  it('finds the spread that holds a page', () => {
    expect([0, 1, 2, 3, 4, 5].map(i => spreadIndexOfPage(groups, i))).toEqual([0, 1, 1, 2, 2, 3]);
    expect(spreadIndexOfPage(groups, 99)).toBe(3);
    expect(spreadIndexOfPage([], 0)).toBe(0);
  });

  it('finds the first page of a spread', () => {
    expect([0, 1, 2, 3].map(i => firstPageOfSpread(groups, i))).toEqual([0, 1, 3, 5]);
    expect(firstPageOfSpread(groups, 4)).toBe(6);
  });

  it('round trips between single and spread positions', () => {
    const singles = buildSpreads(['1', '2', '3', '4', '5', '6'], false);
    const page = firstPageOfSpread(groups, 2);
    expect(spreadIndexOfPage(singles, page)).toBe(3);
    expect(spreadIndexOfPage(groups, firstPageOfSpread(singles, 4))).toBe(2);
  });
});

describe('spreadLabel', () => {
  const groups = buildSpreads(['1', '2', '3', '4', '5', '6'], true);

  it('labels single pages and spreads', () => {
    expect(spreadLabel(groups, 0, 6)).toBe('1 / 6');
    expect(spreadLabel(groups, 1, 6)).toBe('2–3 / 6');
    expect(spreadLabel(groups, 3, 6)).toBe('6 / 6');
  });

  it('clamps past the last spread and handles empty chapters', () => {
    expect(spreadLabel(groups, 4, 6)).toBe('6 / 6');
    expect(spreadLabel([], 0, 0)).toBe('0 / 0');
  });
});

describe('slotAtPoint', () => {
  it('counts slots from the right for right-to-left spreads', () => {
    expect(slotAtPoint(350, 200, 2, 2, true)).toBe(0);
    expect(slotAtPoint(50, 200, 2, 2, true)).toBe(1);
  });

  it('counts slots from the left otherwise', () => {
    expect(slotAtPoint(50, 200, 2, 2, false)).toBe(0);
    expect(slotAtPoint(350, 200, 2, 2, false)).toBe(1);
  });

  it('falls back to the only page of a half-empty spread', () => {
    expect(slotAtPoint(50, 200, 2, 1, true)).toBe(0);
    expect(slotAtPoint(-20, 200, 1, 1, true)).toBe(0);
  });
});
