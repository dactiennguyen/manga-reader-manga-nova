import type { ID, LayoutNode, Page, Project } from '../model/types';

export type Pt = { x: number; y: number };

export type Poly = Pt[];

export type Rect = { x: number; y: number; w: number; h: number };

export type Size = { w: number; h: number };

export type PanelShape = { id: ID; poly: Poly; bbox: Rect; index: number };

export type Divider = { splitId: ID; dir: 'h' | 'v'; a: Pt; b: Pt; bb: Rect; t0: number; t1: number };

export type LayoutOptions = { rtl: boolean; margin?: number };

export type LayoutInput = Pick<Page, 'layout' | 'gutterH' | 'gutterV' | 'panels' | 'order'>;

export const PAGE_W = 1000;
export const PAGE_MARGIN = 44;
export const DEFAULT_GUTTER_H = 22;
export const DEFAULT_GUTTER_V = 12;
export const WEBTOON_DEFAULT_H = 2800;
export const SPLIT_MIN = 0.08;
export const SPLIT_MAX = 0.92;

const PAGE_RATIO = { B5: 257 / 182, A5: 210 / 148 } as const;

export function pageSize(project: Pick<Project, 'format' | 'pageSize'>, page?: Pick<Page, 'height'> | null): Size {
  if (project.format === 'webtoon') {
    return { w: PAGE_W, h: Math.round(page?.height ?? WEBTOON_DEFAULT_H) };
  }
  return { w: PAGE_W, h: Math.round(PAGE_W * PAGE_RATIO[project.pageSize]) };
}

export function isRtl(project: Pick<Project, 'format'>): boolean {
  return project.format === 'manga';
}

export function bboxOf(poly: Poly): Rect {
  if (!poly.length) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function rectPoly(r: Rect): Poly {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

export function polyCenter(poly: Poly): Pt {
  const bb = bboxOf(poly);
  return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
}

export function polyArea(poly: Poly): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
}

function side(a: Pt, b: Pt, p: Pt): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function intersect(a: Pt, b: Pt, p: Pt, q: Pt): Pt {
  const sp = side(a, b, p);
  const sq = side(a, b, q);
  const t = sp / (sp - sq);
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

export function clipPoly(poly: Poly, a: Pt, b: Pt, keepPositive: boolean): Poly {
  const sign = keepPositive ? 1 : -1;
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(a, b, p) * sign;
    const sq = side(a, b, q) * sign;
    if (sp >= 0) {
      out.push(p);
    }
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      out.push(intersect(a, b, p, q));
    }
  }
  return out;
}

function shiftLine(a: Pt, b: Pt, distance: number): [Pt, Pt] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * distance;
  const ny = (dx / len) * distance;
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
  ];
}

function splitLine(dir: 'h' | 'v', bb: Rect, t0: number, t1: number): [Pt, Pt] {
  if (dir === 'v') {
    return [
      { x: bb.x + t0 * bb.w, y: bb.y },
      { x: bb.x + t1 * bb.w, y: bb.y + bb.h },
    ];
  }
  return [
    { x: bb.x + bb.w, y: bb.y + t1 * bb.h },
    { x: bb.x, y: bb.y + t0 * bb.h },
  ];
}

function lineHits(poly: Poly, a: Pt, b: Pt): [Pt, Pt] | null {
  const hits: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(a, b, p);
    const sq = side(a, b, q);
    if (sp === 0) {
      hits.push(p);
    } else if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      hits.push(intersect(a, b, p, q));
    }
  }
  if (hits.length < 2) {
    return null;
  }
  return [hits[0], hits[hits.length - 1]];
}

export function pointInPoly(poly: Poly, p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function walk(
  node: LayoutNode,
  poly: Poly,
  gutterH: number,
  gutterV: number,
  onPanel: (id: ID, poly: Poly) => void,
  onSplit?: (node: Extract<LayoutNode, { kind: 'split' }>, poly: Poly, bb: Rect, a: Pt, b: Pt) => void,
): void {
  if (node.kind === 'panel') {
    onPanel(node.id, poly);
    return;
  }
  const bb = bboxOf(poly);
  const [a, b] = splitLine(node.dir, bb, node.t0, node.t1);
  onSplit?.(node, poly, bb, a, b);
  const half = (node.dir === 'h' ? gutterH : gutterV) / 2;
  const [pa, pb] = shiftLine(a, b, half);
  const [na, nb] = shiftLine(a, b, -half);
  walk(node.a, clipPoly(poly, pa, pb, true), gutterH, gutterV, onPanel, onSplit);
  walk(node.b, clipPoly(poly, na, nb, false), gutterH, gutterV, onPanel, onSplit);
}

function rootPoly(size: Size, margin: number): Poly {
  return rectPoly({ x: margin, y: margin, w: size.w - margin * 2, h: size.h - margin * 2 });
}

function applyBleed(poly: Poly, size: Size, margin: number): Poly {
  const eps = 0.5;
  return poly.map(p => ({
    x: Math.abs(p.x - margin) < eps ? 0 : Math.abs(p.x - (size.w - margin)) < eps ? size.w : p.x,
    y: Math.abs(p.y - margin) < eps ? 0 : Math.abs(p.y - (size.h - margin)) < eps ? size.h : p.y,
  }));
}

export function readingOrder(layout: LayoutNode | null, rtl: boolean): ID[] {
  const out: ID[] = [];
  const visit = (node: LayoutNode) => {
    if (node.kind === 'panel') {
      out.push(node.id);
    } else if (node.dir === 'v' && rtl) {
      visit(node.b);
      visit(node.a);
    } else {
      visit(node.a);
      visit(node.b);
    }
  };
  if (layout) {
    visit(layout);
  }
  return out;
}

export function panelOrder(page: Pick<Page, 'layout' | 'order'>, rtl: boolean): ID[] {
  const auto = readingOrder(page.layout, rtl);
  const manual = page.order;
  if (manual && manual.length === auto.length && auto.every(id => manual.includes(id))) {
    return manual;
  }
  return auto;
}

export function computePanels(page: LayoutInput, size: Size, options: LayoutOptions): PanelShape[] {
  if (!page.layout) {
    return [];
  }
  const margin = options.margin ?? PAGE_MARGIN;
  const order = panelOrder(page, options.rtl);
  const shapes: PanelShape[] = [];
  walk(page.layout, rootPoly(size, margin), page.gutterH, page.gutterV, (id, poly) => {
    const final = page.panels[id]?.bleed ? applyBleed(poly, size, margin) : poly;
    shapes.push({ id, poly: final, bbox: bboxOf(final), index: order.indexOf(id) });
  });
  return shapes.sort((p, q) => p.index - q.index);
}

export function computeDividers(page: LayoutInput, size: Size, options: LayoutOptions): Divider[] {
  if (!page.layout) {
    return [];
  }
  const margin = options.margin ?? PAGE_MARGIN;
  const dividers: Divider[] = [];
  walk(
    page.layout,
    rootPoly(size, margin),
    page.gutterH,
    page.gutterV,
    () => {},
    (node, poly, bb, a, b) => {
      const hits = lineHits(poly, a, b);
      if (hits) {
        dividers.push({ splitId: node.id, dir: node.dir, a: hits[0], b: hits[1], bb, t0: node.t0, t1: node.t1 });
      }
    },
  );
  return dividers;
}

export function hitTestPanel(shapes: PanelShape[], p: Pt): ID | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInPoly(shapes[i].poly, p)) {
      return shapes[i].id;
    }
  }
  return null;
}

export function collectPanelIds(layout: LayoutNode | null): ID[] {
  return readingOrder(layout, false);
}

export function countPanels(layout: LayoutNode | null): number {
  return collectPanelIds(layout).length;
}

function clampT(t: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, t));
}

function mapNode(node: LayoutNode, fn: (node: LayoutNode) => LayoutNode | undefined): LayoutNode {
  const replaced = fn(node);
  if (replaced) {
    return replaced;
  }
  if (node.kind === 'split') {
    const a = mapNode(node.a, fn);
    const b = mapNode(node.b, fn);
    return a === node.a && b === node.b ? node : { ...node, a, b };
  }
  return node;
}

export function setSplit(layout: LayoutNode, splitId: ID, t0: number, t1: number): LayoutNode {
  return mapNode(layout, node =>
    node.kind === 'split' && node.id === splitId ? { ...node, t0: clampT(t0), t1: clampT(t1) } : undefined,
  );
}

export function splitPanel(
  layout: LayoutNode,
  panelId: ID,
  dir: 'h' | 'v',
  t0: number,
  t1: number,
  ids: { splitId: ID; panelId: ID },
): LayoutNode {
  return mapNode(layout, node =>
    node.kind === 'panel' && node.id === panelId
      ? {
          kind: 'split',
          id: ids.splitId,
          dir,
          t0: clampT(t0),
          t1: clampT(t1),
          a: node,
          b: { kind: 'panel', id: ids.panelId },
        }
      : undefined,
  );
}

export function cutFromLine(shape: PanelShape, p0: Pt, p1: Pt): { dir: 'h' | 'v'; t0: number; t1: number } | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  if (Math.hypot(dx, dy) < 30) {
    return null;
  }
  const bb = shape.bbox;
  if (bb.w < 1 || bb.h < 1) {
    return null;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const slope = dy / dx;
    const yLeft = p0.y + (bb.x - p0.x) * slope;
    const yRight = p0.y + (bb.x + bb.w - p0.x) * slope;
    return { dir: 'h', t0: clampT((yLeft - bb.y) / bb.h), t1: clampT((yRight - bb.y) / bb.h) };
  }
  const slope = dx / dy;
  const xTop = p0.x + (bb.y - p0.y) * slope;
  const xBottom = p0.x + (bb.y + bb.h - p0.y) * slope;
  return { dir: 'v', t0: clampT((xTop - bb.x) / bb.w), t1: clampT((xBottom - bb.x) / bb.w) };
}

function findParent(
  layout: LayoutNode,
  panelId: ID,
): { parent: Extract<LayoutNode, { kind: 'split' }>; which: 'a' | 'b' } | null {
  if (layout.kind === 'panel') {
    return null;
  }
  if (layout.a.kind === 'panel' && layout.a.id === panelId) {
    return { parent: layout, which: 'a' };
  }
  if (layout.b.kind === 'panel' && layout.b.id === panelId) {
    return { parent: layout, which: 'b' };
  }
  return findParent(layout.a, panelId) ?? findParent(layout.b, panelId);
}

export function canMerge(layout: LayoutNode | null, idA: ID, idB: ID): boolean {
  if (!layout || idA === idB) {
    return false;
  }
  const found = findParent(layout, idA);
  if (!found) {
    return false;
  }
  const sibling = found.which === 'a' ? found.parent.b : found.parent.a;
  return sibling.kind === 'panel' && sibling.id === idB;
}

export function mergePanels(layout: LayoutNode, keepId: ID, removeId: ID): LayoutNode | null {
  if (!canMerge(layout, keepId, removeId)) {
    return null;
  }
  const found = findParent(layout, keepId)!;
  return mapNode(layout, node => (node === found.parent ? { kind: 'panel', id: keepId } : undefined));
}

export function removePanel(layout: LayoutNode, panelId: ID): LayoutNode | null {
  if (layout.kind === 'panel') {
    return layout.id === panelId ? null : layout;
  }
  const found = findParent(layout, panelId);
  if (!found) {
    return layout;
  }
  const sibling = found.which === 'a' ? found.parent.b : found.parent.a;
  return mapNode(layout, node => (node === found.parent ? sibling : undefined));
}

export type TemplateKind = 'grid' | 'diagonal' | 'bleed' | 'koma' | 'strip';

type Spec = 'P' | 'B' | ['h' | 'v', number, number, Spec, Spec];

const H = (t: number, a: Spec, b: Spec): Spec => ['h', t, t, a, b];
const V = (t: number, a: Spec, b: Spec): Spec => ['v', t, t, a, b];
const HS = (t0: number, t1: number, a: Spec, b: Spec): Spec => ['h', t0, t1, a, b];
const VS = (t0: number, t1: number, a: Spec, b: Spec): Spec => ['v', t0, t1, a, b];
const P: Spec = 'P';
const B: Spec = 'B';

export type LayoutTemplate = { id: string; count: number; kind: TemplateKind; spec: Spec };

function stack(count: number): Spec {
  return count <= 1 ? P : H(1 / count, P, stack(count - 1));
}

export const TEMPLATES: LayoutTemplate[] = [
  { id: 'g1', count: 1, kind: 'grid', spec: P },
  { id: 'b1', count: 1, kind: 'bleed', spec: B },
  { id: 'g2-rows', count: 2, kind: 'grid', spec: H(0.5, P, P) },
  { id: 'g2-cols', count: 2, kind: 'grid', spec: V(0.5, P, P) },
  { id: 'd2', count: 2, kind: 'diagonal', spec: HS(0.42, 0.58, P, P) },
  { id: 'b2', count: 2, kind: 'bleed', spec: H(0.62, B, P) },
  { id: 'g3-top', count: 3, kind: 'grid', spec: H(0.42, P, V(0.5, P, P)) },
  { id: 'g3-bottom', count: 3, kind: 'grid', spec: H(0.58, V(0.5, P, P), P) },
  { id: 'g3-rows', count: 3, kind: 'grid', spec: stack(3) },
  { id: 'd3', count: 3, kind: 'diagonal', spec: HS(0.3, 0.4, P, HS(0.55, 0.45, P, P)) },
  { id: 'b3', count: 3, kind: 'bleed', spec: H(0.5, B, V(0.5, P, P)) },
  { id: 'g4-grid', count: 4, kind: 'grid', spec: H(0.5, V(0.5, P, P), V(0.5, P, P)) },
  { id: 'g4-wide', count: 4, kind: 'grid', spec: H(0.3, P, H(0.55, V(0.5, P, P), P)) },
  { id: 'g4-offset', count: 4, kind: 'grid', spec: H(0.5, V(0.6, P, P), V(0.4, P, P)) },
  { id: 'k4', count: 4, kind: 'koma', spec: stack(4) },
  { id: 'd4', count: 4, kind: 'diagonal', spec: H(0.5, VS(0.44, 0.56, P, P), VS(0.56, 0.44, P, P)) },
  { id: 'b4', count: 4, kind: 'bleed', spec: H(0.4, B, H(0.5, V(0.5, P, P), P)) },
  { id: 'g5-a', count: 5, kind: 'grid', spec: H(0.3, V(0.5, P, P), H(0.57, P, V(0.5, P, P))) },
  { id: 'g5-b', count: 5, kind: 'grid', spec: H(0.36, P, H(0.5, V(0.6, P, P), V(0.4, P, P))) },
  { id: 'd5', count: 5, kind: 'diagonal', spec: HS(0.26, 0.34, V(0.55, P, P), HS(0.6, 0.5, P, V(0.45, P, P))) },
  { id: 'b5', count: 5, kind: 'bleed', spec: H(0.34, B, H(0.5, V(0.5, P, P), V(0.5, P, P))) },
  { id: 'g6-grid', count: 6, kind: 'grid', spec: H(1 / 3, V(0.5, P, P), H(0.5, V(0.5, P, P), V(0.5, P, P))) },
  { id: 'g6-mix', count: 6, kind: 'grid', spec: H(0.3, V(0.6, P, P), H(0.5, P, V(1 / 3, P, V(0.5, P, P)))) },
  {
    id: 'd6',
    count: 6,
    kind: 'diagonal',
    spec: HS(0.3, 0.36, V(0.5, P, P), HS(0.52, 0.46, V(0.4, P, P), V(0.6, P, P))),
  },
  {
    id: 'g7-a',
    count: 7,
    kind: 'grid',
    spec: H(0.28, V(0.5, P, P), H(0.42, V(1 / 3, P, V(0.5, P, P)), V(0.5, P, P))),
  },
  {
    id: 'g7-b',
    count: 7,
    kind: 'grid',
    spec: H(0.25, P, H(1 / 3, V(0.5, P, P), H(0.5, V(0.5, P, P), V(0.5, P, P)))),
  },
  { id: 's2', count: 2, kind: 'strip', spec: stack(2) },
  { id: 's3', count: 3, kind: 'strip', spec: stack(3) },
  { id: 's4', count: 4, kind: 'strip', spec: stack(4) },
  { id: 's5', count: 5, kind: 'strip', spec: stack(5) },
  { id: 's6', count: 6, kind: 'strip', spec: stack(6) },
];

export type BuiltLayout = { layout: LayoutNode; panelIds: ID[]; bleedIds: ID[] };

export function buildTemplate(template: LayoutTemplate, newId: () => ID): BuiltLayout {
  const panelIds: ID[] = [];
  const bleedIds: ID[] = [];
  const build = (spec: Spec): LayoutNode => {
    if (spec === 'P' || spec === 'B') {
      const id = newId();
      panelIds.push(id);
      if (spec === 'B') {
        bleedIds.push(id);
      }
      return { kind: 'panel', id };
    }
    const [dir, t0, t1, a, b] = spec;
    return { kind: 'split', id: newId(), dir, t0, t1, a: build(a), b: build(b) };
  };
  return { layout: build(template.spec), panelIds, bleedIds };
}

export function templatesFor(format: Project['format'], count?: number): LayoutTemplate[] {
  return TEMPLATES.filter(
    t =>
      (format === 'webtoon' ? t.kind === 'strip' || t.count === 1 : t.kind !== 'strip') &&
      (!count || t.count === count),
  );
}

export function defaultTemplate(format: Project['format'], count: number): LayoutTemplate {
  const n = Math.min(Math.max(1, Math.round(count)), format === 'webtoon' ? 6 : 7);
  const kind: TemplateKind = format === 'webtoon' && n > 1 ? 'strip' : 'grid';
  return TEMPLATES.find(t => t.count === n && t.kind === kind) ?? TEMPLATES[0];
}

export function templatePreview(template: LayoutTemplate, size: Size, rtl: boolean): PanelShape[] {
  let counter = 0;
  const built = buildTemplate(template, () => `t${counter++}`);
  const panels: LayoutInput['panels'] = {};
  for (const id of built.panelIds) {
    panels[id] = { id, bleed: built.bleedIds.includes(id), borderless: false, description: '', blockIds: [] };
  }
  const gutterScale = size.w / PAGE_W;
  return computePanels(
    { layout: built.layout, panels, gutterH: DEFAULT_GUTTER_H * gutterScale, gutterV: DEFAULT_GUTTER_V * gutterScale },
    size,
    { rtl, margin: PAGE_MARGIN * gutterScale },
  );
}
