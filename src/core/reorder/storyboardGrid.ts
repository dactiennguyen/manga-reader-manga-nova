import { t, tn } from '../i18n';
import type { GridSpec, ItemSize } from './reorder';

/**
 * The drop maths mirrors the grid, so these are the only source for both. StoryboardGrid and PageThumb
 * style their padding, gaps and caption height from here. Do not restyle them with classes.
 */
export const STORYBOARD_SIZES = {
  pad: 16,
  rowGap: 12,
  cellGap: 8,
  metaHeight: 26,
  bottomSpace: 96,
  thumbMax: 180,
  webtoonThumbMax: 200,
  webtoonMaxHeight: 360,
  listThumb: 84,
  listMaxHeight: 160,
} as const;

const WIDE_FROM = 600;

const WIDE_CELL = 140;
const WEBTOON_WIDE_CELL = 200;

/** Facing pages sit side by side, so the paged grid only grows by whole spreads. */
export function gridColumns(width: number, webtoon: boolean): number {
  if (width < WIDE_FROM) {
    return webtoon ? 1 : 2;
  }
  const usable = width - STORYBOARD_SIZES.pad * 2;
  if (webtoon) {
    return Math.max(2, Math.floor(usable / WEBTOON_WIDE_CELL));
  }
  return Math.max(4, Math.floor(usable / WIDE_CELL / 2) * 2);
}

/** Cell width: the thumbnail plus the gap inside the cell. gridBoxes puts cells edge to edge. */
export function cellWidth(width: number, columns: number, webtoon: boolean): number {
  const { cellGap, pad, thumbMax, webtoonThumbMax } = STORYBOARD_SIZES;
  const usable = (width - pad * 2) / columns;
  if (webtoon && columns === 1) {
    return Math.min(webtoonThumbMax, width * 0.5) + cellGap;
  }
  return Math.min((webtoon ? webtoonThumbMax : thumbMax) + cellGap, usable);
}

export function thumbHeight(width: number, page: ItemSize, webtoon: boolean, maxHeight: number): number {
  const height = (width * page.h) / page.w;
  return webtoon ? Math.min(height, maxHeight) : height;
}

export function gridSpecOf(width: number, columns: number, webtoon: boolean, rtl: boolean): GridSpec {
  const { pad, rowGap } = STORYBOARD_SIZES;
  return { width, pad, gap: rowGap, columns, firstSolo: !webtoon, rtl: !webtoon && rtl };
}

/** Grid rows as index ranges, built the same way gridBoxes walks them. */
export function gridRows<T>(items: readonly T[], spec: Pick<GridSpec, 'columns' | 'firstSolo'>): T[][] {
  const rows: T[][] = [];
  let start = 0;
  while (start < items.length) {
    const count = spec.firstSolo && start === 0 ? 1 : spec.columns;
    rows.push(items.slice(start, start + count));
    start += count;
  }
  return rows;
}

export type MoveArrow = 'left' | 'right' | 'up' | 'down';

/** Which way a page travels on screen when it moves in the reading order. */
export function moveArrows(webtoon: boolean, rtl: boolean, list: boolean): { earlier: MoveArrow; later: MoveArrow } {
  if (webtoon || list) {
    return { earlier: 'up', later: 'down' };
  }
  return rtl ? { earlier: 'right', later: 'left' } : { earlier: 'left', later: 'right' };
}

export function pageLabel(number: number, panels: number, status: string, flagged: boolean): string {
  const params = { n: number, panels: tn(panels, '{count} panel', '{count} panels'), status: t(status).toLowerCase() };
  return flagged ? t('Page {n}, {panels}, {status}, flagged', params) : t('Page {n}, {panels}, {status}', params);
}
