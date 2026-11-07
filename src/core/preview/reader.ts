import type { Size } from '../layout/layout';
import { spreadIndexOfPage } from './spreads';

/** Height of the end card in the vertical webtoon list. Manga pages fill the frame. */
export const END_CARD_HEIGHT = 420;

export const FLAG_REASONS = ['Art', 'Dialogue', 'Layout', 'Reading order'] as const;

export type ItemMetrics = { lengths: number[]; offsets: number[]; total: number };

export function itemMetrics(lengths: readonly number[]): ItemMetrics {
  const offsets: number[] = [];
  let total = 0;
  for (const length of lengths) {
    offsets.push(total);
    total += length;
  }
  return { lengths: [...lengths], offsets, total };
}

/** The largest page that fits the frame with `slots` pages side by side. */
export function fitPage(frame: Size, page: Size, slots: number): Size {
  const w = Math.min(Math.floor(frame.w / slots), Math.floor((frame.h * page.w) / page.h));
  return { w, h: Math.round((w * page.h) / page.w) };
}

export type ReaderTap = 'next' | 'previous' | 'controls';

/** Manga reads right to left, so the left quarter turns forward. A zoomed page only toggles the controls. */
export function readerTap(x: number, width: number, paged: boolean, zoomed: boolean): ReaderTap {
  if (paged && !zoomed && x < width * 0.25) {
    return 'next';
  }
  if (paged && !zoomed && x > width * 0.75) {
    return 'previous';
  }
  return 'controls';
}

/** The list holds one item per spread plus the end card, which sits just past the last page. */
export function itemOfPage(groups: readonly (readonly unknown[])[], pageIndex: number, total: number): number {
  return pageIndex >= total ? groups.length : spreadIndexOfPage(groups, pageIndex);
}

export function clampItem(target: number, itemCount: number): number {
  return Math.max(0, Math.min(itemCount - 1, target));
}

/** The manga slider runs right to left, so page 1 sits at the right end. */
export function sliderValueOfItem(shown: number, groupCount: number, rtl: boolean): number {
  return rtl ? groupCount + 1 - shown : shown;
}

export function itemOfSliderValue(value: number, groupCount: number, rtl: boolean): number {
  const step = Math.round(value);
  return rtl ? groupCount - step : step - 1;
}

/** Skia pages are invisible to a screen reader, so this is all it gets. */
export function pageLabel(pageNumber: number, panels: number, done: boolean, flagged: boolean): string {
  const count = `${panels} ${panels === 1 ? 'panel' : 'panels'}`;
  return `Page ${pageNumber}, ${count}, ${done ? 'done' : 'not done'}${flagged ? ', flagged' : ''}`;
}
