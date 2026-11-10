import {
  EXPORT_HISTORY_LIMIT,
  addExportRecord,
  exportHistoryKey,
  parseExportHistory,
  removeExportRecord,
  type ExportRecord,
} from '../src/core/export/history';
import {
  PDF_PAGE_WIDTH_PT,
  extraPageCount,
  longSegments,
  padNumber,
  pageImageWidth,
  resolveOptions,
  socialPageWidth,
  socialPlacement,
  type ExportOptions,
} from '../src/core/export/plan';

const form: ExportOptions = {
  format: 'pdf',
  quality: 1,
  spread: false,
  cover: false,
  info: false,
  penName: '',
  longWidth: 800,
  autoCut: true,
  gap: 0,
  socialShape: 'square',
  signature: false,
  lang: null,
};

const record = (path: string, createdAt = 1): ExportRecord => ({
  path,
  fileName: path,
  mime: 'application/pdf',
  size: 10,
  pages: 2,
  format: 'pdf',
  createdAt,
});

describe('PDF page width', () => {
  it('follows the paper size', () => {
    expect(PDF_PAGE_WIDTH_PT.B5).toBe(516);
    expect(PDF_PAGE_WIDTH_PT.A5).toBe(420);
  });
});

describe('export plan', () => {
  it('maps quality to pixels', () => {
    expect(pageImageWidth(1)).toBe(1200);
    expect(pageImageWidth(2)).toBe(2400);
  });

  it('pads page files so they sort in reading order', () => {
    expect(padNumber(7)).toBe('007');
    expect(padNumber(1234)).toBe('1234');
  });

  it('counts the cover and info pages, except for the long image', () => {
    expect(extraPageCount({ format: 'pdf', cover: true, info: true })).toBe(2);
    expect(extraPageCount({ format: 'png', cover: true, info: false })).toBe(1);
    expect(extraPageCount({ format: 'long', cover: true, info: true })).toBe(0);
  });

  it('keeps the info page only for PDF', () => {
    expect(resolveOptions({ ...form, info: true }, []).info).toBe(true);
    expect(resolveOptions({ ...form, format: 'cbz', info: true }, []).info).toBe(false);
  });

  it('drops a language the story no longer has', () => {
    expect(resolveOptions({ ...form, lang: 'French' }, ['French']).lang).toBe('French');
    expect(resolveOptions({ ...form, lang: 'French' }, ['German']).lang).toBeNull();
  });
});

describe('longSegments', () => {
  it('fills a strip up to the limit, counting the gap', () => {
    expect(longSegments([1000, 1000, 1000], 100, 2200)).toEqual([
      { indices: [0, 1], height: 2100 },
      { indices: [2], height: 1000 },
    ]);
  });

  it('accepts a strip exactly at the limit', () => {
    expect(longSegments([2000, 2000], 0, 4000)).toEqual([{ indices: [0, 1], height: 4000 }]);
  });

  it('gives a page taller than the limit its own strip', () => {
    expect(longSegments([100, 5000, 100], 0, 4000)).toEqual([
      { indices: [0], height: 100 },
      { indices: [1], height: 5000 },
      { indices: [2], height: 100 },
    ]);
  });

  it('leaves out pages that have no height', () => {
    expect(longSegments([0, 500, 0], 24, 4000)).toEqual([{ indices: [1], height: 500 }]);
    expect(longSegments([0], 24, 4000)).toEqual([]);
  });
});

describe('export history', () => {
  it('is keyed per story', () => {
    expect(exportHistoryKey('p1')).toBe('exports:p1');
  });

  it('puts the newest first and keeps the limit', () => {
    let history: ExportRecord[] = [];
    for (let i = 0; i < EXPORT_HISTORY_LIMIT + 2; i++) {
      history = addExportRecord(history, record(`exports/p/${i}.pdf`));
    }
    expect(history).toHaveLength(EXPORT_HISTORY_LIMIT);
    expect(history[0].path).toBe(`exports/p/${EXPORT_HISTORY_LIMIT + 1}.pdf`);
  });

  it('replaces an entry for the same file', () => {
    const history = addExportRecord([record('a', 1), record('b', 1)], record('b', 2));
    expect(history.map(item => [item.path, item.createdAt])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });

  it('removes only the chosen entry', () => {
    expect(removeExportRecord([record('a'), record('b')], 'a').map(item => item.path)).toEqual(['b']);
  });

  it('reads back what was stored', () => {
    const history = [record('a')];
    expect(parseExportHistory(JSON.stringify(history))).toEqual(history);
  });

  it('treats a damaged history as empty', () => {
    expect(parseExportHistory(null)).toEqual([]);
    expect(parseExportHistory('not json')).toEqual([]);
    expect(parseExportHistory('[{"path":1}]')).toEqual([]);
    expect(parseExportHistory('{"a":1}')).toEqual([]);
  });
});

describe('social frames', () => {
  const square = { w: 1080, h: 1080 };

  it('fits a wide panel to the frame width and centres it', () => {
    const place = socialPlacement({ x: 44, y: 44, w: 912, h: 400 }, square);
    expect(place.w).toBeCloseTo(984);
    expect(place.x).toBeCloseTo(48);
    expect(place.y).toBeCloseTo((1080 - place.h) / 2);
  });

  it('fits a tall panel to the frame height', () => {
    const place = socialPlacement({ x: 0, y: 0, w: 300, h: 900 }, square);
    expect(place.h).toBeCloseTo(984);
    expect(place.x).toBeCloseTo((1080 - place.w) / 2);
  });

  it('draws the page wide enough for its most enlarged panel, up to a cap', () => {
    const panels = [
      { x: 0, y: 0, w: 912, h: 600 },
      { x: 0, y: 0, w: 450, h: 450 },
    ];
    expect(socialPageWidth(panels, 1000, square)).toBe(Math.ceil((984 / 450) * 1000));
    expect(socialPageWidth([{ x: 0, y: 0, w: 40, h: 40 }], 1000, square)).toBe(3600);
    expect(extraPageCount({ format: 'social', cover: true, info: true })).toBe(0);
  });
});

describe('signature', () => {
  it('needs a pen name', () => {
    expect(resolveOptions({ ...form, signature: true, penName: '  ' }, []).signature).toBe(false);
    expect(resolveOptions({ ...form, signature: true, penName: 'Aki' }, []).signature).toBe(true);
  });
});
