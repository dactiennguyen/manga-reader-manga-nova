import { BlendMode, FilterMode, PaintStyle, Skia, StrokeCap, TileMode, type SkShader } from '@shopify/react-native-skia';

import { TONE_PITCH, toneRadius } from '../core/art/artMath';
import { strokeBrush } from '../core/art/brushes';
import { grainTile, isTextureGrain, type TextureGrain } from '../core/art/grain';
import { NOISE_TILE, dotRadius, noiseGrains, resolveTone, toneKey, type ResolvedTone } from '../core/art/tone';
import type { Stroke, StrokeTone } from '../core/model/types';

/**
 * The shaders that give a stroke its tone and texture. Repeating patterns are small recorded tiles, which
 * Skia rasterises once per zoom level. Only the gradient tone, whose dots change size across the fill,
 * is computed per pixel by a runtime shader. Tiles and shaders are built on the JS thread and cached;
 * the canvas hands the current one to the UI thread, so starting a stroke records nothing.
 */

/** Softness of a gradient dot's edge, in page units: about a pixel at export size. */
const GRADIENT_SOFT = 0.4;
const CACHE_MAX = 64;

const GRADIENT_SKSL = `
uniform float4 ink;
uniform float4 span;
uniform float2 dens;
uniform float pitch;
uniform float2 turn;
uniform float soft;

half4 main(float2 p) {
  float2 d = span.zw - span.xy;
  float t = clamp(dot(p - span.xy, d) / max(dot(d, d), 0.000001), 0.0, 1.0);
  float density = clamp(mix(dens.x, dens.y, t), 0.0, 0.75);
  float2 q = float2(p.x * turn.x + p.y * turn.y, p.y * turn.x - p.x * turn.y) / pitch;
  float2 f = fract(q) - 0.5;
  float r = sqrt(max(density, 0.0001) / 3.14159265) * pitch;
  float cover = clamp((r - length(f) * pitch) / soft + 0.5, 0.0, 1.0) * step(0.005, density);
  return half4(half3(ink.rgb * cover), half(cover));
}
`;

/**
 * Compiled once, at load, so the UI thread can use it too. Null if it cannot compile, or where Skia is
 * mocked away in tests; gradients then draw as flat dots.
 */
const GRADIENT_EFFECT = Skia?.RuntimeEffect ? Skia.RuntimeEffect.Make(GRADIENT_SKSL) : null;

/** The original tone: one dot per TONE_PITCH cell, turned 45 degrees. Old strokes must keep this exact shader. */
export function makeToneShader(color: string, density: number): SkShader {
  'worklet';
  const rect = Skia.XYWHRect(0, 0, TONE_PITCH, TONE_PITCH);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(rect);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  canvas.drawCircle(TONE_PITCH / 2, TONE_PITCH / 2, toneRadius(density), paint);
  const matrix = Skia.Matrix();
  matrix.rotate(Math.PI / 4);
  return recorder
    .finishRecordingAsPicture()
    .makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, matrix, rect);
}

function cellShader(color: string, tone: ResolvedTone): SkShader {
  const pitch = tone.pitch;
  const rect = Skia.XYWHRect(0, 0, pitch, pitch);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(rect);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (tone.kind === 'lines' || tone.kind === 'cross') {
    const w = tone.weight;
    canvas.drawRect(Skia.XYWHRect(0, (pitch - w) / 2, pitch, w), paint);
    if (tone.kind === 'cross') {
      canvas.drawRect(Skia.XYWHRect((pitch - w) / 2, 0, w, pitch), paint);
    }
  } else {
    canvas.drawCircle(pitch / 2, pitch / 2, dotRadius(tone.density, pitch), paint);
  }
  const matrix = Skia.Matrix();
  matrix.rotate((tone.angle * Math.PI) / 180);
  return recorder
    .finishRecordingAsPicture()
    .makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, matrix, rect);
}

function noiseShader(color: string, tone: ResolvedTone): SkShader {
  const rect = Skia.XYWHRect(0, 0, NOISE_TILE, NOISE_TILE);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(rect);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  const grains = noiseGrains(tone.density, tone.pitch);
  for (let i = 0; i + 2 < grains.length; i += 3) {
    canvas.drawCircle(grains[i], grains[i + 1], grains[i + 2], paint);
  }
  return recorder.finishRecordingAsPicture().makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, Skia.Matrix(), rect);
}

/** A gradient tone. Runs on either thread: a lasso fill moves its gradient while it is drawn. */
export function gradientToneShader(color: string, tone: ResolvedTone): SkShader {
  'worklet';
  const span = tone.span ?? [0, 0, 0, 0];
  const density = tone.span ? tone.density : (tone.density + tone.density2) / 2;
  const density2 = tone.span ? tone.density2 : density;
  if (!GRADIENT_EFFECT) {
    return makeToneShader(color, (density + density2) / 2);
  }
  const ink = Skia.Color(color);
  const rad = (tone.angle * Math.PI) / 180;
  return GRADIENT_EFFECT.makeShader([
    ink[0],
    ink[1],
    ink[2],
    1,
    span[0],
    span[1],
    span[2],
    span[3],
    density,
    density2,
    tone.pitch,
    Math.cos(rad),
    Math.sin(rad),
    GRADIENT_SOFT,
  ]);
}

/** The shader for any tone, legacy included. */
export function makeToneShaderFor(color: string, tone: StrokeTone): SkShader {
  const resolved = resolveTone(tone);
  if (resolved.legacy) {
    return makeToneShader(color, resolved.density);
  }
  switch (resolved.kind) {
    case 'gradient':
      return gradientToneShader(color, resolved);
    case 'noise':
      return noiseShader(color, resolved);
    default:
      return cellShader(color, resolved);
  }
}

const grainCache = new Map<TextureGrain, SkShader>();

/**
 * A texture's holes as an alpha mask: transparent paper with the tile's pits and streaks in black. The
 * stroke keeps its ink where the mask is clear. Holes rather than ink, so the tile has no solid edge that
 * could show a seam where it repeats.
 */
export function grainHolesShader(grain: TextureGrain): SkShader {
  const cached = grainCache.get(grain);
  if (cached) {
    return cached;
  }
  const tile = grainTile(grain);
  const rect = Skia.XYWHRect(0, 0, tile.tile, tile.tile);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(rect);
  const hole = Skia.Paint();
  hole.setAntiAlias(true);
  hole.setColor(Skia.Color('#000000'));
  for (let i = 0; i + 3 < tile.pits.length; i += 4) {
    hole.setAlphaf(tile.pits[i + 3]);
    canvas.drawCircle(tile.pits[i], tile.pits[i + 1], tile.pits[i + 2], hole);
  }
  hole.setStyle(PaintStyle.Stroke);
  hole.setStrokeCap(StrokeCap.Round);
  for (let i = 0; i + 5 < tile.streaks.length; i += 6) {
    hole.setStrokeWidth(tile.streaks[i + 4]);
    hole.setAlphaf(tile.streaks[i + 5]);
    canvas.drawLine(tile.streaks[i], tile.streaks[i + 1], tile.streaks[i + 2], tile.streaks[i + 3], hole);
  }
  const matrix = Skia.Matrix();
  matrix.rotate((tile.angle * Math.PI) / 180);
  const shader = recorder
    .finishRecordingAsPicture()
    .makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, matrix, rect);
  grainCache.set(grain, shader);
  return shader;
}

const toneCache = new Map<string, SkShader>();
const styleCache = new Map<string, SkShader | null>();

function remember<T>(cache: Map<string, T>, key: string, make: () => T): T {
  if (cache.has(key)) {
    return cache.get(key) as T;
  }
  const value = make();
  if (cache.size >= CACHE_MAX) {
    cache.clear();
  }
  cache.set(key, value);
  return value;
}

/** Cached tone shader. Old tones use the same key and shader they always had. */
export function toneShader(color: string, tone: StrokeTone): SkShader {
  return remember(toneCache, `${color}|${toneKey(tone)}`, () => makeToneShaderFor(color, tone));
}

/** Tone and texture together, or null for plain ink. JS thread only: it fills caches. */
export function strokeShader(stroke: Pick<Stroke, 'tool' | 'color' | 'tone' | 'brush'>): SkShader | null {
  const tone = stroke.tool !== 'eraser' && stroke.tone ? stroke.tone : null;
  const custom = strokeBrush(stroke);
  const grain = custom && isTextureGrain(custom.grain) ? custom.grain : null;
  if (!tone && !grain) {
    return null;
  }
  if (!grain && tone) {
    return toneShader(stroke.color, tone);
  }
  const key = `${stroke.color}|${tone ? toneKey(tone) : ''}|${grain}`;
  return remember(styleCache, key, () => {
    const holes = grainHolesShader(grain as TextureGrain);
    // MakeBlend takes the destination first. Tone or colour keeps what the holes leave.
    return tone
      ? Skia.Shader.MakeBlend(BlendMode.DstOut, toneShader(stroke.color, tone), holes)
      : Skia.Shader.MakeBlend(BlendMode.SrcOut, holes, Skia.Shader.MakeColor(Skia.Color(stroke.color)));
  });
}
