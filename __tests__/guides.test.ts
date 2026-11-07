import {
  defaultGuide,
  followsPerspective,
  guideHandles,
  hitHandle,
  mirrorAxis,
  mirrorStroke,
  moveHandle,
  pickDirection,
  projectOnLine,
  snapDirections,
  snaps,
} from '../src/core/art/guides';
import { coverImageRect } from '../src/core/art/strokes';
import type { Stroke } from '../src/core/model/types';

const box = { x: 100, y: 200, w: 400, h: 300 };

describe('guides', () => {
  it('centres symmetry and puts both vanishing points on one horizon', () => {
    expect(defaultGuide('symmetry', box)).toEqual({ kind: 'symmetry', x: 300 });
    const two = defaultGuide('twoPoint', box);
    expect(two.kind === 'twoPoint' && two.a.y === two.b.y).toBe(true);
  });

  it('finds a dot within reach and moves that dot only', () => {
    const two = defaultGuide('twoPoint', box);
    const [a, b] = guideHandles(two, box);
    expect(hitHandle(two, box, b.x + 3, b.y, 10)).toBe(1);
    expect(hitHandle(two, box, 300, 490, 10)).toBe(-1);
    const moved = moveHandle(two, 1, { x: 900, y: 40 }, box);
    expect(guideHandles(moved, box)).toEqual([a, { x: 900, y: 40 }]);
  });

  it('keeps the symmetry axis inside the panel', () => {
    expect(moveHandle({ kind: 'symmetry', x: 300 }, 0, { x: 9999, y: 0 }, box)).toEqual({ kind: 'symmetry', x: 500 });
  });

  it('offers the vanishing point, level and upright for one point', () => {
    const directions = snapDirections({ kind: 'onePoint', a: { x: 100, y: 0 } }, { x: 0, y: 0 });
    expect(directions).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('picks the closest line whichever way the pen travels', () => {
    const directions = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(pickDirection(directions, -10, 1)).toEqual({ x: 1, y: 0 });
    expect(pickDirection(directions, 1, -10)).toEqual({ x: 0, y: 1 });
    expect(pickDirection(directions, 0, 0)).toBeNull();
  });

  it('projects the pen onto the chosen line', () => {
    expect(projectOnLine({ x: 10, y: 10 }, { x: 1, y: 0 }, { x: 40, y: 77 })).toEqual({ x: 40, y: 10 });
  });

  it('only rules pens and straight lines', () => {
    expect(followsPerspective('gpen')).toBe(true);
    expect(followsPerspective('line')).toBe(true);
    expect(followsPerspective('rect')).toBe(false);
    expect(followsPerspective('eraser')).toBe(false);
    expect(followsPerspective('fill')).toBe(false);
    expect(snaps({ kind: 'symmetry', x: 1 }, 'gpen')).toBe(false);
    expect(snaps(null, 'gpen')).toBe(false);
  });

  it('mirrors x and leaves y and pressure alone', () => {
    const stroke: Stroke = { tool: 'gpen', color: '#000', size: 4, opacity: 1, pressure: true, points: [10, 5, 0.5, 30, 6, 0.9] };
    expect(mirrorStroke(stroke, 100).points).toEqual([190, 5, 0.5, 170, 6, 0.9]);
    expect(stroke.points[0]).toBe(10);
    expect(mirrorAxis({ kind: 'symmetry', x: 42 })).toBe(42);
    expect(mirrorAxis({ kind: 'onePoint', a: { x: 0, y: 0 } })).toBeNull();
  });
});

describe('coverImageRect', () => {
  it('fills the box, centred, and overflows on one side', () => {
    expect(coverImageRect(300, 100, { x: 0, y: 0, w: 100, h: 100 })).toEqual({ x: -100, y: 0, w: 300, h: 100 });
  });
});
