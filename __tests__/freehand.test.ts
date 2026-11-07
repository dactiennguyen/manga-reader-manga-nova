import { getStroke, getStrokePoints } from '../src/core/art/freehand';

/** Values printed by the published perfect-freehand 1.2.3 bundle for the same input. */
const GOLDEN = {"n":68,"first":[0.008213699656732958,-0.005703958094953443],"mid":[192.56564051370358,7.350291902003121],"last":[-0.008213699656732958,0.005703958094953443],"sum":10431.148331667673};

describe('vendored perfect-freehand', () => {
  const input: number[][] = [];
  for (let i = 0; i < 40; i++) {
    input.push([i * 5, Math.round(Math.sin(i / 4) * 300) / 10, (i % 7) / 10 + 0.2]);
  }

  it('matches the published bundle', () => {
    const out = getStroke(input, {
      size: 12,
      thinning: 0.64,
      smoothing: 0.52,
      streamline: 0.5,
      simulatePressure: false,
      easing: t => Math.sin((t * Math.PI) / 2),
      start: { taper: 14, cap: true },
      end: { taper: 28, cap: true },
      last: true,
    });
    expect(out).toHaveLength(GOLDEN.n);
    expect(out[0]).toEqual(GOLDEN.first);
    expect(out[Math.floor(out.length / 2)]).toEqual(GOLDEN.mid);
    expect(out[out.length - 1]).toEqual(GOLDEN.last);
    expect(out.reduce((sum, p) => sum + p[0] * 1.5 + p[1], 0)).toBe(GOLDEN.sum);
  });

  it('returns nothing for no points', () => {
    expect(getStroke([])).toEqual([]);
    expect(getStrokePoints([])).toEqual([]);
  });

  it('draws a dot for one finished point', () => {
    expect(getStroke([[10, 10]], { size: 8, last: true }).length).toBeGreaterThan(0);
  });
});
