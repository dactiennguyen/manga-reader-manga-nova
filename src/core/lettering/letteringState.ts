import type { Pt, Size } from '../layout/layout';
import type { Bubble, BubbleType, EffectType, ID } from '../model/types';
import type { Guide } from './bubbleDrag';

type LetteringSelection = { kind: 'bubble' | 'effect'; id: ID } | null;

type LetteringPending = { kind: 'bubble'; type: BubbleType } | { kind: 'effect'; type: EffectType } | null;

export type LetteringView = { z: number; tx: number; ty: number };

/** One overlay at a time: each opens from the screen or from a menu that has already closed. */
type LetteringSheet = 'editor' | 'menu' | 'item' | 'list' | 'effects' | 'speaker' | 'language' | 'manage' | 'translate';

export type LetteringState = {
  box: Size;
  view: LetteringView | null;
  selection: LetteringSelection;
  pending: LetteringPending;
  draft: Bubble | null;
  draftCenter: Pt | null;
  guides: Guide[];
  sheet: LetteringSheet | null;
  /** Kept after the item menu closes, so its rows stay on screen while the sheet slides away. */
  itemId: ID | null;
  originalOpen: boolean;
  hideBubbles: boolean;
  showOrder: boolean;
};

export type LetteringAction =
  | { type: 'layout'; box: Size }
  | { type: 'setView'; view: LetteringView | null }
  | { type: 'select'; selection: LetteringSelection }
  | { type: 'pend'; pending: LetteringPending }
  | { type: 'placedBubble'; id: ID }
  | { type: 'placedEffect'; id: ID }
  | { type: 'showBubbles' }
  | { type: 'dragBubble'; draft: Bubble; guides: Guide[] }
  | { type: 'dragCenter'; center: Pt }
  | { type: 'dragEnd' }
  | { type: 'openEditor'; id?: ID }
  | { type: 'editOriginal' }
  | { type: 'openSheet'; sheet: LetteringSheet }
  | { type: 'openItem'; id: ID }
  | { type: 'closeSheet' }
  | { type: 'toggleBubbles' }
  | { type: 'toggleOrder' };

const NO_GUIDES: Guide[] = [];

export const INITIAL_LETTERING: LetteringState = {
  box: { w: 0, h: 0 },
  view: null,
  selection: null,
  pending: null,
  draft: null,
  draftCenter: null,
  guides: NO_GUIDES,
  sheet: null,
  itemId: null,
  originalOpen: false,
  hideBubbles: false,
  showOrder: false,
};

export function letteringReducer(state: LetteringState, action: LetteringAction): LetteringState {
  switch (action.type) {
    case 'layout':
      return { ...state, box: action.box };
    case 'setView':
      return { ...state, view: action.view };
    case 'select':
      return { ...state, selection: action.selection };
    case 'pend':
      return { ...state, pending: action.pending, selection: null, sheet: null };
    case 'placedBubble':
      return {
        ...state,
        pending: null,
        hideBubbles: false,
        selection: { kind: 'bubble', id: action.id },
        sheet: 'editor',
      };
    case 'placedEffect':
      return { ...state, pending: null, selection: { kind: 'effect', id: action.id } };
    case 'showBubbles':
      return { ...state, hideBubbles: false };
    case 'dragBubble':
      return { ...state, draft: action.draft, guides: action.guides };
    case 'dragCenter':
      return { ...state, draftCenter: action.center };
    case 'dragEnd':
      return { ...state, draft: null, draftCenter: null, guides: NO_GUIDES };
    case 'openEditor':
      return {
        ...state,
        selection: action.id ? { kind: 'bubble', id: action.id } : state.selection,
        sheet: 'editor',
      };
    case 'editOriginal':
      return { ...state, originalOpen: true };
    case 'openSheet':
      return { ...state, sheet: action.sheet };
    case 'openItem':
      return { ...state, selection: { kind: 'bubble', id: action.id }, itemId: action.id, sheet: 'item' };
    case 'closeSheet':
      return { ...state, sheet: null, originalOpen: false };
    case 'toggleBubbles':
      return { ...state, hideBubbles: !state.hideBubbles };
    case 'toggleOrder':
      return { ...state, showOrder: !state.showOrder };
  }
}

const STAGE_INSET = 24;
const TALL_RATIO = 2.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const DOUBLE_TAP_MS = 320;

export type LetteringStage = { tall: boolean; bw: number; bh: number; scale: number; fit: LetteringView };

/** Base page size on the stage. A tall strip fits its width and starts at the top. */
export function stageOf(box: Size, size: Size): LetteringStage {
  const tall = size.h / size.w > TALL_RATIO;
  const bw = Math.max(1, tall ? box.w - STAGE_INSET : Math.min(box.w - STAGE_INSET, ((box.h - STAGE_INSET) * size.w) / size.h));
  const bh = (bw * size.h) / size.w;
  return { tall, bw, bh, scale: bw / size.w, fit: { z: 1, tx: 0, ty: tall ? (bh - box.h) / 2 + STAGE_INSET / 2 : 0 } };
}

export function stageToPage(x: number, y: number, box: Size, stage: LetteringStage, view: LetteringView): Pt {
  return {
    x: ((x - box.w / 2 - view.tx) / view.z + stage.bw / 2) / stage.scale,
    y: ((y - box.h / 2 - view.ty) / view.z + stage.bh / 2) / stage.scale,
  };
}

/** Room left above a lifted bubble, for its rotate handle. */
const LIFT_TOP_MARGIN = 56;
const LIFT_GAP = 16;

function pageYOnStage(y: number, box: Size, stage: LetteringStage, view: LetteringView): number {
  return box.h / 2 + view.ty + (y * stage.scale - stage.bh / 2) * view.z;
}

/**
 * How far to move the page up so a card along the bottom of the stage leaves the bubble and its tail
 * visible. 0 when nothing is covered. The top of the bubble never leaves the stage, even if that
 * means part of a very tall bubble stays under the card.
 */
export function cardLift(
  bubble: Pick<Bubble, 'y' | 'h' | 'tail'>,
  cardHeight: number,
  box: Size,
  stage: LetteringStage,
  view: LetteringView,
): number {
  const top = pageYOnStage(Math.min(bubble.y, bubble.tail?.y ?? bubble.y), box, stage, view);
  const bottom = pageYOnStage(Math.max(bubble.y + bubble.h, bubble.tail?.y ?? 0), box, stage, view);
  const covered = bottom + LIFT_GAP - (box.h - cardHeight);
  return Math.max(0, Math.min(covered, top - LIFT_TOP_MARGIN));
}

export type PinchStart = { view0: LetteringView; fx: number; fy: number };

export function pinchView(start: PinchStart, factor: number, fx: number, fy: number, box: Size): LetteringView {
  const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, start.view0.z * factor));
  const ratio = z / start.view0.z;
  return {
    z,
    tx: fx - box.w / 2 - (start.fx - box.w / 2 - start.view0.tx) * ratio,
    ty: fy - box.h / 2 - (start.fy - box.h / 2 - start.view0.ty) * ratio,
  };
}

export type TapMark = { time: number; id: ID | null };

/** A second tap on the same thing within the window. It resets the mark, so a third tap starts over. */
export function nextTap(last: TapMark, now: number, id: ID | null): { double: boolean; mark: TapMark } {
  const double = now - last.time < DOUBLE_TAP_MS && last.id === id;
  return { double, mark: { time: double ? 0 : now, id } };
}
