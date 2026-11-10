import { msg } from '../i18n';
import type { BubbleFont } from '../model/types';

/** Scripts a font draws beyond basic Latin. __tests__/letteringFonts.test.ts checks this against the font files. */
export type FontScript = 'vi' | 'ja';

export const DEFAULT_FONT: BubbleFont = 'hand';

/** The name each font is registered under in Skia. */
export const FONT_FAMILY: Record<BubbleFont, string> = {
  hand: 'PatrickHand',
  sans: 'BeVietnamPro',
  sansBold: 'BeVietnamProBold',
  display: 'Anton',
  comic: 'Bangers',
  casual: 'Mali',
  rounded: 'MPLUSRounded1c',
  marker: 'YuseiMagic',
  heavy: 'DelaGothicOne',
};

/** What each font is for. */
export const FONT_LABEL: Record<BubbleFont, string> = {
  hand: msg('Handwritten'),
  sans: msg('Sans'),
  sansBold: msg('Sans bold'),
  display: msg('Display'),
  comic: msg('Comic'),
  casual: msg('Casual'),
  rounded: msg('Rounded'),
  marker: msg('Marker'),
  heavy: msg('Heavy'),
};

/** Family names are proper names: shown as they are in every language. */
export const FONT_NAME: Record<BubbleFont, string> = {
  hand: 'Patrick Hand',
  sans: 'Be Vietnam Pro',
  sansBold: 'Be Vietnam Pro Bold',
  display: 'Anton',
  comic: 'Bangers',
  casual: 'Mali',
  rounded: 'M PLUS Rounded 1c',
  marker: 'Yusei Magic',
  heavy: 'Dela Gothic One',
};

export const FONT_SCRIPTS: Record<BubbleFont, readonly FontScript[]> = {
  hand: ['vi'],
  sans: ['vi'],
  sansBold: ['vi'],
  display: ['vi'],
  comic: ['vi'],
  casual: ['vi'],
  rounded: ['vi', 'ja'],
  marker: ['ja'],
  heavy: ['vi', 'ja'],
};

/**
 * Fonts tried in order for a character the chosen font cannot draw, so Japanese typed in a Latin font
 * comes out in a bundled Japanese face of similar weight and not as empty boxes. Every list ends up
 * covering Vietnamese and Japanese. Past the list, Skia still asks the system fonts.
 */
const FALLBACK: Record<BubbleFont, readonly BubbleFont[]> = {
  // Manga dialogue is typeset, so Japanese typed in a dialogue font goes to the rounded face first.
  hand: ['rounded', 'marker'],
  sans: ['rounded', 'marker'],
  sansBold: ['heavy', 'rounded'],
  display: ['heavy', 'rounded'],
  comic: ['heavy', 'rounded'],
  casual: ['rounded', 'marker'],
  // M PLUS Rounded 1c has every common kanji but only part of the rare ones.
  rounded: ['marker', 'heavy'],
  marker: ['hand', 'rounded'],
  heavy: ['rounded', 'marker'],
};

export const BUBBLE_FONTS = Object.keys(FONT_FAMILY) as BubbleFont[];

/** The picker's order: fonts that have the interface language come first, otherwise as listed. */
export function fontsFor(locale: string): BubbleFont[] {
  const has = (font: BubbleFont) => (FONT_SCRIPTS[font] as readonly string[]).includes(locale);
  return [...BUBBLE_FONTS.filter(has), ...BUBBLE_FONTS.filter(font => !has(font))];
}

export function isBubbleFont(value: unknown): value is BubbleFont {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FONT_FAMILY, value);
}

/** A story file written by another version of the app can name a font this one does not have. */
export function knownFont(value: unknown): BubbleFont {
  return isBubbleFont(value) ? value : DEFAULT_FONT;
}

export function fontChain(font: unknown): BubbleFont[] {
  const first = knownFont(font);
  return [first, ...FALLBACK[first]];
}

const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uff01-\uff9f]/;
// Letters Vietnamese has and Western European languages do not.
const VIETNAMESE = /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/;

export function scriptOf(text: string): FontScript | null {
  return JAPANESE.test(text) ? 'ja' : VIETNAMESE.test(text.normalize('NFC')) ? 'vi' : null;
}

/**
 * The font to give a bubble that starts with this text: the wanted one, or the first of its fallbacks
 * that has the script. The font picker then shows the font the text is really drawn in.
 */
export function fontForText(font: BubbleFont, text: string): BubbleFont {
  const script = scriptOf(text);
  return (script && fontChain(font).find(item => FONT_SCRIPTS[item].includes(script))) || font;
}

/** The family list a Skia paragraph takes: the font itself, then its fallbacks. */
export function fontFamilies(font: unknown): string[] {
  return fontChain(font).map(key => FONT_FAMILY[key]);
}
