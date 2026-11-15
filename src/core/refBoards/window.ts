/**
 * The floating reference window on the canvas. The page leads: the window starts small, beside the
 * tools, and can be pushed out of the way or folded into a tab. These run in gesture worklets too.
 */

export type Area = { w: number; h: number };

export type RefWindowState = {
  x: number;
  y: number;
  /** Width of the window. Its height follows the picture. */
  w: number;
  collapsed: boolean;
  /** Of the picture only: the buttons stay readable. */
  opacity: number;
  flipped: boolean;
};

export const REF_WINDOW = {
  minW: 160,
  defaultW: 176,
  maxW: 480,
  /** Never wider than this share of the drawing area, so the page stays the larger thing. */
  maxShare: 0.7,
  header: 48,
  tools: 48,
  /** The folded tab. */
  tab: 48,
  edge: 8,
  /** Height over width of the picture box. */
  minRatio: 0.6,
  maxRatio: 1.5,
} as const;

export const OPACITY_STEPS = [1, 0.75, 0.5, 0.25] as const;

export function nextOpacity(current: number): number {
  const index = OPACITY_STEPS.findIndex(step => Math.abs(step - current) < 0.01);
  return OPACITY_STEPS[(index + 1) % OPACITY_STEPS.length];
}

function clamp(value: number, low: number, high: number): number {
  'worklet';
  return Math.min(high, Math.max(low, value));
}

export function maxWindowWidth(areaW: number): number {
  'worklet';
  return Math.max(REF_WINDOW.minW, Math.min(REF_WINDOW.maxW, areaW * REF_WINDOW.maxShare));
}

export function clampWidth(w: number, areaW: number): number {
  'worklet';
  return clamp(w, REF_WINDOW.minW, maxWindowWidth(areaW));
}

/** Height of the picture box for a width and a picture's height over width. */
export function pictureHeight(w: number, ratio: number): number {
  'worklet';
  const r = ratio > 0 ? ratio : 1;
  return Math.round(w * clamp(r, REF_WINDOW.minRatio, REF_WINDOW.maxRatio));
}

export function windowHeight(w: number, ratio: number): number {
  'worklet';
  return REF_WINDOW.header + pictureHeight(w, ratio) + REF_WINDOW.tools;
}

/** Keeps the whole frame on screen, below `top`. A frame taller than the room sticks to the top. */
export function clampX(x: number, w: number, area: Area): number {
  'worklet';
  return clamp(x, REF_WINDOW.edge, Math.max(REF_WINDOW.edge, area.w - w - REF_WINDOW.edge));
}

export function clampY(y: number, h: number, area: Area, top: number): number {
  'worklet';
  return clamp(y, top, Math.max(top, area.h - h - REF_WINDOW.edge));
}

/** Opposite the tool rail, just under the top bar. */
export function defaultWindow(area: Area, side: 'left' | 'right', top: number): RefWindowState {
  const w = clampWidth(REF_WINDOW.defaultW, area.w);
  const x = side === 'right' ? area.w - w - REF_WINDOW.edge : REF_WINDOW.edge;
  return { x: clampX(x, w, area), y: top, w, collapsed: false, opacity: 1, flipped: false };
}

/** After a rotation or a new layout, the window comes back inside the area with its size kept when it fits. */
export function fitWindow(state: RefWindowState, area: Area, ratio: number, top: number): RefWindowState {
  const w = clampWidth(state.w, area.w);
  const h = windowHeight(w, ratio);
  return { ...state, w, x: clampX(state.x, w, area), y: clampY(state.y, h, area, top) };
}

/** The folded tab sits on the edge nearest to where the window was. */
export function tabSide(x: number, w: number, areaW: number): 'left' | 'right' {
  'worklet';
  return x + w / 2 < areaW / 2 ? 'left' : 'right';
}
