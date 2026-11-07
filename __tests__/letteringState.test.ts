import { createBubble } from '../src/core/lettering/bubbles';
import {
  INITIAL_LETTERING,
  cardLift,
  letteringReducer,
  nextTap,
  pinchView,
  stageOf,
  stageToPage,
  type LetteringAction,
  type LetteringState,
} from '../src/core/lettering/letteringState';

const run = (...actions: LetteringAction[]): LetteringState => actions.reduce(letteringReducer, INITIAL_LETTERING);

describe('lettering reducer', () => {
  it('starts idle and does not mutate the previous state', () => {
    const before = { ...INITIAL_LETTERING };
    letteringReducer(INITIAL_LETTERING, { type: 'toggleOrder' });
    expect(INITIAL_LETTERING).toEqual(before);
  });

  it('clears the selection and any sheet when placing starts', () => {
    const state = run(
      { type: 'select', selection: { kind: 'bubble', id: 'a' } },
      { type: 'openSheet', sheet: 'effects' },
      { type: 'pend', pending: { kind: 'effect', type: 'tone' } },
    );
    expect(state).toMatchObject({ selection: null, sheet: null, pending: { kind: 'effect', type: 'tone' } });
  });

  it('opens the editor on a newly placed bubble and shows hidden bubbles', () => {
    const state = run(
      { type: 'toggleBubbles' },
      { type: 'pend', pending: { kind: 'bubble', type: 'speak' } },
      { type: 'placedBubble', id: 'a' },
    );
    expect(state).toMatchObject({
      pending: null,
      hideBubbles: false,
      sheet: 'editor',
      selection: { kind: 'bubble', id: 'a' },
    });
  });

  it('selects a newly placed effect without opening anything', () => {
    const state = run({ type: 'pend', pending: { kind: 'effect', type: 'speed' } }, { type: 'placedEffect', id: 'e' });
    expect(state).toMatchObject({ pending: null, sheet: null, selection: { kind: 'effect', id: 'e' } });
  });

  it('holds a draft and guides during a drag, and drops them at the end', () => {
    const draft = createBubble('speak', { x: 0, y: 0 });
    const dragging = run(
      { type: 'dragBubble', draft, guides: [{ axis: 'x', at: 5 }] },
      { type: 'dragCenter', center: { x: 1, y: 2 } },
    );
    expect(dragging).toMatchObject({ draft, draftCenter: { x: 1, y: 2 }, guides: [{ axis: 'x', at: 5 }] });
    expect(letteringReducer(dragging, { type: 'dragEnd' })).toMatchObject({ draft: null, draftCenter: null, guides: [] });
  });

  it('remembers editing the original until the sheet closes', () => {
    const open = run({ type: 'openEditor', id: 'a' }, { type: 'editOriginal' });
    expect(open).toMatchObject({ sheet: 'editor', originalOpen: true, selection: { kind: 'bubble', id: 'a' } });
    expect(letteringReducer(open, { type: 'closeSheet' })).toMatchObject({
      sheet: null,
      originalOpen: false,
      selection: { kind: 'bubble', id: 'a' },
    });
  });

  it('keeps the item id after the item menu closes, so its rows do not vanish mid-animation', () => {
    const state = run({ type: 'openItem', id: 'a' }, { type: 'closeSheet' });
    expect(state).toMatchObject({ sheet: null, itemId: 'a', selection: { kind: 'bubble', id: 'a' } });
  });

  it('toggles the view switches', () => {
    expect(run({ type: 'toggleOrder' }).showOrder).toBe(true);
    expect(run({ type: 'toggleBubbles' }, { type: 'toggleBubbles' }).hideBubbles).toBe(false);
    expect(run({ type: 'toggleBubbles' }, { type: 'showBubbles' }).hideBubbles).toBe(false);
  });

  it('stores the layout and resets the view to fit with null', () => {
    const state = run({ type: 'layout', box: { w: 300, h: 500 } }, { type: 'setView', view: { z: 2, tx: 1, ty: 1 } });
    expect(state.box).toEqual({ w: 300, h: 500 });
    expect(letteringReducer(state, { type: 'setView', view: null }).view).toBeNull();
  });
});

describe('lettering stage', () => {
  const box = { w: 400, h: 600 };
  const size = { w: 1000, h: 1414 };

  it('maps the page centre to the stage centre at any zoom', () => {
    const stage = stageOf(box, size);
    for (const z of [1, 2.5]) {
      const p = stageToPage(box.w / 2, box.h / 2, box, stage, { z, tx: 0, ty: 0 });
      expect(p.x).toBeCloseTo(size.w / 2);
      expect(p.y).toBeCloseTo(size.h / 2);
    }
  });

  it('fits a tall strip by width and starts at its top', () => {
    const stage = stageOf(box, { w: 1000, h: 8000 });
    expect(stage.tall).toBe(true);
    expect(stage.bw).toBe(376);
    expect(stage.fit.ty).toBeGreaterThan(0);
    expect(stageToPage(box.w / 2, 12, box, stage, stage.fit).y).toBeCloseTo(0);
  });

  it('zooms around the fingers', () => {
    const start = { view0: { z: 1, tx: 0, ty: 0 }, fx: 100, fy: 200 };
    const stage = stageOf(box, size);
    const before = stageToPage(100, 200, box, stage, start.view0);
    const after = stageToPage(100, 200, box, stage, pinchView(start, 2, 100, 200, box));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('limits the zoom', () => {
    const start = { view0: { z: 1, tx: 0, ty: 0 }, fx: 0, fy: 0 };
    expect(pinchView(start, 100, 0, 0, box).z).toBe(6);
    expect(pinchView(start, 0.01, 0, 0, box).z).toBe(0.5);
  });
});

describe('double tap', () => {
  it('needs the same target inside the window', () => {
    const first = nextTap({ time: 0, id: null }, 1000, 'a');
    expect(first.double).toBe(false);
    expect(nextTap(first.mark, 1200, 'a').double).toBe(true);
    expect(nextTap(first.mark, 1200, 'b').double).toBe(false);
    expect(nextTap(first.mark, 1400, 'a').double).toBe(false);
  });

  it('starts over after a double tap', () => {
    const first = nextTap({ time: 0, id: null }, 1000, 'a');
    const second = nextTap(first.mark, 1100, 'a');
    expect(nextTap(second.mark, 1200, 'a').double).toBe(false);
  });
});

describe('keeping the selected bubble above the card', () => {
  const box = { w: 400, h: 600 };
  const size = { w: 1000, h: 1400 };
  const stage = stageOf(box, size);
  const view = stage.fit;
  const stageY = (y: number) => stageToPage(0, y, box, stage, view).y;

  it('leaves a bubble the card does not reach', () => {
    expect(cardLift({ y: 100, h: 100, tail: null }, 200, box, stage, view)).toBe(0);
  });

  it('lifts the page so the bottom clears the card', () => {
    const bubble = { y: stageY(450), h: stageY(550) - stageY(450), tail: null };
    expect(cardLift(bubble, 200, box, stage, view)).toBeCloseTo(550 + 16 - 400);
  });

  it('counts a tail that hangs below the bubble', () => {
    const bubble = { y: stageY(300), h: stageY(350) - stageY(300), tail: { x: 0, y: stageY(500) } };
    expect(cardLift(bubble, 200, box, stage, view)).toBeCloseTo(500 + 16 - 400);
  });

  it('never pushes the top of the bubble off the stage', () => {
    const bubble = { y: stageY(100), h: stageY(590) - stageY(100), tail: null };
    expect(cardLift(bubble, 300, box, stage, view)).toBeCloseTo(100 - 56);
  });
});
