import type { PageSize } from '../model/types';

export type ExportFormat = 'png' | 'pdf' | 'cbz' | 'long' | 'social';

/** The frame each panel is placed in for a social post. */
export type SocialShape = 'square' | 'portrait' | 'story';

export type ExportQuality = 1 | 2;

export type LongWidth = 800 | 1080;

export type ExportOptions = {
  format: ExportFormat;
  quality: ExportQuality;
  spread: boolean;
  cover: boolean;
  info: boolean;
  penName: string;
  longWidth: LongWidth;
  autoCut: boolean;
  gap: number;
  socialShape: SocialShape;
  lang?: string | null;
};

export type ExportProgress = { done: number; total: number };

export const LONG_CUT_HEIGHT = 4000;

export const LONG_MAX_HEIGHT = 16000;

/** The PDF page width follows the story's paper size. */
export const PDF_PAGE_WIDTH_PT: Record<PageSize, number> = { B5: 516, A5: 420 };

export function pageImageWidth(quality: ExportQuality): number {
  return quality === 2 ? 2400 : 1200;
}

export function padNumber(n: number): string {
  return String(n).padStart(3, '0');
}

export function extraPageCount(options: Pick<ExportOptions, 'format' | 'cover' | 'info'>): number {
  return options.format === 'long' || options.format === 'social' ? 0 : (options.cover ? 1 : 0) + (options.info ? 1 : 0);
}

/** The info page exists only in a PDF, and a language the story no longer has falls back to the original. */
export function resolveOptions(form: ExportOptions, languages: readonly string[]): ExportOptions {
  return {
    ...form,
    info: form.format === 'pdf' && form.info,
    lang: form.lang && languages.includes(form.lang) ? form.lang : null,
  };
}

export type LongSegment = { indices: number[]; height: number };

/** Packs pages into strips no taller than `limit`. A page with no height cannot be drawn and is left out. */
export function longSegments(heights: readonly number[], gap: number, limit: number): LongSegment[] {
  const segments: LongSegment[] = [];
  heights.forEach((height, index) => {
    if (!height) {
      return;
    }
    const last = segments[segments.length - 1];
    if (last && last.height + gap + height <= limit) {
      last.indices.push(index);
      last.height += gap + height;
    } else {
      segments.push({ indices: [index], height });
    }
  });
  return segments;
}

type Box = { x: number; y: number; w: number; h: number };

export const SOCIAL_SIZE: Record<SocialShape, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

export const SOCIAL_MARGIN = 48;

/** Sharper than this gains nothing on a phone and costs memory for every page. */
export const SOCIAL_MAX_PAGE_WIDTH = 3600;

/** Where a panel lands in the frame: as large as fits inside the margin, centred. `scale` is frame pixels per page unit. */
export function socialPlacement(panel: Box, frame: { w: number; h: number }, margin = SOCIAL_MARGIN): Box & { scale: number } {
  const scale = Math.min((frame.w - margin * 2) / panel.w, (frame.h - margin * 2) / panel.h);
  const w = panel.w * scale;
  const h = panel.h * scale;
  return { x: (frame.w - w) / 2, y: (frame.h - h) / 2, w, h, scale };
}

/** The width to draw a page at so that its most enlarged panel is still sharp in the frame. */
export function socialPageWidth(panels: readonly Box[], pageWidth: number, frame: { w: number; h: number }): number {
  const scale = Math.max(0, ...panels.map(panel => socialPlacement(panel, frame).scale));
  return Math.max(1, Math.min(SOCIAL_MAX_PAGE_WIDTH, Math.ceil(pageWidth * scale)));
}
