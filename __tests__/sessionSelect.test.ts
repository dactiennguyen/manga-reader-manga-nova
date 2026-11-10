import { affineAngle, affineScale, applyAffine, isIdentityAffine, moveBy } from '../src/core/art/affine';
import {
  ROTATE_STEM,
  createSession,
  reduceSession,
  type SessionEffect,
  type SessionEnv,
  type SessionEvent,
  type SessionState,
  type Touch,
} from '../src/core/art/session';

const bbox = { x: 100, y: 100, w: 400, h: 400 };
/** The selected strokes' box. The view is the identity, so screen and page points are the same. */
const box = { x: 200, y: 200, w: 100, h: 60 };

const baseEnv: SessionEnv = {
  tool: 'select',
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

function rig(env: Partial<SessionEnv> = {}) {
  const r = {
    state: createSession({ tx: 0, ty: 0, scale: 1, rot: 0, flip: false }) as SessionState,
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
    down(id: number, x: number, y: number): SessionEffect[] {
      const t = { id, x, y };
      r.touches.set(id, t);
      return r.send({ type: 'down', all: [...r.touches.values()], changed: [t], pointer: 'touch', pressure: 0.5, time: r.time });
    },
    move(id: number, x: number, y: number): SessionEffect[] {
      r.touches.set(id, { id, x, y });
      return r.send({ type: 'move', all: [...r.touches.values()], pressure: 0.5 });
    },
    up(id: number): SessionEffect[] {
      const t = r.touches.get(id) as Touch;
      r.touches.delete(id);
      return r.send({ type: 'up', changed: [t], time: r.time });
    },
    kinds(): string[] {
      return r.effects.map(e => e.kind);
    },
    find<K extends SessionEffect['kind']>(kind: K): Extract<SessionEffect, { kind: K }> | undefined {
      return [...r.effects].reverse().find(e => e.kind === kind) as Extract<SessionEffect, { kind: K }> | undefined;
    },
  };
  return r;
}

function selected(env: Partial<SessionEnv> = {}) {
  const r = rig(env);
  r.send({ type: 'setSelection', box });
  r.effects = [];
  return r;
}

describe('the lasso', () => {
  it('collects the path and hands it over on lift, without drawing a stroke', () => {
    const r = rig();
    r.down(1, 150, 150);
    r.move(1, 300, 150);
    r.move(1, 300, 300);
    r.move(1, 150, 300);
    expect(r.state.mode).toBe('lasso');
    r.up(1);
    expect(r.find('lassoCommit')?.points).toEqual([150, 150, 300, 150, 300, 300, 150, 300]);
    expect(r.kinds()).not.toContain('strokeBegin');
    expect(r.kinds()).not.toContain('strokeCommit');
    expect(r.kinds()).not.toContain('holdStart');
    expect(r.state.lasso).toBeNull();
    expect(r.state.mode).toBe('idle');
  });

  it('gives way to the view when a second finger lands', () => {
    const r = rig();
    r.down(1, 150, 150);
    r.move(1, 300, 150);
    r.down(2, 400, 400);
    expect(r.state.lasso).toBeNull();
    expect(r.state.mode).toBe('view');
    r.move(1, 250, 150);
    r.move(2, 500, 400);
    expect(r.kinds()).toContain('view');
    r.up(1);
    r.up(2);
    expect(r.kinds()).not.toContain('lassoCommit');
  });

  it('ignores a tap, and a path too short to enclose anything', () => {
    const r = rig();
    r.down(1, 150, 150);
    r.up(1);
    r.down(2, 150, 150);
    r.move(2, 165, 150);
    r.up(2);
    expect(r.kinds()).not.toContain('lassoCommit');
    expect(r.kinds()).not.toContain('selectionDismiss');
  });

  it('refuses a locked or hidden layer with the usual message', () => {
    const locked = rig({ layer: { id: 'layer', locked: true, visible: true, bounds: null } });
    locked.down(1, 150, 150);
    expect(locked.find('toast')?.message).toBe('Layer is locked');
    expect(locked.state.mode).toBe('blocked');
    const hidden = rig({ layer: { id: 'layer', locked: false, visible: false, bounds: null } });
    hidden.down(1, 150, 150);
    expect(hidden.find('toast')?.message).toBe('Layer is hidden');
    expect(hidden.state.lasso).toBeNull();
  });

  it('is cleared by a cancelled gesture', () => {
    const r = rig();
    r.down(1, 150, 150);
    r.move(1, 300, 150);
    r.send({ type: 'cancel' });
    expect(r.state.lasso).toBeNull();
    expect(r.kinds()).not.toContain('lassoCommit');
  });
});

describe('transforming a selection', () => {
  it('moves it when dragged from inside, and reports the transform once on lift', () => {
    const r = selected();
    r.down(1, 250, 230);
    r.move(1, 290, 250);
    expect(r.state.mode).toBe('select');
    expect(r.kinds()).toContain('selection');
    expect(r.kinds()).not.toContain('selectionMatrix');
    r.up(1);
    const m = r.find('selectionMatrix')?.m;
    expect(m).toEqual(moveBy(40, 20));
    expect(r.state.sel?.m).toEqual(moveBy(40, 20));
    expect(r.state.drag).toBeNull();
  });

  it('adds each drag to the one before', () => {
    const r = selected();
    r.down(1, 250, 230);
    r.move(1, 290, 250);
    r.up(1);
    r.down(1, 290, 250);
    r.move(1, 300, 300);
    r.up(1);
    expect(r.state.sel?.m).toEqual(moveBy(50, 70));
  });

  it('scales evenly from a corner, about the opposite corner', () => {
    const r = selected();
    r.down(1, 302, 262);
    r.move(1, 402, 322);
    r.up(1);
    const m = r.state.sel!.m;
    expect(affineScale(m)).toBeCloseTo(2, 6);
    const anchor = applyAffine(m, 200, 200);
    expect(anchor.x).toBeCloseTo(200, 6);
    expect(anchor.y).toBeCloseTo(200, 6);
  });

  it('turns from the handle above the frame', () => {
    const r = selected();
    r.down(1, 250, 200 - ROTATE_STEM);
    r.move(1, 250 + 66, 230);
    r.up(1);
    expect(affineAngle(r.state.sel!.m)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('does nothing on a touch that does not move', () => {
    const r = selected();
    r.down(1, 250, 230);
    r.move(1, 252, 231);
    r.up(1);
    expect(r.kinds()).not.toContain('selectionMatrix');
    expect(isIdentityAffine(r.state.sel!.m)).toBe(true);
  });

  it('puts the selection back and pans the view when a second finger lands mid-drag', () => {
    const r = selected();
    r.down(1, 250, 230);
    r.move(1, 300, 260);
    r.down(2, 400, 400);
    expect(r.state.sel?.m).toEqual(moveBy(0, 0));
    expect(r.state.mode).toBe('view');
    r.move(1, 330, 260);
    r.move(2, 430, 400);
    expect(r.kinds()).toContain('view');
    r.up(1);
    r.up(2);
    expect(r.kinds()).not.toContain('selectionMatrix');
    expect(r.state.sel).not.toBeNull();
  });

  it('asks to close the selection on a tap outside the frame', () => {
    const r = selected();
    r.down(1, 420, 420);
    r.up(1);
    expect(r.kinds()).toContain('selectionDismiss');
    expect(r.kinds()).not.toContain('lassoCommit');
  });

  it('starts a new lasso on a drag outside the frame', () => {
    const r = selected();
    r.down(1, 350, 350);
    r.move(1, 450, 350);
    r.move(1, 450, 450);
    r.move(1, 350, 450);
    r.up(1);
    expect(r.find('lassoCommit')?.points).toHaveLength(8);
    expect(r.kinds()).not.toContain('selectionDismiss');
  });

  it('takes the button actions, and ignores them with nothing selected', () => {
    const r = selected();
    r.send({ type: 'selectionOp', op: 'rotateRight' });
    expect(affineAngle(r.state.sel!.m)).toBeCloseTo(Math.PI / 2, 9);
    expect(r.find('selectionMatrix')?.m).toEqual(r.state.sel!.m);
    const none = rig();
    expect(none.send({ type: 'selectionOp', op: 'flipH' })).toEqual([]);
  });

  it('lets a two-finger tap take back a pending transform before it touches the history', () => {
    const r = selected();
    r.send({ type: 'selectionOp', op: 'flipH' });
    r.down(1, 300, 300);
    r.down(2, 340, 300);
    r.time += 60;
    r.up(1);
    r.up(2);
    r.send({ type: 'tapTimeout' });
    expect(r.kinds()).not.toContain('undo');
    expect(isIdentityAffine(r.state.sel!.m)).toBe(true);
    expect(isIdentityAffine(r.find('selectionMatrix')!.m)).toBe(true);
    r.down(1, 300, 300);
    r.down(2, 340, 300);
    r.time += 60;
    r.up(1);
    r.up(2);
    r.send({ type: 'tapTimeout' });
    expect(r.kinds()).toContain('undo');
  });

  it('starts from rest each time a selection is set, and forgets it when cleared', () => {
    const r = selected();
    r.send({ type: 'selectionOp', op: 'grow' });
    r.send({ type: 'setSelection', box });
    expect(isIdentityAffine(r.state.sel!.m)).toBe(true);
    r.send({ type: 'setSelection', box: null });
    expect(r.state.sel).toBeNull();
    r.down(1, 250, 230);
    expect(r.state.mode).toBe('lasso');
  });

  it('leaves drawing tools alone while a selection is still set', () => {
    const r = selected({ tool: 'gpen' });
    r.down(1, 250, 230);
    expect(r.state.mode).toBe('draw');
  });
});
