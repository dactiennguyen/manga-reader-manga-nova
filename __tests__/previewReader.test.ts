import { buildSpreads } from '../src/core/preview/spreads';
import {
  clampItem,
  fitPage,
  itemMetrics,
  itemOfPage,
  itemOfSliderValue,
  pageLabel,
  readerTap,
  sliderValueOfItem,
} from '../src/core/preview/reader';

describe('itemMetrics', () => {
  it('builds the offsets getItemLayout reads', () => {
    expect(itemMetrics([100, 250, 420])).toEqual({ lengths: [100, 250, 420], offsets: [0, 100, 350], total: 770 });
  });

  it('handles an empty list', () => {
    expect(itemMetrics([])).toEqual({ lengths: [], offsets: [], total: 0 });
  });
});

describe('fitPage', () => {
  const page = { w: 1000, h: 1412 };

  it('fills the width in portrait', () => {
    expect(fitPage({ w: 400, h: 800 }, page, 1)).toEqual({ w: 400, h: 565 });
  });

  it('is limited by the height in landscape', () => {
    expect(fitPage({ w: 800, h: 400 }, page, 2)).toEqual({ w: 283, h: 400 });
  });

  it('gives each slot half the width when that is the tighter side', () => {
    expect(fitPage({ w: 500, h: 800 }, page, 2)).toEqual({ w: 250, h: 353 });
  });
});

describe('readerTap', () => {
  it('turns forward in the left quarter and back in the right quarter', () => {
    expect(readerTap(99, 400, true, false)).toBe('next');
    expect(readerTap(301, 400, true, false)).toBe('previous');
  });

  it('toggles the controls in the middle, including on the zone edges', () => {
    expect(readerTap(100, 400, true, false)).toBe('controls');
    expect(readerTap(200, 400, true, false)).toBe('controls');
    expect(readerTap(300, 400, true, false)).toBe('controls');
  });

  it('never turns the page while zoomed or on a webtoon', () => {
    expect(readerTap(10, 400, true, true)).toBe('controls');
    expect(readerTap(390, 400, true, true)).toBe('controls');
    expect(readerTap(10, 400, false, false)).toBe('controls');
  });
});

describe('position across rotation', () => {
  const ids = ['1', '2', '3', '4', '5', '6'];

  it('lands on the spread holding the page being read', () => {
    const spreads = buildSpreads(ids, true);
    expect(itemOfPage(spreads, 3, ids.length)).toBe(2);
    expect(itemOfPage(buildSpreads(ids, false), 3, ids.length)).toBe(3);
  });

  it('keeps the end card when the reader was on it', () => {
    const spreads = buildSpreads(ids, true);
    expect(itemOfPage(spreads, ids.length, ids.length)).toBe(spreads.length);
  });
});

describe('clampItem', () => {
  it('stays inside the list', () => {
    expect(clampItem(-1, 5)).toBe(0);
    expect(clampItem(9, 5)).toBe(4);
    expect(clampItem(2, 5)).toBe(2);
  });
});

describe('page slider', () => {
  it('is a round trip in both reading directions', () => {
    for (const rtl of [true, false]) {
      for (let shown = 1; shown <= 6; shown++) {
        expect(itemOfSliderValue(sliderValueOfItem(shown, 6, rtl), 6, rtl)).toBe(shown - 1);
      }
    }
  });

  it('puts page 1 at the right end for manga', () => {
    expect(sliderValueOfItem(1, 6, true)).toBe(6);
    expect(sliderValueOfItem(1, 6, false)).toBe(1);
  });
});

describe('pageLabel', () => {
  it('says what a screen reader cannot see', () => {
    expect(pageLabel(3, 4, true, false)).toBe('Page 3, 4 panels, done');
    expect(pageLabel(1, 1, false, true)).toBe('Page 1, 1 panel, not done, flagged');
  });
});
