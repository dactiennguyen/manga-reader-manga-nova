import {
  PAGE_MARGIN,
  TEMPLATES,
  buildTemplate,
  canMerge,
  collectPanelIds,
  computeDividers,
  computePanels,
  cutFromLine,
  defaultTemplate,
  mergePanels,
  pageSize,
  pointInPoly,
  polyArea,
  readingOrder,
  removePanel,
  setSplit,
  splitPanel,
  templatesFor,
  type LayoutInput,
} from '../src/core/layout/layout';
import type { LayoutNode, Panel } from '../src/core/model/types';

const SIZE = { w: 1000, h: 1412 };

function pageFrom(templateId: string, gutters = { gutterH: 20, gutterV: 10 }): LayoutInput & { ids: string[] } {
  let n = 0;
  const template = TEMPLATES.find(t => t.id === templateId)!;
  const built = buildTemplate(template, () => `id${n++}`);
  const panels: Record<string, Panel> = {};
  for (const id of built.panelIds) {
    panels[id] = { id, bleed: built.bleedIds.includes(id), borderless: false, description: '', blockIds: [] };
  }
  return { layout: built.layout, panels, ...gutters, ids: built.panelIds };
}

describe('pageSize', () => {
  it('uses the paper ratio for manga pages and a custom height for webtoons', () => {
    expect(pageSize({ format: 'manga', pageSize: 'B5' })).toEqual({ w: 1000, h: 1412 });
    expect(pageSize({ format: 'manga', pageSize: 'A5' })).toEqual({ w: 1000, h: 1419 });
    expect(pageSize({ format: 'webtoon', pageSize: 'B5' }, { height: 3200 })).toEqual({ w: 1000, h: 3200 });
  });
});

describe('computePanels', () => {
  it('splits a 2x2 grid into four equal panels separated by the gutter width', () => {
    const page = pageFrom('g4-grid');
    const shapes = computePanels(page, SIZE, { rtl: false });
    expect(shapes).toHaveLength(4);
    const innerW = SIZE.w - PAGE_MARGIN * 2;
    const innerH = SIZE.h - PAGE_MARGIN * 2;
    for (const shape of shapes) {
      expect(shape.bbox.w).toBeCloseTo((innerW - 10) / 2, 5);
      expect(shape.bbox.h).toBeCloseTo((innerH - 20) / 2, 5);
    }
    const total = shapes.reduce((sum, shape) => sum + polyArea(shape.poly), 0);
    expect(total).toBeCloseTo((innerW - 10) * (innerH - 20), 3);
  });

  it('numbers panels right to left in manga reading order', () => {
    const page = pageFrom('g4-grid');
    const ltr = computePanels(page, SIZE, { rtl: false });
    const rtl = computePanels(page, SIZE, { rtl: true });
    expect(ltr[0].bbox.x).toBeLessThan(ltr[1].bbox.x);
    expect(rtl[0].bbox.x).toBeGreaterThan(rtl[1].bbox.x);
    expect(rtl[0].bbox.y).toBeCloseTo(rtl[1].bbox.y, 5);
    expect(rtl[2].bbox.y).toBeGreaterThan(rtl[0].bbox.y);
  });

  it('uses a manual order when valid and ignores it when panels are missing', () => {
    const page = pageFrom('g3-rows');
    const reversed = [...page.ids].reverse();
    expect(computePanels({ ...page, order: reversed }, SIZE, { rtl: false }).map(s => s.id)).toEqual(reversed);
    expect(computePanels({ ...page, order: [page.ids[0]] }, SIZE, { rtl: false }).map(s => s.id)).toEqual(page.ids);
  });

  it('pushes the edges of a bleed panel out to the page edge', () => {
    const [shape] = computePanels(pageFrom('b1'), SIZE, { rtl: false });
    expect(shape.bbox).toEqual({ x: 0, y: 0, w: SIZE.w, h: SIZE.h });
  });

  it('makes a slanted panel when the two ends of a cut differ', () => {
    const shapes = computePanels(pageFrom('d2'), SIZE, { rtl: false });
    const ys = shapes[0].poly.map(p => p.y);
    expect(new Set(ys.map(y => Math.round(y))).size).toBeGreaterThan(2);
  });

  it('every template yields the right panel count with no overlaps', () => {
    for (const template of TEMPLATES) {
      const page = pageFrom(template.id);
      const shapes = computePanels(page, SIZE, { rtl: true });
      expect(shapes).toHaveLength(template.count);
      for (const shape of shapes) {
        expect(polyArea(shape.poly)).toBeGreaterThan(1000);
        const cx = shape.poly.reduce((s, p) => s + p.x, 0) / shape.poly.length;
        const cy = shape.poly.reduce((s, p) => s + p.y, 0) / shape.poly.length;
        const owners = shapes.filter(other => pointInPoly(other.poly, { x: cx, y: cy }));
        expect(owners.map(o => o.id)).toEqual([shape.id]);
      }
    }
  });
});

describe('editing the layout tree', () => {
  it('cuts a panel in two and merges it back', () => {
    const page = pageFrom('g2-rows');
    const [first, second] = page.ids;
    const cut = splitPanel(page.layout!, first, 'v', 0.5, 0.5, { splitId: 's', panelId: 'new' });
    expect(collectPanelIds(cut)).toEqual([first, 'new', second]);
    expect(canMerge(cut, first, 'new')).toBe(true);
    expect(canMerge(cut, first, second)).toBe(false);
    expect(mergePanels(cut, first, 'new')).toEqual(page.layout);
    expect(mergePanels(cut, first, second)).toBeNull();
  });

  it('removing a panel lets its sibling take the parent slot', () => {
    const page = pageFrom('g3-top');
    const [top, left, right] = page.ids;
    const next = removePanel(page.layout!, left) as LayoutNode;
    expect(collectPanelIds(next)).toEqual([top, right]);
    expect(removePanel({ kind: 'panel', id: 'only' }, 'only')).toBeNull();
  });

  it('clamps the cut position to the allowed range', () => {
    const page = pageFrom('g2-rows');
    const splitId = (page.layout as Extract<LayoutNode, { kind: 'split' }>).id;
    const next = setSplit(page.layout!, splitId, -1, 2) as Extract<LayoutNode, { kind: 'split' }>;
    expect(next.t0).toBe(0.08);
    expect(next.t1).toBe(0.92);
  });

  it('derives cut direction and position from the drawn line', () => {
    const [shape] = computePanels(pageFrom('g1'), SIZE, { rtl: false });
    const midY = shape.bbox.y + shape.bbox.h / 2;
    const horizontal = cutFromLine(shape, { x: 100, y: midY }, { x: 900, y: midY });
    expect(horizontal).toEqual({ dir: 'h', t0: 0.5, t1: 0.5 });
    const midX = shape.bbox.x + shape.bbox.w / 2;
    const vertical = cutFromLine(shape, { x: midX, y: 200 }, { x: midX, y: 1200 });
    expect(vertical).toEqual({ dir: 'v', t0: 0.5, t1: 0.5 });
    expect(cutFromLine(shape, { x: 500, y: 500 }, { x: 505, y: 503 })).toBeNull();
  });

  it('returns one divider per split node', () => {
    const page = pageFrom('g4-grid');
    const dividers = computeDividers(page, SIZE, { rtl: false });
    expect(dividers).toHaveLength(3);
    expect(dividers.filter(d => d.dir === 'h')).toHaveLength(1);
  });
});

describe('templates', () => {
  it('webtoons only use strip templates', () => {
    expect(templatesFor('webtoon', 3).every(t => t.kind === 'strip')).toBe(true);
    expect(templatesFor('manga', 3).some(t => t.kind === 'strip')).toBe(false);
  });

  it('picks a default template by panel count and clamps large counts', () => {
    expect(defaultTemplate('manga', 4).count).toBe(4);
    expect(defaultTemplate('manga', 12).count).toBe(7);
    expect(defaultTemplate('webtoon', 5).kind).toBe('strip');
  });

  it('automatic reading order goes top to bottom, right to left', () => {
    const page = pageFrom('g3-bottom');
    const [left, right, bottom] = page.ids;
    expect(readingOrder(page.layout, true)).toEqual([right, left, bottom]);
    expect(readingOrder(page.layout, false)).toEqual([left, right, bottom]);
  });
});
