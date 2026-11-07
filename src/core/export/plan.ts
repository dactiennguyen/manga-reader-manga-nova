import type { PageSize } from '../model/types';

export type ExportFormat = 'png' | 'pdf' | 'cbz' | 'long';

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
  return options.format === 'long' ? 0 : (options.cover ? 1 : 0) + (options.info ? 1 : 0);
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
