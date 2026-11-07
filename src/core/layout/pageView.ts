import type { Pt, Size } from './layout';

/** Drag handles catch touches this far out on each side. Measured on screen, so zooming never changes it. */
export const HANDLE_HIT_DP = 24;

export const VIEW_PAD = 16;

export const MAX_ZOOM = 6;

const WEBTOON_FIT = 0.8;
const WEBTOON_MIN_ZOOM = 0.4;
const OVERSCROLL = 40;
const SWIPE_MIN = 60;

export type LayoutView = { scale: number; tx: number; ty: number };

export type PageFrame = { k: number; ox: number; oy: number };

export const HOME_VIEW: LayoutView = { scale: 1, tx: 0, ty: 0 };

export function fitScale(box: Size, size: Size, webtoon: boolean): number {
  if (!box.w) {
    return 0;
  }
  const byWidth = (box.w - VIEW_PAD * 2) / size.w;
  return webtoon ? byWidth * WEBTOON_FIT : Math.min(byWidth, (box.h - VIEW_PAD * 2) / size.h);
}

export function pageFrame(box: Size, size: Size, view: LayoutView, fit: number, webtoon: boolean): PageFrame {
  const k = Math.max(0.01, fit * view.scale);
  return {
    k,
    ox: (box.w - size.w * k) / 2 + view.tx,
    oy: webtoon ? VIEW_PAD + view.ty : (box.h - size.h * k) / 2 + view.ty,
  };
}

export function toPagePoint(frame: PageFrame, x: number, y: number): Pt {
  return { x: (x - frame.ox) / frame.k, y: (y - frame.oy) / frame.k };
}

export function insidePage(p: Pt, size: Size): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= size.w && p.y <= size.h;
}

export function clampView(next: LayoutView, box: Size, size: Size, fit: number, webtoon: boolean): LayoutView {
  const k = fit * next.scale;
  const limitX = Math.max(0, (size.w * k - box.w) / 2 + OVERSCROLL);
  const tx = Math.min(limitX, Math.max(-limitX, next.tx));
  if (webtoon) {
    const lowest = Math.min(0, box.h - VIEW_PAD * 2 - size.h * k);
    return { scale: next.scale, tx, ty: Math.min(0, Math.max(lowest, next.ty)) };
  }
  const limitY = Math.max(0, (size.h * k - box.h) / 2 + OVERSCROLL);
  return { scale: next.scale, tx, ty: Math.min(limitY, Math.max(-limitY, next.ty)) };
}

export function clampZoom(scale: number, webtoon: boolean): number {
  return Math.min(MAX_ZOOM, Math.max(webtoon ? WEBTOON_MIN_ZOOM : 1, scale));
}

/** +1 for the next page, -1 for the previous one, 0 when this was not a page swipe. */
export function swipeStep(translationX: number, translationY: number, rtl: boolean): -1 | 0 | 1 {
  if (Math.abs(translationX) <= SWIPE_MIN || Math.abs(translationX) <= Math.abs(translationY)) {
    return 0;
  }
  return translationX > 0 === rtl ? 1 : -1;
}
