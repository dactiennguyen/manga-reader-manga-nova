import {
  HOLD_MS,
  SNAP_ANGLE,
  TAP_MS,
  ZOOM_MAX,
  ZOOM_MIN,
  createSession,
  fitView,
  reduceSession,
  type Pointer,
  type SessionEffect,
  type SessionEnv,
  type SessionEvent,
  type SessionState,
  type Touch,
} from '../src/core/art/session';
import { STROKE_POINT_LIMIT } from '../src/core/art/strokes';
import { screenToPage } from '../src/core/art/tools';

const bbox = { x: 100, y: 100, w: 400, h: 400 };

const baseEnv: SessionEnv = {
  tool: 'gpen',
  size: 6,
  opacity: 1,
  color: '#000000',
  tone: null,
  picking: false,
  stylusMode: false,
  pageW: 1000,
  area: { w: 1000, h: 1000 },
  bbox,
  poly: [
    { x: 100, y: 100 },
    { x: 500, y: 100 },
    { x: 500, y: 500 },
    { x: 100, y: 500 },
  ],
  layer: { id: 'layer', locked: false, visible: true, bounds: null },
};

const identity = { tx: 0, ty: 0, scale: 1, rot: 0, flip: false };

/** Drives the reducer like the gesture layer does, keeping every effect it asked for. */
function rig(env: Partial<SessionEnv> = {}, view = identity) {
  const r = {
    state: createSession(view) as SessionState,
    env: { ...baseEnv, ...env } as SessionEnv,
    effects: [] as SessionEffect[],
    touches: new Map<number, Touch>(),
    time: 1000,
    send(event: SessionEvent): SessionEffect[] {
      const out = reduceSession(r.state, event, r.env);
      r.state = out.state;
      r.effects.push(...out.effects);
      return out.effects;
    },
    down(id: number, x: number, y: number, pointer: Pointer = 'touch', pressure = 0.5): SessionEffect[] {
      const t = { id, x, y };
      r.touches.set(id, t);
      return r.send({ type: 'down', all: [...r.touches.values()], changed: [t], pointer, pressure, time: r.time });
    },
    move(id: number, x: number, y: number, pressure = 0.5): SessionEffect[] {
      r.touches.set(id, { id, x, y });
      return r.send({ type: 'move', all: [...r.touches.values()], pressure });
    },
    up(id: number): SessionEffect[] {
      const t = r.touches.get(id) as Touch;
      r.touches.delete(id);
      return r.send({ type: 'up', changed: [t], time: r.time });
    },
    tap(ids: number[]): void {
      ids.forEach((id, i) => r.down(id, 300 + i * 40, 300));
      r.time += 60;
      ids.forEach(id => r.up(id));
    },
    has(kind: SessionEffect['kind']): boolean {
      return r.effects.some(e => e.kind === kind);
    },
    find<K extends SessionEffect['kind']>(kind: K): Extract<SessionEffect, { kind: K }> {
      return r.effects.find(e => e.kind === kind) as Extract<SessionEffect, { kind: K }>;
    },
  };
  return r;
}

describe('undo and redo taps', () => {
  it('two-finger tap undoes once the double-tap window passes', () => {
    const r = rig();
    r.tap([1, 2]);
    expect(r.has('tapTimerStart')).toBe(true);
    expect(r.has('undo')).toBe(false);
    r.send({ type: 'tapTimeout' });
    expect(r.has('undo')).toBe(true);
  });

  it('three-finger tap redoes', () => {
    const r = rig();
    r.tap([1, 2, 3]);
    expect(r.has('redo')).toBe(true);
    expect(r.has('undo')).toBe(false);
    expect(r.has('tapTimerStart')).toBe(false);
  });

  it('two-finger double tap resets the view and does not undo', () => {
    const r = rig({}, { tx: 40, ty: 90, scale: 3, rot: 0.8, flip: false });
    r.tap([1, 2]);
    r.time += 100;
    r.tap([1, 2]);
    expect(r.has('tapTimerCancel')).toBe(true);
    expect(r.state.view).toEqual(fitView(r.env.area, bbox, r.env.pageW, false));
    r.send({ type: 'tapTimeout' });
    expect(r.has('undo')).toBe(false);
  });

  it('keeps the mirror flip when resetting', () => {
    const r = rig({}, { ...identity, flip: true });
    r.tap([1, 2]);
    r.tap([1, 2]);
    expect(r.state.view.flip).toBe(true);
  });

  it('a slow two-finger press is not a tap', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.down(2, 340, 300);
    r.time += TAP_MS + 1;
    r.up(1);
    r.up(2);
    expect(r.has('tapTimerStart')).toBe(false);
  });

  it('a two-finger drag is not a tap', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.down(2, 340, 300);
    r.move(1, 360, 300);
    r.move(2, 400, 300);
    r.time += 50;
    r.up(1);
    r.up(2);
    expect(r.has('tapTimerStart')).toBe(false);
  });

  it('the tap gesture cancels the dot its first finger started', () => {
    const r = rig();
    r.tap([1, 2]);
    expect(r.has('strokeBegin')).toBe(true);
    expect(r.has('strokeCancel')).toBe(true);
    expect(r.has('strokeCommit')).toBe(false);
  });
});

describe('hold to pick a color', () => {
  it('holds still, asks for a sample at the press point, then drops the stroke', () => {
    const r = rig();
    r.down(1, 300, 320);
    const start = r.find('holdStart');
    expect(HOLD_MS).toBe(550);
    r.send({ type: 'hold', token: start.token });
    const sample = r.find('sample');
    expect(sample).toMatchObject({ x: 300, y: 320, reason: 'hold' });
    r.send({ type: 'holdPicked', token: sample.token });
    expect(r.has('strokeCancel')).toBe(true);
    expect(r.state.mode).toBe('blocked');
    r.up(1);
    expect(r.has('strokeCommit')).toBe(false);
    expect(r.state.mode).toBe('idle');
  });

  it('keeps drawing when there was no color under the finger', () => {
    const r = rig();
    r.down(1, 300, 320);
    r.send({ type: 'hold', token: r.find('holdStart').token });
    r.time += 700;
    r.up(1);
    expect(r.has('strokeCommit')).toBe(true);
  });

  it('moving past the slop disarms the hold', () => {
    const r = rig();
    r.down(1, 300, 300);
    const { token } = r.find('holdStart');
    r.move(1, 320, 300);
    expect(r.has('holdCancel')).toBe(true);
    r.send({ type: 'hold', token });
    expect(r.has('sample')).toBe(false);
  });

  it('a small wobble inside the slop keeps the hold', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.move(1, 304, 303);
    r.send({ type: 'hold', token: r.find('holdStart').token });
    expect(r.has('sample')).toBe(true);
  });

  it('ignores a timer from an earlier stroke', () => {
    const r = rig();
    r.down(1, 300, 300);
    const stale = r.find('holdStart').token;
    r.time += 2000;
    r.up(1);
    r.effects.length = 0;
    r.down(1, 300, 300);
    r.send({ type: 'hold', token: stale });
    expect(r.has('sample')).toBe(false);
  });

  it('a late pick result cannot cancel a stroke already moving', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.send({ type: 'hold', token: r.find('holdStart').token });
    const { token } = r.find('sample');
    r.move(1, 340, 300);
    r.send({ type: 'holdPicked', token });
    expect(r.state.mode).toBe('draw');
    expect(r.has('strokeCancel')).toBe(false);
  });
});

describe('drawing', () => {
  it('commits a stroke in page coordinates on lift', () => {
    const r = rig({}, { tx: 100, ty: 50, scale: 2, rot: 0, flip: false });
    r.down(1, 500, 450);
    r.move(1, 540, 450);
    r.move(1, 580, 470);
    r.time += 500;
    r.up(1);
    const { stroke, layerId } = r.find('strokeCommit');
    expect(layerId).toBe('layer');
    expect(stroke.points).toEqual([200, 200, 220, 200, 240, 210]);
    expect(stroke.pressure).toBeUndefined();
    expect(r.state.stroke).toBeNull();
    expect(r.state.mode).toBe('idle');
  });

  it('a second finger cancels the stroke and starts a view gesture', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.move(1, 340, 300);
    r.down(2, 400, 300);
    expect(r.has('strokeCancel')).toBe(true);
    expect(r.state.mode).toBe('view');
    r.up(2);
    r.up(1);
    expect(r.has('strokeCommit')).toBe(false);
  });

  it('never moves the view while a stroke is down', () => {
    const r = rig();
    const before = r.state.view;
    r.down(1, 300, 300);
    for (let i = 1; i < 30; i++) {
      r.move(1, 300 + i * 10, 300 + i);
    }
    expect(r.state.view).toBe(before);
    expect(r.has('view')).toBe(false);
  });

  it('drops points closer than the zoom-scaled gap', () => {
    const r = rig({}, { ...identity, scale: 1 });
    r.down(1, 300, 300);
    r.move(1, 301, 300);
    expect(r.state.stroke?.points).toEqual([300, 300]);
    r.move(1, 302, 300);
    expect(r.state.stroke?.points).toEqual([300, 300, 302, 300]);
  });

  it('keeps a finer gap when zoomed in', () => {
    const r = rig({}, { ...identity, scale: 5 });
    r.down(1, 300, 300);
    r.move(1, 302, 300);
    expect(r.state.stroke?.points).toEqual([60, 60, 60.4, 60]);
  });

  it('ends a stroke by itself at the point limit', () => {
    const r = rig();
    r.down(1, 0, 0);
    for (let i = 1; i < STROKE_POINT_LIMIT + 50; i++) {
      r.move(1, i * 2, 0);
    }
    expect(r.find('strokeCommit').stroke.points.length).toBe(STROKE_POINT_LIMIT * 2);
    expect(r.state.mode).toBe('blocked');
    r.time += 20000;
    r.up(1);
    expect(r.effects.filter(e => e.kind === 'strokeCommit')).toHaveLength(1);
  });

  it('shape tools keep two points and need a drag', () => {
    const r = rig({ tool: 'rect' });
    r.down(1, 300, 300);
    r.time += 500;
    r.up(1);
    expect(r.has('strokeCommit')).toBe(false);
    r.down(1, 300, 300);
    r.move(1, 350, 320);
    r.move(1, 400, 340);
    r.up(1);
    expect(r.find('strokeCommit').stroke.points).toEqual([300, 300, 400, 340]);
  });

  it('a lasso needs three points and a drag', () => {
    const r = rig({ tool: 'fill' });
    r.down(1, 300, 300);
    r.move(1, 330, 300);
    r.time += 500;
    r.up(1);
    expect(r.has('strokeCommit')).toBe(false);
    r.down(1, 300, 300);
    r.move(1, 330, 300);
    r.move(1, 330, 330);
    r.up(1);
    expect(r.has('strokeCommit')).toBe(true);
  });

  it('adds tone to tools that take it, never to the eraser', () => {
    const r = rig({ tool: 'brush', tone: 0.25 });
    r.down(1, 300, 300);
    expect(r.state.stroke?.tone).toEqual({ density: 0.25 });
    const e = rig({ tool: 'eraser', tone: 0.25 });
    e.down(1, 300, 300);
    expect(e.state.stroke?.tone).toBeUndefined();
  });

  it('refuses a locked, hidden or missing layer', () => {
    const locked = rig({ layer: { id: 'l', locked: true, visible: true, bounds: null } });
    locked.down(1, 300, 300);
    expect(locked.state.mode).toBe('blocked');
    expect(locked.find('toast').message).toBe('Layer is locked');
    const hidden = rig({ layer: { id: 'l', locked: false, visible: false, bounds: null } });
    hidden.down(1, 300, 300);
    expect(hidden.find('toast').message).toBe('Layer is hidden');
    const none = rig({ layer: null });
    none.down(1, 300, 300);
    expect(none.state.mode).toBe('blocked');
  });

  it('a system cancel drops everything', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.send({ type: 'cancel' });
    expect(r.has('strokeCancel')).toBe(true);
    expect(r.has('holdCancel')).toBe(true);
    expect(r.state.mode).toBe('idle');
    expect(r.state.ids).toEqual([]);
  });
});

describe('stylus', () => {
  it('announces the stylus on its first touch', () => {
    const r = rig();
    r.down(1, 300, 300, 'stylus');
    expect(r.has('stylusDetected')).toBe(true);
    expect(r.find('toast').message).toContain('Stylus');
    expect(r.state.mode).toBe('draw');
  });

  it('the pen draws with pressure', () => {
    const r = rig({ stylusMode: true });
    r.down(1, 300, 300, 'stylus', 0.4);
    r.move(1, 310, 300, 0.8);
    r.time += 500;
    r.up(1);
    const { stroke } = r.find('strokeCommit');
    expect(stroke.pressure).toBe(true);
    expect(stroke.points).toEqual([300, 300, 0.4, 310, 300, 0.8]);
    expect(r.has('stylusDetected')).toBe(false);
  });

  it('a finger pans the view instead of drawing', () => {
    const r = rig({ stylusMode: true }, { ...identity, tx: 10, ty: 20 });
    r.down(1, 300, 300);
    expect(r.state.mode).toBe('pan');
    expect(r.has('strokeBegin')).toBe(false);
    r.move(1, 330, 280);
    expect(r.state.view).toMatchObject({ tx: 40, ty: 0, scale: 1 });
    expect(r.has('view')).toBe(true);
  });

  it('ignores a palm while the pen is drawing', () => {
    const r = rig({ stylusMode: true });
    r.down(1, 300, 300, 'stylus');
    r.down(2, 600, 600, 'touch');
    expect(r.state.mode).toBe('draw');
    expect(r.has('strokeCancel')).toBe(false);
    r.move(2, 620, 620);
    r.move(1, 330, 300);
    r.time += 500;
    r.up(2);
    r.up(1);
    expect(r.find('strokeCommit').stroke.points).toEqual([300, 300, 0.5, 330, 300, 0.5]);
  });

  it('a second pen event during a pen stroke still cancels, only fingers are palms', () => {
    const r = rig({ stylusMode: true });
    r.down(1, 300, 300, 'stylus');
    r.down(2, 320, 300, 'stylus');
    expect(r.has('strokeCancel')).toBe(true);
  });

  it('two fingers still zoom in stylus mode', () => {
    const r = rig({ stylusMode: true });
    r.down(1, 300, 300);
    r.down(2, 400, 300);
    expect(r.state.mode).toBe('view');
    r.move(2, 500, 300);
    expect(r.state.view.scale).toBeGreaterThan(1);
  });
});

describe('two-finger view', () => {
  const start = (env: Partial<SessionEnv> = {}, view = identity) => {
    const r = rig(env, view);
    r.down(1, 400, 500);
    r.down(2, 600, 500);
    return r;
  };

  it('zooms about the pinch centre', () => {
    const r = start();
    const anchor = screenToPage(r.state.view, r.env.pageW, 500, 500);
    r.move(1, 300, 500);
    r.move(2, 700, 500);
    expect(r.state.view.scale).toBeCloseTo(2);
    const after = screenToPage(r.state.view, r.env.pageW, 500, 500);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it('pans with both fingers', () => {
    const r = start();
    r.move(1, 450, 540);
    r.move(2, 650, 540);
    expect(r.state.view.tx).toBeCloseTo(50);
    expect(r.state.view.ty).toBeCloseTo(40);
    expect(r.state.view.scale).toBeCloseTo(1);
  });

  it('rotates with a twist', () => {
    const r = start();
    r.move(1, 500 - 100 * Math.cos(0.5), 500 - 100 * Math.sin(0.5));
    r.move(2, 500 + 100 * Math.cos(0.5), 500 + 100 * Math.sin(0.5));
    expect(r.state.view.rot).toBeCloseTo(0.5);
  });

  it('snaps a near level rotation to level', () => {
    const r = start({}, { ...identity, rot: 0.3 });
    const a = -0.3 + SNAP_ANGLE / 2;
    r.move(1, 500 - 100 * Math.cos(a), 500 - 100 * Math.sin(a));
    r.move(2, 500 + 100 * Math.cos(a), 500 + 100 * Math.sin(a));
    expect(r.state.view.rot).toBe(0);
  });

  it('clamps zoom to the fit scale limits', () => {
    const r = start();
    const fit = fitView(r.env.area, bbox, r.env.pageW, false).scale;
    r.move(1, -90000, 500);
    r.move(2, 90000, 500);
    expect(r.state.view.scale).toBeCloseTo(fit * ZOOM_MAX);
    r.move(1, 499.9, 500);
    r.move(2, 500.1, 500);
    expect(r.state.view.scale).toBeGreaterThanOrEqual(fit * ZOOM_MIN);
  });

  it('holds still under the slop', () => {
    const r = start();
    const before = r.state.view;
    r.move(1, 402, 500);
    expect(r.state.view).toBe(before);
  });

  it('rebases when a finger is swapped', () => {
    const r = start();
    r.move(1, 300, 500);
    r.up(2);
    r.down(3, 700, 500);
    const view = r.state.view;
    r.move(3, 700, 500);
    expect(r.state.view).toEqual(view);
  });
});

describe('move and scale layer', () => {
  const layer = { id: 'layer', locked: false, visible: true, bounds: { x: 200, y: 200, w: 100, h: 100 } };

  it('says so on an empty layer', () => {
    const r = rig({ tool: 'move' });
    r.down(1, 300, 300);
    expect(r.find('toast').message).toBe('Layer is empty');
    expect(r.state.mode).toBe('blocked');
  });

  it('drags the layer', () => {
    const r = rig({ tool: 'move', layer });
    r.down(1, 250, 250);
    r.move(1, 253, 250);
    expect(r.has('transform')).toBe(false);
    r.move(1, 290, 270);
    expect(r.find('transform').t).toEqual({ s: 1, tx: 40, ty: 20 });
    r.up(1);
    expect(r.find('transformCommit')).toMatchObject({ layerId: 'layer', t: { s: 1, tx: 40, ty: 20 } });
  });

  it('scales from a corner handle', () => {
    const r = rig({ tool: 'move', layer });
    r.down(1, 300, 300);
    r.move(1, 400, 400);
    expect(r.state.xf?.current?.s).toBeCloseTo(2);
    r.up(1);
    expect(r.has('transformCommit')).toBe(true);
  });

  it('pinches to scale', () => {
    const r = rig({ tool: 'move', layer });
    r.down(1, 250, 250);
    r.down(2, 270, 250);
    expect(r.state.mode).toBe('move');
    r.move(1, 230, 250);
    r.move(2, 290, 250);
    expect(r.state.xf?.current?.s).toBeCloseTo(3);
  });

  it('a touch that moves nothing commits nothing, and two fingers still undo', () => {
    const r = rig({ tool: 'move', layer });
    r.tap([1, 2]);
    expect(r.has('transformCommit')).toBe(false);
    expect(r.has('transformCancel')).toBe(true);
    expect(r.has('tapTimerStart')).toBe(true);
  });
});

describe('eyedropper', () => {
  it('samples where the finger lifts', () => {
    const r = rig({ picking: true });
    r.down(1, 300, 300);
    r.move(1, 310, 320);
    r.touches.set(1, { id: 1, x: 310, y: 320 });
    r.up(1);
    expect(r.find('sample')).toMatchObject({ x: 310, y: 320, reason: 'pick' });
    expect(r.has('strokeBegin')).toBe(false);
  });
});

describe('empty area', () => {
  it('two quick taps outside the panel toggle the floating panels', () => {
    const r = rig();
    r.down(1, 800, 800);
    r.time += 40;
    r.up(1);
    expect(r.has('toggleChrome')).toBe(false);
    r.time += 100;
    r.down(1, 800, 800);
    r.time += 40;
    r.up(1);
    expect(r.has('toggleChrome')).toBe(true);
    expect(r.has('strokeCommit')).toBe(false);
  });

  it('a tap inside the panel is a dot, not a toggle', () => {
    const r = rig();
    r.down(1, 300, 300);
    r.time += 40;
    r.up(1);
    r.down(1, 300, 300);
    r.time += 40;
    r.up(1);
    expect(r.has('toggleChrome')).toBe(false);
    expect(r.effects.filter(e => e.kind === 'strokeCommit')).toHaveLength(2);
  });

  it('two slow taps do nothing', () => {
    const r = rig();
    r.down(1, 800, 800);
    r.time += 40;
    r.up(1);
    r.time += TAP_MS + 10;
    r.down(1, 800, 800);
    r.time += 40;
    r.up(1);
    expect(r.has('toggleChrome')).toBe(false);
  });
});

describe('view events', () => {
  it('fits a panel inside the padded area', () => {
    const fit = fitView({ w: 1000, h: 600 }, bbox, 1000, false);
    expect(fit.scale).toBeCloseTo((600 - 56) / 400);
    expect(screenToPage(fit, 1000, 500, 300)).toMatchObject({ x: 300, y: 300 });
  });

  it('centres a mirrored panel', () => {
    const fit = fitView({ w: 1000, h: 600 }, bbox, 1000, true);
    const p = screenToPage(fit, 1000, 500, 300);
    expect(p.x).toBeCloseTo(300);
  });

  it('applies a flip through the fit event', () => {
    const r = rig();
    r.send({ type: 'fit', flip: true });
    expect(r.state.view.flip).toBe(true);
    expect(r.has('view')).toBe(true);
  });
});
