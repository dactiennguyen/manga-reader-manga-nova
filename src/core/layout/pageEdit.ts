import type { ID, LayoutNode, Page, Panel } from '../model/types';
import { uid } from '../util/id';
import type { Divider, Pt } from './layout';

export type Snapshot = Pick<Page, 'layout' | 'panels' | 'order' | 'gutterH' | 'gutterV'>;

export type HandleKind = 'mid' | 't0' | 't1';

const SNAPS = [1 / 2, 1 / 3, 1 / 4, 2 / 3, 3 / 4];
const SNAP_RANGE = 0.02;

let layoutClipboard: Snapshot | null = null;

export function snapshotOf(page: Page): Snapshot {
  return { layout: page.layout, panels: page.panels, order: page.order, gutterH: page.gutterH, gutterV: page.gutterV };
}

export function blankPanel(id: ID): Panel {
  return { id, bleed: false, borderless: false, description: '', blockIds: [] };
}

export function copyLayout(page: Page): void {
  layoutClipboard = snapshotOf(page);
}

export function hasLayoutClipboard(): boolean {
  return !!layoutClipboard?.layout;
}

export function pasteLayout(): Snapshot | null {
  const source = layoutClipboard;
  if (!source?.layout) {
    return null;
  }
  const ids: Record<ID, ID> = {};
  const panels: Record<ID, Panel> = {};
  const clone = (node: LayoutNode): LayoutNode => {
    if (node.kind === 'panel') {
      const id = uid();
      ids[node.id] = id;
      const from = source.panels[node.id];
      panels[id] = { ...blankPanel(id), bleed: !!from?.bleed, borderless: !!from?.borderless };
      return { kind: 'panel', id };
    }
    return { ...node, id: uid(), a: clone(node.a), b: clone(node.b) };
  };
  const layout = clone(source.layout);
  const order = source.order?.map(id => ids[id]).filter(Boolean);
  return { layout, panels, order, gutterH: source.gutterH, gutterV: source.gutterV };
}

export function snapT(value: number): number {
  for (const target of SNAPS) {
    if (Math.abs(value - target) < SNAP_RANGE) {
      return target;
    }
  }
  return value;
}

export function handlePoints(divider: Divider): Record<HandleKind, Pt> {
  const first = divider.dir === 'h' ? divider.a.x <= divider.b.x : divider.a.y <= divider.b.y;
  const start = first ? divider.a : divider.b;
  const end = first ? divider.b : divider.a;
  const at = (t: number): Pt => ({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  return { mid: at(0.5), t0: at(0.1), t1: at(0.9) };
}

export function hitHandle(dividers: Divider[], p: Pt, radius: number): { divider: Divider; kind: HandleKind } | null {
  let best: { divider: Divider; kind: HandleKind } | null = null;
  let bestDistance = radius;
  for (const divider of dividers) {
    const handles = handlePoints(divider);
    for (const kind of ['mid', 't0', 't1'] as const) {
      const distance = Math.hypot(handles[kind].x - p.x, handles[kind].y - p.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { divider, kind };
      }
    }
  }
  return best;
}

export function dragSplit(divider: Divider, kind: HandleKind, dx: number, dy: number): { t0: number; t1: number } {
  const dt = divider.dir === 'h' ? dy / Math.max(1, divider.bb.h) : dx / Math.max(1, divider.bb.w);
  if (kind === 'mid') {
    const middle = (divider.t0 + divider.t1) / 2;
    const shift = snapT(middle + dt) - middle;
    return { t0: divider.t0 + shift, t1: divider.t1 + shift };
  }
  const other = kind === 't0' ? divider.t1 : divider.t0;
  let next = (kind === 't0' ? divider.t0 : divider.t1) + dt;
  next = Math.abs(next - other) < SNAP_RANGE ? other : snapT(next);
  return kind === 't0' ? { t0: next, t1: divider.t1 } : { t0: divider.t0, t1: next };
}
