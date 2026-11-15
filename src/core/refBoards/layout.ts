/** Screen sizes for the board screens, in dp. */
export const BOARD_GRID = {
  wide: 600,
  gap: 12,
  /** A card in the list of boards is never narrower than this on a wide screen. */
  cardMin: 220,
  /** A tile in the masonry grid is never narrower than this. */
  tileMin: 150,
  /** Very tall or very wide pictures are cropped to these ratios (height / width). */
  minRatio: 0.6,
  maxRatio: 1.8,
} as const;

export function sidePadding(width: number): number {
  return width >= BOARD_GRID.wide ? 24 : 16;
}

/** Two cards on a phone, more on a tablet. */
export function boardListGrid(width: number): { columns: number; padding: number; cardWidth: number } {
  const padding = sidePadding(width);
  const inner = Math.max(0, width - padding * 2);
  const columns = width >= BOARD_GRID.wide ? Math.max(3, Math.floor(inner / BOARD_GRID.cardMin)) : 2;
  return { columns, padding, cardWidth: Math.floor((inner - BOARD_GRID.gap * (columns - 1)) / columns) };
}

export function masonryColumnCount(width: number): number {
  const inner = Math.max(0, width - sidePadding(width) * 2);
  return Math.max(2, Math.min(6, Math.floor((inner + BOARD_GRID.gap) / (BOARD_GRID.tileMin + BOARD_GRID.gap))));
}

/** Height over width, kept in a range so one odd picture cannot fill the screen. */
export function tileRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) {
    return 1;
  }
  return Math.min(BOARD_GRID.maxRatio, Math.max(BOARD_GRID.minRatio, height / width));
}

export type MasonryItem = { id: string; width: number; height: number };

export type MasonryTile = { id: string; index: number; height: number };

/**
 * Puts each picture, in order, at the foot of the shortest column. Reading across the top row still
 * follows the board's order, which is what "reorder" changes.
 */
export function masonry(items: readonly MasonryItem[], columns: number, columnWidth: number, gap: number): MasonryTile[][] {
  const count = Math.max(1, Math.floor(columns));
  const out: MasonryTile[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  items.forEach((item, index) => {
    let shortest = 0;
    for (let i = 1; i < count; i++) {
      if (heights[i] < heights[shortest] - 0.5) {
        shortest = i;
      }
    }
    const height = Math.round(columnWidth * tileRatio(item.width, item.height));
    out[shortest].push({ id: item.id, index, height });
    heights[shortest] += height + gap;
  });
  return out;
}

/** The next picture in a set, going round at both ends. */
export function stepIndex(index: number, delta: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return (((index + delta) % length) + length) % length;
}

/** A picture's size to fit inside a frame without cropping. */
export function containSize(width: number, height: number, frameW: number, frameH: number): { w: number; h: number } {
  if (!(width > 0) || !(height > 0)) {
    return { w: frameW, h: frameH };
  }
  const scale = Math.min(frameW / width, frameH / height);
  return { w: width * scale, h: height * scale };
}
