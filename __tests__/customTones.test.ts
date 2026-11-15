import { transformStroke } from '../src/core/art/artMath';
import { mirrorStroke } from '../src/core/art/guides';
import { transformStrokeAffine } from '../src/core/art/selection';
import {
  BUILTIN_TONES,
  NOISE_GRAINS_MAX,
  NOISE_TILE,
  TONE_PITCH,
  dotRadius,
  fitToneToBox,
  gradientDensityAt,
  gradientSpan,
  gradientT,
  hash01,
  mapToneSpan,
  noiseGrains,
  normalizeTone,
  pairsBox,
  resolveTone,
  toneFromPreset,
  toneKey,
  type TonePreset,
} from '../src/core/art/tone';
import { toneRadius } from '../src/core/art/artMath';
import type { Stroke } from '../src/core/model/types';

const box = { x: 100, y: 200, w: 400, h: 300 };
const preset = (patch: Partial<TonePreset>): TonePreset => ({
  id: 'p',
  name: 'P',
  kind: 'dots',
  density: 0.3,
  pitch: 6,
  angle: 45,
  weight: 1.2,
  density2: 0.6,
  direction: 90,
  ...patch,
});

describe('old tones', () => {
  it('resolve to the original dots: 6 apart, 45 degrees, flagged legacy', () => {
    expect(resolveTone({ density: 0.25 })).toEqual({
      kind: 'dots',
      legacy: true,
      density: 0.25,
      pitch: TONE_PITCH,
      angle: 45,
      weight: 0,
      density2: 0.25,
      span: null,
    });
  });

  it('keep the same dot radius rule as before', () => {
    for (const density of [0.1, 0.25, 0.4, 0.6]) {
      expect(dotRadius(density, TONE_PITCH)).toBeCloseTo(toneRadius(density), 10);
    }
  });

  it('keep their cache key, so they reuse the shader they always had', () => {
    expect(toneKey({ density: 0.4 })).toBe('L0.4');
  });

  it('read back as density only', () => {
    expect(normalizeTone({ density: 0.6 })).toEqual({ density: 0.6 });
    expect(normalizeTone({ density: 0.6, extra: true })).toEqual({ density: 0.6 });
  });
});

describe('stored tones', () => {
  it('drop what is not a tone', () => {
    expect(normalizeTone(null)).toBeUndefined();
    expect(normalizeTone('dots')).toBeUndefined();
    expect(normalizeTone({ kind: 'dots' })).toBeUndefined();
    expect(normalizeTone({ density: Number.NaN })).toBeUndefined();
  });

  it('clamp numbers a file could get wrong', () => {
    const tone = normalizeTone({ density: 4, kind: 'dots', pitch: 0, angle: -30 });
    expect(tone).toEqual({ density: 0.75, kind: 'dots', pitch: 3, angle: 150 });
    const lines = normalizeTone({ density: 0.2, kind: 'lines', pitch: 4, weight: 50 });
    expect(lines?.weight).toBeCloseTo(3.6);
    const sand = normalizeTone({ density: 0.2, kind: 'noise', pitch: 99 });
    expect(sand?.pitch).toBe(3);
  });

  it('keep a gradient span only when it is four finite numbers', () => {
    expect(normalizeTone({ density: 0.1, kind: 'gradient', span: [0, 0, 1, 1], density2: 0.5 })?.span).toEqual([0, 0, 1, 1]);
    expect(normalizeTone({ density: 0.1, kind: 'gradient', span: [0, 0, 'x', 1] })?.span).toBeUndefined();
    expect(resolveTone({ density: 0.1, kind: 'gradient', span: [0, 0, Infinity, 1] as never }).span).toBeNull();
  });

  it('resolve idempotently, so a stroke read back from disk draws the same', () => {
    for (const p of BUILTIN_TONES) {
      const tone = toneFromPreset(p, box);
      expect(resolveTone(normalizeTone(tone)!)).toEqual(resolveTone(tone));
    }
  });
});

describe('presets to stroke tones', () => {
  it('dots keep density, spacing and angle', () => {
    expect(toneFromPreset(preset({ pitch: 4, angle: 30 }), box)).toEqual({ density: 0.3, kind: 'dots', pitch: 4, angle: 30 });
  });

  it('lines and cross-hatch store their coverage as density for older readers', () => {
    const lines = toneFromPreset(preset({ kind: 'lines', pitch: 6, weight: 1.5 }), box);
    expect(lines).toMatchObject({ kind: 'lines', weight: 1.5, density: 0.25 });
    const cross = toneFromPreset(preset({ kind: 'cross', pitch: 6, weight: 1.5 }), box);
    expect(cross.density).toBeCloseTo(0.25 * 1.75, 2);
  });

  it('a gradient runs across the box', () => {
    const tone = toneFromPreset(preset({ kind: 'gradient', density: 0.05, density2: 0.6, direction: 90 }), box);
    expect(tone.span).toEqual([300, 200, 300, 500]);
    const r = resolveTone(tone);
    expect(gradientDensityAt(r, 300, 200)).toBeCloseTo(0.05);
    expect(gradientDensityAt(r, 300, 500)).toBeCloseTo(0.6);
    expect(gradientDensityAt(r, 300, 350)).toBeCloseTo(0.325);
    expect(gradientDensityAt(r, 300, 900)).toBeCloseTo(0.6);
  });
});

describe('gradient geometry', () => {
  it('spans the box along any direction', () => {
    expect(gradientSpan(0, box)).toEqual([100, 350, 500, 350]);
    expect(gradientSpan(180, box)).toEqual([500, 350, 100, 350]);
    const diagonal = gradientSpan(45, { x: 0, y: 0, w: 100, h: 100 });
    // The projection of the box on the diagonal: the corners land at t = 0 and t = 1.
    expect(gradientT(diagonal, 0, 0)).toBeCloseTo(0, 2);
    expect(gradientT(diagonal, 100, 100)).toBeCloseTo(1, 2);
    expect(gradientT(diagonal, 100, 0)).toBeCloseTo(0.5, 2);
  });

  it('clamps outside the span and survives a zero-length span', () => {
    expect(gradientT([0, 0, 10, 0], -5, 0)).toBe(0);
    expect(gradientT([0, 0, 10, 0], 50, 3)).toBe(1);
    expect(gradientT([5, 5, 5, 5], 1, 1)).toBe(0);
  });

  it('moves with transforms and mirrors, while other tones stay on the page', () => {
    const stroke: Stroke = {
      tool: 'fill',
      color: '#000',
      size: 1,
      opacity: 1,
      points: [0, 0, 10, 0, 10, 10],
      tone: { density: 0.1, kind: 'gradient', density2: 0.5, pitch: 6, angle: 45, span: [0, 0, 10, 0] },
    };
    expect(transformStroke(stroke, { s: 2, tx: 5, ty: 1 }).tone?.span).toEqual([5, 1, 25, 1]);
    expect(transformStrokeAffine(stroke, { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 4 }).tone?.span).toEqual([3, 4, 13, 4]);
    expect(mirrorStroke(stroke, 50).tone?.span).toEqual([100, 0, 90, 0]);
    const dots: Stroke = { ...stroke, tone: { density: 0.25 } };
    expect(transformStroke(dots, { s: 2, tx: 5, ty: 1 }).tone).toEqual({ density: 0.25 });
    expect(mapToneSpan({ density: 0.25 }, () => ({ x: 1, y: 1 }))).toEqual({ density: 0.25 });
  });

  it('fits a gradient fill to the area it covers, keeping its direction', () => {
    const tone = { density: 0.1, kind: 'gradient' as const, density2: 0.5, span: [0, 0, 0, 10] as [number, number, number, number] };
    const fitted = fitToneToBox(tone, pairsBox([10, 10, 50, 10, 50, 90, 10, 90]));
    expect(fitted.span).toEqual([30, 10, 30, 90]);
    expect(fitToneToBox({ density: 0.25 }, box)).toEqual({ density: 0.25 });
  });
});

describe('sand', () => {
  it('is the same on every call and every phone', () => {
    expect(noiseGrains(0.3, 1)).toEqual(noiseGrains(0.3, 1));
    expect(hash01(7, 3)).toBe(hash01(7, 3));
    expect(hash01(-7, 3)).toBeGreaterThanOrEqual(0);
  });

  it('hashes are spread out and not a straight line of their inputs', () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 2000; i++) {
      xs.push(hash01(7, i * 3));
      ys.push(hash01(7, i * 3 + 1));
    }
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const mx = mean(xs);
    const my = mean(ys);
    expect(mx).toBeGreaterThan(0.45);
    expect(mx).toBeLessThan(0.55);
    const cov = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / xs.length;
    const sd = (v: number[], m: number) => Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
    expect(Math.abs(cov / (sd(xs, mx) * sd(ys, my)))).toBeLessThan(0.08);
  });

  it('covers about the asked share of its tile', () => {
    const grains = noiseGrains(0.3, 1.2);
    const size = 120;
    let inked = 0;
    for (let gy = 0; gy < size; gy++) {
      for (let gx = 0; gx < size; gx++) {
        const x = ((gx + 0.5) / size) * NOISE_TILE;
        const y = ((gy + 0.5) / size) * NOISE_TILE;
        for (let i = 0; i < grains.length; i += 3) {
          if ((grains[i] - x) ** 2 + (grains[i + 1] - y) ** 2 <= grains[i + 2] ** 2) {
            inked++;
            break;
          }
        }
      }
    }
    expect(inked / (size * size)).toBeGreaterThan(0.24);
    expect(inked / (size * size)).toBeLessThan(0.36);
  });

  it('repeats without a seam: a grain over an edge is listed on the far side too', () => {
    const grains = noiseGrains(0.2, 2);
    for (let i = 0; i < grains.length; i += 3) {
      const [x, y, r] = [grains[i], grains[i + 1], grains[i + 2]];
      if (x - r < 0) {
        const twin = grains.some((v, j) => j % 3 === 0 && Math.abs(v - (x + NOISE_TILE)) < 0.02 && Math.abs(grains[j + 1] - y) < 0.02);
        expect(twin).toBe(true);
      }
    }
  });

  it('caps the grains a file can ask for', () => {
    expect(noiseGrains(0.75, 0.1).length / 3).toBeLessThanOrEqual(NOISE_GRAINS_MAX * 9);
  });
});
