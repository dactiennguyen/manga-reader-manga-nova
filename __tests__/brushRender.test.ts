import { DEFAULT_BRUSH, resolveBrush } from '../src/core/art/brushes';
import { DAB_STRIDE, walkStroke } from '../src/core/art/dabs';
import type { Stroke, StrokeBrush } from '../src/core/model/types';
import { drawStroke, recordPicture, strokePaint } from '../src/render/drawArt';
import { beginLiveStroke, pendingFrom, recordLiveStroke, recordPending } from '../src/render/liveStroke';
import { strokeShader, toneShader } from '../src/render/strokeStyle';
import type { FakePicture } from './helpers/fakeSkia';

jest.mock('@shopify/react-native-skia', () => require('./helpers/fakeSkia'));

type Draw = { path?: unknown; paint?: Record<string, unknown>; circle?: number[]; alpha?: number; picture?: FakePicture };

const wave = (count: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round((50 + i * 3) * 10) / 10, Math.round((80 + Math.sin(i / 6) * 25) * 10) / 10, Math.round((0.3 + 0.6 * Math.abs(Math.sin(i / 10))) * 100) / 100);
  }
  return out;
};

const stroke = (patch: Partial<Stroke> = {}): Stroke => ({
  tool: 'brush',
  color: '#16161A',
  size: 12,
  opacity: 0.9,
  points: wave(90),
  pressure: true,
  ...patch,
});

const brush = (patch: Partial<StrokeBrush> = {}): StrokeBrush => ({ ...DEFAULT_BRUSH, ...patch });

/** Every circle drawn, following nested pictures. */
function circles(picture: FakePicture): { circle: number[]; alpha: number }[] {
  const out: { circle: number[]; alpha: number }[] = [];
  for (const draw of picture.draws as Draw[]) {
    if (draw.circle) {
      out.push({ circle: draw.circle, alpha: draw.alpha ?? 1 });
    } else if (draw.picture) {
      out.push(...circles(draw.picture));
    }
  }
  return out;
}

function paths(picture: FakePicture): Draw[] {
  return (picture.draws as Draw[]).flatMap(draw => (draw.path ? [draw] : draw.picture ? paths(draw.picture) : []));
}

describe('old strokes draw as before', () => {
  it('a plain stroke is one path, no texture, no blur, no dabs', () => {
    const picture = recordPicture(canvas => drawStroke(canvas, stroke())) as unknown as FakePicture;
    expect(paths(picture)).toHaveLength(1);
    expect(circles(picture)).toHaveLength(0);
    const paint = strokePaint(stroke()) as unknown as Record<string, unknown>;
    expect(paint.shader).toBeUndefined();
    expect(paint.maskFilter).toBeUndefined();
  });

  it('an old tone uses the original picture shader: one dot in a 6 unit cell', () => {
    const shader = strokeShader(stroke({ tone: { density: 0.25 } })) as unknown as { shader: string; picture: FakePicture; args: unknown[] };
    expect(shader.shader).toBe('picture');
    expect(shader.args[4]).toEqual({ x: 0, y: 0, width: 6, height: 6 });
    expect(circles(shader.picture)).toHaveLength(1);
    expect(circles(shader.picture)[0].circle[2]).toBeCloseTo(6 * Math.sqrt(0.25 / Math.PI));
    // Cached: the same tone gets the same shader, as before.
    expect(toneShader('#16161A', { density: 0.25 })).toBe(shader);
  });

  it('the eraser never takes tone or texture', () => {
    expect(strokeShader(stroke({ tool: 'eraser', tone: { density: 0.4 }, brush: brush({ grain: 'pencil' }) }))).toBeNull();
  });
});

describe('new tones', () => {
  it('a gradient is a runtime shader fed its span, densities and screen', () => {
    const tone = { density: 0.05, kind: 'gradient' as const, density2: 0.6, pitch: 8, angle: 90, span: [0, 0, 0, 100] as [number, number, number, number] };
    const shader = strokeShader(stroke({ tool: 'fill', tone })) as unknown as { shader: string; uniforms: number[] };
    expect(shader.shader).toBe('runtime');
    expect(shader.uniforms).toHaveLength(14);
    expect(shader.uniforms.slice(4, 13)).toEqual([0, 0, 0, 100, 0.05, 0.6, 8, expect.closeTo(0, 6), 1]);
  });

  it('lines record a band across their cell, sand a tile of grains', () => {
    const lines = strokeShader(stroke({ tone: { density: 0.25, kind: 'lines', pitch: 8, angle: 30, weight: 2 } })) as unknown as {
      args: unknown[];
    };
    expect(lines.args[4]).toEqual({ x: 0, y: 0, width: 8, height: 8 });
    const sand = strokeShader(stroke({ tone: { density: 0.2, kind: 'noise', pitch: 1 } })) as unknown as { picture: FakePicture };
    expect(circles(sand.picture).length).toBeGreaterThan(100);
  });
});

describe('custom brushes', () => {
  it('a soft brush blurs its edge with the zoom', () => {
    const paint = strokePaint(stroke({ brush: brush({ hardness: 0.5 }) })) as unknown as { maskFilter: { blur: number; respectCTM: boolean } };
    expect(paint.maskFilter.blur).toBeCloseTo(1.8);
    expect(paint.maskFilter.respectCTM).toBe(true);
  });

  it('a texture cuts holes in the ink, and in the tone when there is one', () => {
    const plain = strokeShader(stroke({ brush: brush({ grain: 'charcoal' }) })) as unknown as { shader: string; mode: number };
    expect(plain).toMatchObject({ shader: 'blend', mode: 7 });
    const toned = strokeShader(stroke({ tone: { density: 0.4 }, brush: brush({ grain: 'charcoal' }) })) as unknown as {
      mode: number;
      one: { shader: string };
    };
    expect(toned.mode).toBe(8);
    expect(toned.one.shader).toBe('picture');
  });

  it('a brush that fades with pressure draws its dabs at their own alpha', () => {
    const s = stroke({ brush: brush({ pressureOpacity: 1 }) });
    const picture = recordPicture(canvas => drawStroke(canvas, s)) as unknown as FakePicture;
    const walk = walkStroke(s, resolveBrush(s.brush!));
    const drawn = circles(picture);
    expect(paths(picture)).toHaveLength(0);
    expect(drawn.length).toBe(walk.dabs.length / DAB_STRIDE);
    expect(drawn[10].alpha).toBe(walk.dabs[10 * DAB_STRIDE + 3]);
  });

  it('spatter adds droplets beside the outline, recorded once per stroke', () => {
    const s = stroke({ brush: brush({ grain: 'spatter' }) });
    const picture = recordPicture(canvas => drawStroke(canvas, s)) as unknown as FakePicture;
    expect(paths(picture)).toHaveLength(1);
    expect(circles(picture).length).toBeGreaterThan(0);
    const again = recordPicture(canvas => drawStroke(canvas, s)) as unknown as FakePicture;
    expect((again.draws[0] as Draw).picture).toBe((picture.draws[0] as Draw).picture);
  });
});

describe('live dab strokes', () => {
  function drawLive(s: Stroke) {
    const growing: Stroke = { ...s, points: [] };
    const live = beginLiveStroke(growing);
    let picture = recordLiveStroke(live, growing) as unknown as FakePicture;
    for (let i = 0; i < s.points.length; i += 3) {
      growing.points.push(s.points[i], s.points[i + 1], s.points[i + 2]);
      picture = recordLiveStroke(live, growing) as unknown as FakePicture;
    }
    return { live, picture };
  }

  it('seal settled dabs and end up drawing what the finished stroke draws', () => {
    const s = stroke({ points: wave(200), brush: brush({ pressureOpacity: 0.8, grain: 'spatter' }) });
    const { live, picture } = drawLive(s);
    expect(live.dabPictures.length).toBeGreaterThan(1);
    const final = circles(recordPicture(canvas => drawStroke(canvas, s)) as unknown as FakePicture);
    const shown = circles(picture);
    expect(shown.length).toBe(final.length);
    const key = (c: { circle: number[] }) => c.circle.map(v => v.toFixed(4)).join(',');
    expect(new Set(shown.map(key))).toEqual(new Set(final.map(key)));
  });

  it('a pending dab stroke redraws through the same walk', () => {
    const s = stroke({ brush: brush({ pressureOpacity: 1 }) });
    const { live } = drawLive(s);
    const pending = pendingFrom(live, s, 1, 'layer');
    expect(pending.path).toBeNull();
    const drawn = circles(recordPending([pending]) as unknown as FakePicture);
    expect(drawn.length).toBe(walkStroke(s, resolveBrush(s.brush!)).dabs.length / DAB_STRIDE);
  });

  it('a brushed pencil is a filled outline while drawing, like its finished stroke', () => {
    const s = stroke({ tool: 'pencil', brush: brush() });
    const { live } = drawLive(s);
    expect(live.kind).toBe('outline');
  });
});
