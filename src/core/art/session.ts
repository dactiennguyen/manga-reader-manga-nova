import type { Stroke, StrokeTool, ID } from '../model/types';
import {
  IDENTITY_TRANSFORM,
  appendPressurePoint,
  composeTransform,
  cornerOffset,
  cornerScale,
  hitCorner,
  isFillTool,
  isIdentityTransform,
  isShapeTool,
  pinchTransform,
  type Box,
  type LayerTransform,
} from './artMath';
import { STROKE_POINT_LIMIT, appendPoint } from './strokes';
import { screenToPage, type CanvasTool, type ViewState } from './tools';

/**
 * The canvas gesture rules as one reducer, ported from the old CanvasScreen Session. It runs on the UI
 * thread, so everything here is a worklet, and declared before it is used: the worklets plugin captures a
 * function's closure when the function is defined. Timers live on the JS side: the reducer asks for one
 * with an effect and hears back through the hold and tapTimeout events.
 *
 * One deliberate impurity: stroke.points is appended in place. Copying it per event is the O(n^2) this
 * rewrite exists to remove. The reducer owns that array until it hands it over in a strokeCommit effect.
 */

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 16;
export const SNAP_ANGLE = 0.1;
export const TAP_MS = 300;
export const HOLD_MS = 550;
export const FIT_PAD = 28;

const DRAW_SLOP = 8;
const MOVE_SLOP = 6;
const PINCH_SLOP = 8;
const VIEW_SLOP = 10;
const HANDLE_REACH = 28;

export type Touch = { id: number; x: number; y: number };

export type Pointer = 'touch' | 'stylus' | 'other';

export type SessionLayer = { id: ID; locked: boolean; visible: boolean; bounds: Box | null };

/** What the screen knows. Written from React, read by the reducer. */
export type SessionEnv = {
  tool: CanvasTool;
  size: number;
  opacity: number;
  color: string;
  tone: number | null;
  picking: boolean;
  stylusMode: boolean;
  pageW: number;
  area: { w: number; h: number };
  bbox: Box;
  poly: { x: number; y: number }[];
  layer: SessionLayer | null;
};

type Pair = { a: number; b: number; cx: number; cy: number; dist: number; angle: number };

type PagePair = { a: number; b: number; cx: number; cy: number; dist: number };

export type SessionMode = 'idle' | 'draw' | 'view' | 'pick' | 'blocked' | 'move' | 'pan';

export type SessionState = {
  ids: number[];
  mode: SessionMode;
  pen: boolean;
  pan: { x: number; y: number; view: ViewState } | null;
  xf: {
    bounds: Box;
    corner: number;
    grab: { x: number; y: number };
    start: { x: number; y: number };
    base: LayerTransform;
    pinch: PagePair | null;
    current: LayerTransform | null;
  } | null;
  maxTouches: number;
  startTime: number;
  startX: number;
  startY: number;
  moved: boolean;
  stroke: Stroke | null;
  layerId: ID | null;
  base: (Pair & { view: ViewState }) | null;
  view: ViewState;
  /** Counts gestures, so a late hold timer cannot act on a newer stroke. */
  token: number;
  holdArmed: boolean;
  tapPending: boolean;
  lastEmptyTap: number;
};

export type SessionEvent =
  | { type: 'down'; all: Touch[]; changed: Touch[]; pointer: Pointer; pressure: number; time: number }
  | { type: 'move'; all: Touch[]; pressure: number }
  | { type: 'up'; changed: Touch[]; time: number }
  | { type: 'cancel' }
  | { type: 'hold'; token: number }
  | { type: 'holdPicked'; token: number }
  | { type: 'tapTimeout' }
  | { type: 'setView'; view: ViewState }
  | { type: 'fit'; flip: boolean };

export type SessionEffect =
  | { kind: 'toast'; message: string }
  | { kind: 'stylusDetected' }
  | { kind: 'holdStart'; token: number }
  | { kind: 'holdCancel' }
  | { kind: 'tapTimerStart' }
  | { kind: 'tapTimerCancel' }
  | { kind: 'sample'; x: number; y: number; reason: 'hold' | 'pick'; token: number }
  | { kind: 'strokeBegin' }
  | { kind: 'strokeExtend' }
  | { kind: 'strokeCancel' }
  | { kind: 'strokeCommit'; stroke: Stroke; layerId: ID }
  | { kind: 'transform'; t: LayerTransform }
  | { kind: 'transformCancel' }
  | { kind: 'transformCommit'; layerId: ID; t: LayerTransform }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'toggleChrome' }
  | { kind: 'view' };

export type SessionResult = { state: SessionState; effects: SessionEffect[] };

export function fitView(
  area: { w: number; h: number },
  bbox: Box,
  pageW: number,
  flip: boolean,
): ViewState {
  'worklet';
  const scale = Math.max(0.01, Math.min((area.w - FIT_PAD * 2) / bbox.w, (area.h - FIT_PAD * 2) / bbox.h));
  const cx = bbox.x + bbox.w / 2;
  return {
    scale,
    rot: 0,
    flip,
    tx: area.w / 2 - (flip ? pageW - cx : cx) * scale,
    ty: area.h / 2 - (bbox.y + bbox.h / 2) * scale,
  };
}

export function createSession(view: ViewState): SessionState {
  'worklet';
  return {
    ids: [],
    mode: 'idle',
    pen: false,
    pan: null,
    xf: null,
    maxTouches: 0,
    startTime: 0,
    startX: 0,
    startY: 0,
    moved: false,
    stroke: null,
    layerId: null,
    base: null,
    view,
    token: 0,
    holdArmed: false,
    tapPending: false,
    lastEmptyTap: 0,
  };
}

function insidePoly(poly: { x: number; y: number }[], x: number, y: number): boolean {
  'worklet';
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function pair(touches: Touch[]): Pair {
  'worklet';
  const p = touches[0];
  const q = touches[1];
  return {
    a: p.id,
    b: q.id,
    cx: (p.x + q.x) / 2,
    cy: (p.y + q.y) / 2,
    dist: Math.max(1, Math.hypot(q.x - p.x, q.y - p.y)),
    angle: Math.atan2(q.y - p.y, q.x - p.x),
  };
}

function pagePair(view: ViewState, pageW: number, touches: Touch[]): PagePair {
  'worklet';
  const p = screenToPage(view, pageW, touches[0].x, touches[0].y);
  const q = screenToPage(view, pageW, touches[1].x, touches[1].y);
  return {
    a: touches[0].id,
    b: touches[1].id,
    cx: (p.x + q.x) / 2,
    cy: (p.y + q.y) / 2,
    dist: Math.max(0.01, Math.hypot(q.x - p.x, q.y - p.y)),
  };
}

function tracked(ids: number[], all: Touch[]): Touch[] {
  'worklet';
  return all.filter(t => ids.includes(t.id));
}

function clearHold(s: SessionState, effects: SessionEffect[]): void {
  'worklet';
  if (s.holdArmed) {
    s.holdArmed = false;
    effects.push({ kind: 'holdCancel' });
  }
}

function cancelStroke(s: SessionState, effects: SessionEffect[]): void {
  'worklet';
  clearHold(s, effects);
  if (s.stroke) {
    s.stroke = null;
    effects.push({ kind: 'strokeCancel' });
  }
}

/** A pinch away from the fit scale is clamped, and a near level rotation snaps to level. */
function pinchedView(base: Pair & { view: ViewState }, cur: Pair, turn: number, env: SessionEnv): ViewState {
  'worklet';
  const b = base.view;
  const fit = fitView(env.area, env.bbox, env.pageW, b.flip).scale;
  const scale = Math.max(fit * ZOOM_MIN, Math.min(fit * ZOOM_MAX, b.scale * (cur.dist / base.dist)));
  let rot = b.rot + turn;
  rot = Math.atan2(Math.sin(rot), Math.cos(rot));
  if (Math.abs(rot) < SNAP_ANGLE) {
    rot = 0;
  }
  const dx = base.cx - b.tx;
  const dy = base.cy - b.ty;
  const c0 = Math.cos(-b.rot);
  const s0 = Math.sin(-b.rot);
  const qx = ((dx * c0 - dy * s0) / b.scale) * scale;
  const qy = ((dx * s0 + dy * c0) / b.scale) * scale;
  const c1 = Math.cos(rot);
  const s1 = Math.sin(rot);
  return {
    scale,
    rot,
    flip: b.flip,
    tx: cur.cx - (qx * c1 - qy * s1),
    ty: cur.cy - (qx * s1 + qy * c1),
  };
}

function startDraw(s: SessionState, t: Touch, pressure: number, env: SessionEnv, effects: SessionEffect[]): void {
  'worklet';
  const layer = env.layer;
  if (!layer || layer.locked || !layer.visible) {
    s.mode = 'blocked';
    effects.push({ kind: 'toast', message: layer?.locked ? 'Layer is locked' : 'Layer is hidden' });
    return;
  }
  const p = screenToPage(s.view, env.pageW, t.x, t.y);
  if (env.tool === 'move') {
    const bounds = layer.bounds;
    if (!bounds) {
      s.mode = 'blocked';
      effects.push({ kind: 'toast', message: 'Layer is empty' });
      return;
    }
    s.mode = 'move';
    s.layerId = layer.id;
    const corner = hitCorner(bounds, p.x, p.y, HANDLE_REACH / s.view.scale);
    s.xf = {
      bounds,
      corner,
      grab: corner >= 0 ? cornerOffset(bounds, corner, p.x, p.y) : { x: 0, y: 0 },
      start: p,
      base: IDENTITY_TRANSFORM,
      pinch: null,
      current: null,
    };
    return;
  }
  const tool = env.tool as StrokeTool;
  const withPressure = !isShapeTool(tool) && !isFillTool(tool) && s.pen;
  const points: number[] = [];
  if (withPressure) {
    appendPressurePoint(points, p.x, p.y, pressure, 0);
  } else {
    appendPoint(points, p.x, p.y, 0);
  }
  s.mode = 'draw';
  s.layerId = layer.id;
  const stroke: Stroke = { tool, color: env.color, size: env.size, opacity: env.opacity, points };
  if (withPressure) {
    stroke.pressure = true;
  }
  if (env.tone !== null && tool !== 'eraser') {
    stroke.tone = { density: env.tone };
  }
  s.stroke = stroke;
  s.holdArmed = true;
  effects.push({ kind: 'strokeBegin' });
  effects.push({ kind: 'holdStart', token: s.token });
}

function onDown(
  state: SessionState,
  e: Extract<SessionEvent, { type: 'down' }>,
  env: SessionEnv,
  effects: SessionEffect[],
): SessionState {
  'worklet';
  const s = { ...state };
  const ids = e.all.length <= e.changed.length ? [] : [...s.ids];
  const first = ids.length === 0;
  e.changed.forEach(t => {
    if (!ids.includes(t.id)) {
      ids.push(t.id);
    }
  });
  s.ids = ids;
  const touches = tracked(ids, e.all);
  if (first) {
    const t = e.changed[0];
    s.maxTouches = 1;
    s.startTime = e.time;
    s.startX = t.x;
    s.startY = t.y;
    s.moved = false;
    s.base = null;
    s.pan = null;
    s.xf = null;
    s.token = s.token + 1;
    s.pen = e.pointer === 'stylus';
    if (s.pen && !env.stylusMode) {
      effects.push({ kind: 'stylusDetected' });
      effects.push({ kind: 'toast', message: 'Stylus detected. One finger now pans the view.' });
    }
    if (env.picking) {
      s.mode = 'pick';
    } else if (env.stylusMode && e.pointer === 'touch') {
      s.mode = 'pan';
      s.pan = { x: t.x, y: t.y, view: s.view };
    } else {
      startDraw(s, t, e.pressure, env, effects);
    }
    return s;
  }
  // A palm landing beside the pen: the pen keeps drawing and the palm never existed.
  if (s.mode === 'draw' && s.pen && e.pointer === 'touch') {
    s.ids = ids.filter(id => !e.changed.some(t => t.id === id));
    return s;
  }
  s.maxTouches = Math.max(s.maxTouches, ids.length);
  if (s.mode === 'draw') {
    cancelStroke(s, effects);
  }
  if (s.mode === 'move' && s.xf) {
    s.xf = {
      ...s.xf,
      base: s.xf.current ?? IDENTITY_TRANSFORM,
      pinch: touches.length >= 2 ? pagePair(s.view, env.pageW, touches) : null,
    };
    return s;
  }
  if (s.mode !== 'view') {
    s.mode = 'view';
    s.moved = false;
  }
  s.base = touches.length >= 2 ? { ...pair(touches), view: s.view } : null;
  return s;
}

function finishStroke(s: SessionState, effects: SessionEffect[]): void {
  'worklet';
  const stroke = s.stroke;
  const layerId = s.layerId;
  s.stroke = null;
  if (!stroke) {
    return;
  }
  const valid = isShapeTool(stroke.tool)
    ? s.moved && stroke.points.length >= 4
    : !isFillTool(stroke.tool) || (s.moved && stroke.points.length >= 6);
  if (valid && layerId) {
    effects.push({ kind: 'strokeCommit', stroke, layerId });
  } else {
    effects.push({ kind: 'strokeCancel' });
  }
}

function moveDraw(s: SessionState, t: Touch, pressure: number, env: SessionEnv, effects: SessionEffect[]): void {
  'worklet';
  const stroke = s.stroke as Stroke;
  if (!s.moved && Math.hypot(t.x - s.startX, t.y - s.startY) > DRAW_SLOP) {
    s.moved = true;
    clearHold(s, effects);
  }
  const p = screenToPage(s.view, env.pageW, t.x, t.y);
  const gap = Math.max(0.3, 1.5 / s.view.scale);
  if (isShapeTool(stroke.tool)) {
    const x0 = stroke.points[0];
    const y0 = stroke.points[1];
    s.stroke = { ...stroke, points: [x0, y0, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] };
    effects.push({ kind: 'strokeExtend' });
    return;
  }
  const added = stroke.pressure
    ? appendPressurePoint(stroke.points, p.x, p.y, pressure, gap)
    : appendPoint(stroke.points, p.x, p.y, gap);
  if (!added) {
    return;
  }
  effects.push({ kind: 'strokeExtend' });
  if (stroke.points.length / (stroke.pressure ? 3 : 2) >= STROKE_POINT_LIMIT) {
    clearHold(s, effects);
    s.moved = true;
    finishStroke(s, effects);
    s.mode = 'blocked';
  }
}

function moveLayer(s: SessionState, touches: Touch[], env: SessionEnv, effects: SessionEffect[]): void {
  'worklet';
  const xf = s.xf as NonNullable<SessionState['xf']>;
  let next: LayerTransform | null = null;
  if (xf.pinch) {
    if (touches.length >= 2) {
      const cur = pagePair(s.view, env.pageW, touches);
      const slop = PINCH_SLOP / s.view.scale;
      const shifted =
        Math.abs(cur.dist - xf.pinch.dist) > slop || Math.hypot(cur.cx - xf.pinch.cx, cur.cy - xf.pinch.cy) > slop;
      if (cur.a === xf.pinch.a && cur.b === xf.pinch.b && (s.moved || shifted)) {
        s.moved = true;
        next = composeTransform(xf.base, pinchTransform(xf.pinch, cur));
      }
    }
  } else if (touches.length === 1) {
    if (!s.moved && Math.hypot(touches[0].x - s.startX, touches[0].y - s.startY) <= MOVE_SLOP) {
      return;
    }
    const p = screenToPage(s.view, env.pageW, touches[0].x, touches[0].y);
    s.moved = true;
    next =
      xf.corner >= 0
        ? cornerScale(xf.bounds, xf.corner, p.x + xf.grab.x, p.y + xf.grab.y)
        : { s: 1, tx: p.x - xf.start.x, ty: p.y - xf.start.y };
  }
  if (next) {
    s.xf = { ...xf, current: next };
    effects.push({ kind: 'transform', t: next });
  }
}

function moveView(s: SessionState, touches: Touch[], env: SessionEnv, effects: SessionEffect[]): void {
  'worklet';
  const cur = pair(touches);
  if (!s.base || s.base.a !== cur.a || s.base.b !== cur.b) {
    s.base = { ...cur, view: s.view };
    return;
  }
  const b = s.base;
  const ratio = cur.dist / b.dist;
  let turn = cur.angle - b.angle;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  if (
    !s.moved &&
    (Math.hypot(cur.cx - b.cx, cur.cy - b.cy) > VIEW_SLOP || Math.abs(ratio - 1) > 0.06 || Math.abs(turn) > 0.08)
  ) {
    s.moved = true;
  }
  if (s.moved) {
    s.view = pinchedView(b, cur, turn, env);
    effects.push({ kind: 'view' });
  }
}

function onMove(
  state: SessionState,
  e: Extract<SessionEvent, { type: 'move' }>,
  env: SessionEnv,
  effects: SessionEffect[],
): SessionState {
  'worklet';
  const touches = tracked(state.ids, e.all);
  if (state.mode === 'draw' && state.stroke && touches.length === 1) {
    const s = { ...state };
    moveDraw(s, touches[0], e.pressure, env, effects);
    return s;
  }
  if (state.mode === 'move' && state.xf) {
    const s = { ...state };
    moveLayer(s, touches, env, effects);
    return s;
  }
  if (state.mode === 'pan' && state.pan && touches.length === 1) {
    const { pan } = state;
    const t = touches[0];
    effects.push({ kind: 'view' });
    return {
      ...state,
      moved: true,
      view: { ...pan.view, tx: pan.view.tx + t.x - pan.x, ty: pan.view.ty + t.y - pan.y },
    };
  }
  if (state.mode !== 'view' || touches.length < 2) {
    return state;
  }
  const s = { ...state };
  moveView(s, touches, env, effects);
  return s;
}

function finishTap(s: SessionState, env: SessionEnv, effects: SessionEffect[]): void {
  'worklet';
  if (s.maxTouches === 3) {
    effects.push({ kind: 'redo' });
  } else if (s.maxTouches === 2) {
    if (s.tapPending) {
      s.tapPending = false;
      s.view = fitView(env.area, env.bbox, env.pageW, s.view.flip);
      effects.push({ kind: 'tapTimerCancel' });
      effects.push({ kind: 'view' });
    } else {
      s.tapPending = true;
      effects.push({ kind: 'tapTimerStart' });
    }
  }
}

/** Two quick taps outside the panel hide or show the floating panels. */
function emptyTap(s: SessionState, time: number, effects: SessionEffect[]): void {
  'worklet';
  if (s.lastEmptyTap && time - s.lastEmptyTap < TAP_MS) {
    s.lastEmptyTap = 0;
    effects.push({ kind: 'toggleChrome' });
  } else {
    s.lastEmptyTap = time;
  }
}

function isEmptyTap(s: SessionState, time: number, env: SessionEnv): boolean {
  'worklet';
  if (s.moved || time - s.startTime >= TAP_MS) {
    return false;
  }
  const p = screenToPage(s.view, env.pageW, s.startX, s.startY);
  return !insidePoly(env.poly, p.x, p.y);
}

function onUp(
  state: SessionState,
  e: Extract<SessionEvent, { type: 'up' }>,
  env: SessionEnv,
  effects: SessionEffect[],
): SessionState {
  'worklet';
  const s = { ...state };
  s.ids = s.ids.filter(id => !e.changed.some(t => t.id === id));
  if (s.ids.length > 0) {
    s.base = null;
    return s;
  }
  clearHold(s, effects);
  if (s.mode === 'draw' && s.stroke) {
    if (isEmptyTap(s, e.time, env)) {
      cancelStroke(s, effects);
      emptyTap(s, e.time, effects);
    } else {
      finishStroke(s, effects);
    }
  } else if (s.mode === 'move' && s.layerId) {
    const pending = s.xf?.current ?? null;
    if (pending && !isIdentityTransform(pending)) {
      effects.push({ kind: 'transformCommit', layerId: s.layerId, t: pending });
    } else {
      effects.push({ kind: 'transformCancel' });
      if (!s.moved && s.maxTouches >= 2 && e.time - s.startTime < TAP_MS) {
        finishTap(s, env, effects);
      }
    }
    s.xf = null;
  } else if (s.mode === 'pick') {
    const t = e.changed[0];
    const p = screenToPage(s.view, env.pageW, t ? t.x : s.startX, t ? t.y : s.startY);
    effects.push({ kind: 'sample', x: p.x, y: p.y, reason: 'pick', token: s.token });
  } else if (s.mode === 'view' && !s.moved && e.time - s.startTime < TAP_MS) {
    finishTap(s, env, effects);
  } else if (s.mode === 'pan' && isEmptyTap(s, e.time, env)) {
    emptyTap(s, e.time, effects);
  }
  s.mode = 'idle';
  return s;
}

function onCancel(state: SessionState, effects: SessionEffect[]): SessionState {
  'worklet';
  const s = { ...state };
  s.ids = [];
  cancelStroke(s, effects);
  if (s.xf) {
    s.xf = null;
    effects.push({ kind: 'transformCancel' });
  }
  s.pan = null;
  s.mode = 'idle';
  return s;
}

function onHold(
  state: SessionState,
  e: Extract<SessionEvent, { type: 'hold' }>,
  env: SessionEnv,
  effects: SessionEffect[],
): SessionState {
  'worklet';
  if (!state.holdArmed || e.token !== state.token) {
    return state;
  }
  const s = { ...state, holdArmed: false };
  if (s.mode === 'draw' && !s.moved) {
    const p = screenToPage(s.view, env.pageW, s.startX, s.startY);
    effects.push({ kind: 'sample', x: p.x, y: p.y, reason: 'hold', token: s.token });
  }
  return s;
}

/** The JS side found a color under the finger, so the dot under it was never a stroke. */
function onHoldPicked(
  state: SessionState,
  e: Extract<SessionEvent, { type: 'holdPicked' }>,
  effects: SessionEffect[],
): SessionState {
  'worklet';
  if (e.token !== state.token || state.mode !== 'draw' || state.moved) {
    return state;
  }
  const s = { ...state };
  cancelStroke(s, effects);
  s.mode = 'blocked';
  return s;
}

export function reduceSession(state: SessionState, event: SessionEvent, env: SessionEnv): SessionResult {
  'worklet';
  const effects: SessionEffect[] = [];
  let next = state;
  switch (event.type) {
    case 'down':
      next = onDown(state, event, env, effects);
      break;
    case 'move':
      next = onMove(state, event, env, effects);
      break;
    case 'up':
      next = onUp(state, event, env, effects);
      break;
    case 'cancel':
      next = onCancel(state, effects);
      break;
    case 'hold':
      next = onHold(state, event, env, effects);
      break;
    case 'holdPicked':
      next = onHoldPicked(state, event, effects);
      break;
    case 'tapTimeout':
      if (state.tapPending) {
        next = { ...state, tapPending: false };
        effects.push({ kind: 'undo' });
      }
      break;
    case 'setView':
      next = { ...state, view: event.view };
      effects.push({ kind: 'view' });
      break;
    case 'fit':
      next = { ...state, view: fitView(env.area, env.bbox, env.pageW, event.flip) };
      effects.push({ kind: 'view' });
      break;
  }
  return { state: next, effects };
}
