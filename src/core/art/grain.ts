import type { BrushGrain } from '../model/types';
import { hash01 } from './tone';

/**
 * Paper and bristle textures for custom brushes. A texture is a square tile of holes cut into solid ink:
 * round pits for pencil and charcoal, short streaks for a dry brush. The tile repeats across the page, so a
 * mark that crosses an edge is listed again on the far side. Positions come from hash01, so every phone
 * draws the same texture.
 */

export type TextureGrain = Exclude<BrushGrain, 'none' | 'spatter'>;

export type GrainTile = {
  /** Side of the tile in page units. */
  tile: number;
  /** The tile is turned by this many degrees, so its repeat does not line up with the page. */
  angle: number;
  /** Pits as x, y, r, alpha. Alpha is how much ink the pit takes away. */
  pits: number[];
  /** Streaks as x0, y0, x1, y1, width, alpha. */
  streaks: number[];
};

type Recipe = {
  tile: number;
  angle: number;
  pits: number;
  pitR: [number, number];
  pitAlpha: [number, number];
  streaks: number;
  streakLength: [number, number];
  streakWidth: [number, number];
  streakTurn: number;
  seed: number;
};

const RECIPES: Record<TextureGrain, Recipe> = {
  pencil: {
    tile: 32,
    angle: 23,
    pits: 700,
    pitR: [0.22, 0.55],
    pitAlpha: [0.35, 1],
    streaks: 0,
    streakLength: [0, 0],
    streakWidth: [0, 0],
    streakTurn: 0,
    seed: 11,
  },
  charcoal: {
    tile: 48,
    angle: 17,
    pits: 480,
    pitR: [0.4, 1.4],
    pitAlpha: [0.4, 1],
    streaks: 40,
    streakLength: [3, 8],
    streakWidth: [0.4, 0.9],
    streakTurn: 0.3,
    seed: 23,
  },
  dry: {
    tile: 64,
    angle: 31,
    pits: 60,
    pitR: [0.3, 0.9],
    pitAlpha: [0.6, 1],
    streaks: 170,
    streakLength: [5, 22],
    streakWidth: [0.5, 1.6],
    streakTurn: 0.25,
    seed: 37,
  },
};

const lerp = (range: [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Adds a mark at every copy of the tile it touches. */
function wrapped(tile: number, minX: number, minY: number, maxX: number, maxY: number, emit: (ox: number, oy: number) => void) {
  for (let ox = -tile; ox <= tile; ox += tile) {
    for (let oy = -tile; oy <= tile; oy += tile) {
      if (maxX + ox >= 0 && minX + ox <= tile && maxY + oy >= 0 && minY + oy <= tile) {
        emit(ox, oy);
      }
    }
  }
}

export function grainTile(grain: TextureGrain): GrainTile {
  const recipe = RECIPES[grain];
  const { tile, seed } = recipe;
  const pits: number[] = [];
  for (let i = 0; i < recipe.pits; i++) {
    const x = hash01(seed, i * 4) * tile;
    const y = hash01(seed, i * 4 + 1) * tile;
    const r = r2(lerp(recipe.pitR, hash01(seed, i * 4 + 2)));
    const alpha = r2(lerp(recipe.pitAlpha, hash01(seed, i * 4 + 3)));
    wrapped(tile, x - r, y - r, x + r, y + r, (ox, oy) => pits.push(r2(x + ox), r2(y + oy), r, alpha));
  }
  const streaks: number[] = [];
  for (let i = 0; i < recipe.streaks; i++) {
    const k = 100000 + i * 6;
    const x = hash01(seed, k) * tile;
    const y = hash01(seed, k + 1) * tile;
    const length = lerp(recipe.streakLength, hash01(seed, k + 2));
    const turn = (hash01(seed, k + 3) - 0.5) * 2 * recipe.streakTurn;
    const width = r2(lerp(recipe.streakWidth, hash01(seed, k + 4)));
    const alpha = r2(lerp([0.7, 1], hash01(seed, k + 5)));
    const x1 = x + Math.cos(turn) * length;
    const y1 = y + Math.sin(turn) * length;
    wrapped(tile, Math.min(x, x1) - width, Math.min(y, y1) - width, Math.max(x, x1) + width, Math.max(y, y1) + width, (ox, oy) =>
      streaks.push(r2(x + ox), r2(y + oy), r2(x1 + ox), r2(y1 + oy), width, alpha),
    );
  }
  return { tile, angle: recipe.angle, pits, streaks };
}

export function isTextureGrain(grain: BrushGrain): grain is TextureGrain {
  'worklet';
  return grain === 'pencil' || grain === 'dry' || grain === 'charcoal';
}
