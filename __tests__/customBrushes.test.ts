import {
  BUILTIN_BRUSHES,
  DEFAULT_BRUSH,
  brushStreamline,
  brushThinning,
  dabAlpha,
  edgeSoftness,
  normalizeBrush,
  normalizeBrushPreset,
  pressureAlpha,
  resolveBrush,
  strokeBrush,
  usesDabs,
  type BrushPreset,
} from '../src/core/art/brushes';
import {
  DABS_MAX,
  DAB_OVERLAP,
  DAB_STRIDE,
  createDabWalker,
  dabRadius,
  dabSpecOf,
  feedDabs,
  settledDabs,
  walkStroke,
} from '../src/core/art/dabs';
import { grainTile } from '../src/core/art/grain';
import {
  EMPTY_PRESETS,
  activeBrush,
  chooseBrush,
  cleanStroke,
  duplicateBrush,
  duplicateTone,
  findBrush,
  legacyToneId,
  moveBrush,
  moveTone,
  parsePresets,
  removeBrush,
  removeTone,
  renameBrush,
  sampleFill,
  sampleStroke,
  saveBrush,
  saveTone,
  serializePresets,
  toneForChoice,
  uniqueName,
  type ArtPresets,
} from '../src/core/art/presets';
import { freehandOptions, renderKind } from '../src/core/art/strokes';
import { BUILTIN_TONES } from '../src/core/art/tone';
import type { Stroke, StrokeBrush } from '../src/core/model/types';

const brush = (patch: Partial<StrokeBrush> = {}): StrokeBrush => ({ ...DEFAULT_BRUSH, ...patch });

const line = (count: number, pressure: boolean): number[] => {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round((100 + i * 2.3 + Math.sin(i / 5) * 9) * 10) / 10, Math.round((100 + Math.cos(i / 7) * 30) * 10) / 10);
    if (pressure) {
      out.push(Math.round((0.2 + 0.7 * Math.abs(Math.sin(i / 9))) * 100) / 100);
    }
  }
  return out;
};

describe('pressure curves', () => {
  it('full pressure gives the brush its own opacity; none fades by the amount set', () => {
    expect(pressureAlpha(1, 1, 0.8)).toBeCloseTo(0.8);
    expect(pressureAlpha(0, 1, 0.8)).toBe(0);
    expect(pressureAlpha(0, 0.5, 1)).toBeCloseTo(0.5);
    expect(pressureAlpha(0.3, 0, 0.6)).toBeCloseTo(0.6);
    expect(pressureAlpha(2, 1, 1)).toBe(1);
  });

  it('dabs that overlap reach the target opacity', () => {
    for (const target of [0.1, 0.5, 0.9]) {
      const a = dabAlpha(target, DAB_OVERLAP);
      expect(1 - (1 - a) ** DAB_OVERLAP).toBeCloseTo(target, 6);
    }
    expect(dabAlpha(0, 5)).toBe(0);
  });

  it('maps smoothing and pressure to perfect-freehand settings', () => {
    expect(brushStreamline(0)).toBeCloseTo(0.2);
    expect(brushStreamline(1)).toBeCloseTo(0.95);
    expect(brushThinning(1)).toBeCloseTo(0.95);
    expect(brushThinning(0)).toBe(0);
  });

  it('only a soft brush blurs its edge', () => {
    expect(edgeSoftness(brush({ hardness: 1 }), 10)).toBe(0);
    expect(edgeSoftness(brush({ hardness: 0.5 }), 10)).toBeCloseTo(1.5);
  });
});

describe('stored brushes', () => {
  it('clamp what a file gets wrong and drop what is not a brush', () => {
    expect(normalizeBrush(null)).toBeUndefined();
    expect(normalizeBrush([1, 2])).toBeUndefined();
    expect(
      normalizeBrush({ pressureSize: 4, pressureOpacity: -1, hardness: 'x', taperStart: 99, taperEnd: 1, smoothing: 0.5, grain: 'glitter' }),
    ).toEqual({ pressureSize: 1, pressureOpacity: 0, hardness: 1, taperStart: 8, taperEnd: 1, smoothing: 0.5, grain: 'none' });
  });

  it('apply only to the tools that take them', () => {
    const s = (tool: Stroke['tool']) => ({ tool, brush: brush() });
    expect(strokeBrush(s('gpen'))).not.toBeNull();
    expect(strokeBrush(s('pencil'))).not.toBeNull();
    expect(strokeBrush(s('brush'))).not.toBeNull();
    expect(strokeBrush(s('eraser'))).toBeNull();
    expect(strokeBrush(s('fill'))).toBeNull();
    expect(strokeBrush(s('rect'))).toBeNull();
    expect(strokeBrush({ tool: 'gpen' })).toBeNull();
  });

  it('decide how a stroke is drawn', () => {
    expect(renderKind({ tool: 'pencil' })).toBe('center');
    expect(renderKind({ tool: 'gpen' })).toBe('outline');
    expect(renderKind({ tool: 'pencil', brush: brush() })).toBe('outline');
    expect(renderKind({ tool: 'brush', brush: brush({ pressureOpacity: 0.5 }) })).toBe('dabs');
    expect(renderKind({ tool: 'eraser', brush: brush({ pressureOpacity: 0.5 }) })).toBe('center');
    expect(renderKind({ tool: 'fill' })).toBe('fill');
    expect(renderKind({ tool: 'line', brush: brush() })).toBe('shape');
    expect(usesDabs(resolveBrush(brush({ pressureOpacity: 0 })))).toBe(false);
  });
});

describe('freehand settings', () => {
  it('stay exactly as before for strokes without a brush', () => {
    const pen = freehandOptions({ tool: 'gpen', size: 10 });
    expect(pen).toMatchObject({ size: 10, thinning: 0.64, smoothing: 0.52, streamline: 0.5, simulatePressure: true });
    expect(pen.start).toEqual({ taper: 12, cap: true });
    expect(pen.end).toEqual({ taper: 24, cap: true });
    const ink = freehandOptions({ tool: 'brush', size: 10, pressure: true });
    expect(ink).toMatchObject({ thinning: 0.86, smoothing: 0.6, streamline: 0.4, simulatePressure: false });
    expect(ink.start).toEqual({ taper: 25, cap: true });
    expect(ink.end).toEqual({ taper: 45, cap: true });
  });

  it('follow a custom brush', () => {
    const options = freehandOptions({ tool: 'pencil', size: 8, brush: brush({ pressureSize: 0.5, taperStart: 2, taperEnd: 0, smoothing: 1 }) });
    expect(options).toMatchObject({ size: 8, thinning: 0.475, streamline: 0.95 });
    expect(options.start).toEqual({ taper: 16, cap: true });
    expect(options.end).toEqual({ taper: 0, cap: true });
    expect(options.easing?.(0.3)).toBeCloseTo(0.3);
  });
});

describe('dabs', () => {
  const stroke = (patch: Partial<Stroke> = {}): Stroke => ({
    tool: 'brush',
    color: '#000',
    size: 10,
    opacity: 0.8,
    points: line(120, true),
    pressure: true,
    brush: brush({ pressureOpacity: 1, taperEnd: 2, grain: 'spatter' }),
    ...patch,
  });

  it('grow one point at a time into exactly the finished walk', () => {
    const s = stroke();
    const b = resolveBrush(s.brush!);
    const live = createDabWalker(dabSpecOf(s, b));
    const growing: number[] = [];
    let settledBefore = { dabs: 0, drops: 0 };
    let frozen: number[] = [];
    for (let i = 0; i < s.points.length; i += 3) {
      growing.push(s.points[i], s.points[i + 1], s.points[i + 2]);
      feedDabs(live, growing, 3);
      const settled = settledDabs(live);
      expect(settled.dabs).toBeGreaterThanOrEqual(settledBefore.dabs);
      // Settled dabs never change again, end taper included.
      for (let k = 0; k < settledBefore.dabs; k++) {
        const at = k * DAB_STRIDE;
        expect(live.dabs.slice(at, at + DAB_STRIDE)).toEqual(frozen.slice(at, at + DAB_STRIDE));
        expect(dabRadius(live, live.dabs[at + 2], live.dabs[at + 4])).toBe(live.dabs[at + 2]);
      }
      settledBefore = settled;
      frozen = live.dabs.slice();
    }
    const whole = walkStroke(s, b);
    expect(live.dabs).toEqual(whole.dabs);
    expect(live.drops).toEqual(whole.drops);
    expect(whole.dabs.length).toBeGreaterThan(50 * DAB_STRIDE);
    expect(whole.drops.length).toBeGreaterThan(0);
  });

  it('walk the same after the Float32 blob round trip', () => {
    const s = stroke({ points: line(80, true).map(v => v + 0.0349) });
    const stored = { ...s, points: Array.from(new Float32Array(s.points)) };
    const b = resolveBrush(s.brush!);
    expect(walkStroke(stored, b).dabs).toEqual(walkStroke(s, b).dabs);
    expect(walkStroke(stored, b).drops).toEqual(walkStroke(s, b).drops);
  });

  it('fade with light pressure and keep the brush opacity at full pressure', () => {
    const s = stroke({ points: [0, 0, 1, 50, 0, 1, 100, 0, 1, 150, 0, 1] });
    const w = walkStroke(s, resolveBrush(s.brush!));
    const alphas = w.dabs.filter((_, i) => i % DAB_STRIDE === 3);
    expect(alphas.every(a => Math.abs(a - dabAlpha(0.8, DAB_OVERLAP)) < 1e-9)).toBe(true);
    const light = stroke({ points: [0, 0, 0.2, 50, 0, 0.2, 100, 0, 0.2, 150, 0, 0.2] });
    const lw = walkStroke(light, resolveBrush(light.brush!));
    expect(lw.dabs[3]).toBeLessThan(alphas[0]);
  });

  it('shrink the last dabs with the end taper', () => {
    const s = stroke();
    const w = walkStroke(s, resolveBrush(s.brush!));
    const last = w.dabs.length - DAB_STRIDE;
    expect(dabRadius(w, w.dabs[last + 2], w.dabs[last + 4])).toBeLessThan(w.dabs[last + 2] * 0.2);
  });

  it('stop at a cap, so one stroke cannot stall the canvas', () => {
    const points: number[] = [];
    for (let i = 0; i < 4000; i++) {
      points.push((i % 2) * 900, i * 0.1);
    }
    const s = stroke({ points, pressure: false, size: 1 });
    const w = walkStroke(s, resolveBrush(s.brush!));
    expect(w.count).toBeLessThanOrEqual(DABS_MAX);
  });

  it('a brush without fading or spatter has no walk', () => {
    expect(dabSpecOf(stroke(), resolveBrush(brush())).body).toBe(false);
    expect(dabSpecOf(stroke(), resolveBrush(brush())).spatter).toBe(false);
  });
});

describe('textures', () => {
  it('are fixed patterns that repeat without seams', () => {
    for (const grain of ['pencil', 'dry', 'charcoal'] as const) {
      const tile = grainTile(grain);
      expect(grainTile(grain)).toEqual(tile);
      expect(tile.pits.length + tile.streaks.length).toBeGreaterThan(0);
      for (let i = 0; i < tile.pits.length; i += 4) {
        const [x, y, r] = tile.pits.slice(i, i + 3);
        if (x + r > tile.tile) {
          const twin = tile.pits.some((v, j) => j % 4 === 0 && Math.abs(v - (x - tile.tile)) < 0.02 && Math.abs(tile.pits[j + 1] - y) < 0.02);
          expect(twin).toBe(true);
        }
      }
    }
  });
});

describe('preset library', () => {
  const custom = (id: string, patch: Partial<BrushPreset> = {}): BrushPreset => ({ ...BUILTIN_BRUSHES[0], id, name: id, ...patch });

  it('reads nothing as empty and survives garbage', () => {
    expect(parsePresets(null)).toEqual(EMPTY_PRESETS);
    expect(parsePresets('{oops')).toEqual(EMPTY_PRESETS);
    expect(parsePresets('42')).toEqual(EMPTY_PRESETS);
  });

  it('round-trips through its stored form', () => {
    let p: ArtPresets = EMPTY_PRESETS;
    p = saveBrush(p, custom('a', { base: 'pencil' }));
    p = saveTone(p, { ...BUILTIN_TONES[0], id: 't', name: 'Mine' });
    p = chooseBrush(p, 'pencil', 'a');
    expect(parsePresets(serializePresets(p))).toEqual(p);
  });

  it('drops broken entries, duplicates and choices that point nowhere', () => {
    const json = JSON.stringify({
      brushes: [custom('a'), { id: 'b', base: 'laser' }, custom('a'), null],
      tones: [{ id: 't', kind: 'plaid' }],
      active: { gpen: 'a', pencil: 'a', brush: 'missing', eraser: 'a' },
    });
    const p = parsePresets(json);
    expect(p.brushes.map(b => b.id)).toEqual(['a']);
    expect(p.tones).toEqual([]);
    expect(p.active).toEqual({ gpen: 'a' });
  });

  it('keeps a size range in order', () => {
    const p = normalizeBrushPreset({ ...custom('a'), sizeMin: 30, sizeMax: 10, size: 99 });
    expect(p).toMatchObject({ sizeMin: 30, sizeMax: 30, size: 30 });
  });

  it('duplicates next to the original with a free name', () => {
    let p = saveBrush(EMPTY_PRESETS, custom('a', { name: 'Ink' }));
    p = saveBrush(p, custom('b', { name: 'Other' }));
    p = duplicateBrush(p, findBrush(p, 'a')!, 'c', 'Ink');
    expect(p.brushes.map(b => [b.id, b.name])).toEqual([
      ['a', 'Ink'],
      ['c', 'Ink (2)'],
      ['b', 'Other'],
    ]);
    p = duplicateBrush(p, BUILTIN_BRUSHES[1], 'd', 'Marker');
    expect(p.brushes[3]).toMatchObject({ id: 'd', name: 'Marker', base: BUILTIN_BRUSHES[1].base });
    expect(uniqueName('Ink', ['Ink', 'Ink (2)'])).toBe('Ink (3)');
  });

  it('renames, reorders and deletes, and a deleted brush stops being chosen', () => {
    let p = saveBrush(EMPTY_PRESETS, custom('a'));
    p = saveBrush(p, custom('b'));
    p = renameBrush(p, 'a', '  Fine  ');
    expect(p.brushes[0].name).toBe('Fine');
    expect(renameBrush(p, 'a', '   ')).toBe(p);
    p = moveBrush(p, 'b', -1);
    expect(p.brushes.map(b => b.id)).toEqual(['b', 'a']);
    expect(moveBrush(p, 'b', -1)).toBe(p);
    p = chooseBrush(p, 'gpen', 'a');
    expect(activeBrush(p, 'gpen')?.id).toBe('a');
    p = removeBrush(p, 'a');
    expect(p.active).toEqual({});
    expect(activeBrush(p, 'gpen')).toBeUndefined();
  });

  it('a brush moved to another tool stops being the old tool’s choice', () => {
    let p = chooseBrush(saveBrush(EMPTY_PRESETS, custom('a', { base: 'gpen' })), 'gpen', 'a');
    p = saveBrush(p, { ...p.brushes[0], base: 'brush' });
    expect(p.active).toEqual({});
    expect(chooseBrush(p, 'pencil', 'a').active).toEqual({});
  });

  it('manages tones the same way', () => {
    let p = duplicateTone(EMPTY_PRESETS, BUILTIN_TONES[0], 't1', 'Fine dots');
    p = duplicateTone(p, BUILTIN_TONES[1], 't2', 'Coarse dots');
    p = moveTone(p, 't2', -1);
    expect(p.tones.map(t => t.id)).toEqual(['t2', 't1']);
    p = removeTone(p, 't2');
    expect(p.tones.map(t => t.id)).toEqual(['t1']);
  });

  it('turns a tone choice into what a stroke stores', () => {
    const box = { x: 0, y: 0, w: 100, h: 50 };
    expect(toneForChoice(EMPTY_PRESETS, null, box)).toBeNull();
    expect(toneForChoice(EMPTY_PRESETS, legacyToneId(0.25), box)).toEqual({ density: 0.25 });
    expect(toneForChoice(EMPTY_PRESETS, 'builtin-gradient', box)?.span).toEqual([50, 0, 50, 50]);
    expect(toneForChoice(EMPTY_PRESETS, 'deleted', box)).toBeNull();
  });
});

describe('clean strokes', () => {
  it('leave an old stroke untouched', () => {
    const old: Stroke = { tool: 'brush', color: '#000', size: 4, opacity: 1, points: [1, 2], tone: { density: 0.4 } };
    expect(cleanStroke(old)).toBe(old);
    const plain: Stroke = { tool: 'gpen', color: '#000', size: 4, opacity: 1, points: [1, 2] };
    expect(cleanStroke(plain)).toBe(plain);
  });

  it('drop a broken tone or brush and clamp the rest', () => {
    const bad = { tool: 'gpen', color: '#000', size: 4, opacity: 1, points: [1, 2], tone: 'x', brush: { hardness: 9 } } as unknown as Stroke;
    const clean = cleanStroke(bad);
    expect(clean.tone).toBeUndefined();
    expect(clean.brush?.hardness).toBe(1);
  });
});

describe('previews', () => {
  it('draw a wave with pressure and the preset brush', () => {
    const s = sampleStroke('pencil', { x: 0, y: 0, w: 100, h: 40 }, '#000', 4, 0.9, brush());
    expect(s.points.length % 3).toBe(0);
    expect(s.pressure).toBe(true);
    expect(s.brush).toEqual(brush());
    expect(sampleFill({ x: 0, y: 0, w: 10, h: 10 }, '#000', null).tone).toBeUndefined();
  });
});
