import { msg, type Locale } from '../i18n';
import type { BubbleFont } from '../model/types';
import { hasAccentedLatin, scriptOf, type TextScript } from './textScript';

export { scriptOf } from './textScript';

/**
 * Scripts a font draws beyond basic Latin, named like the interface language that writes in them.
 * __tests__/letteringFonts.test.ts checks this against the font files.
 */
export type FontScript = TextScript;

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
  bubbly: 'Jua',
  playful: 'ZCOOLKuaiLe',
  soft: 'Huninn',
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
  bubbly: msg('Bubbly'),
  playful: msg('Playful'),
  soft: msg('Soft'),
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
  bubbly: 'Jua',
  playful: 'ZCOOL KuaiLe',
  soft: 'Huninn',
};

/**
 * The Japanese faces have most of the Han characters Chinese shares with Japanese, but only about two
 * thirds of everyday Chinese: they are not tagged Chinese, so Chinese text goes to a Chinese face whole.
 */
export const FONT_SCRIPTS: Record<BubbleFont, readonly FontScript[]> = {
  hand: ['vi'],
  sans: ['vi'],
  sansBold: ['vi'],
  display: ['vi'],
  comic: ['vi'],
  casual: ['vi', 'th'],
  rounded: ['vi', 'ja'],
  marker: ['ja'],
  heavy: ['vi', 'ja'],
  bubbly: ['ko'],
  playful: ['zh-Hans'],
  soft: ['vi', 'zh-Hant'],
};

/**
 * The faces with no accented Latin letters (á ñ ç ã ê ¿): a word in Spanish, Portuguese, Indonesian or
 * Vietnamese would come out in two faces. __tests__/letteringFonts.test.ts checks this against the files.
 */
export const NO_ACCENTS: readonly BubbleFont[] = ['bubbly', 'playful'];

/** Interface languages whose everyday text has accented Latin letters. */
const ACCENT_LOCALES: readonly Locale[] = ['vi', 'es', 'pt', 'id'];

export function hasAccents(font: BubbleFont): boolean {
  return !NO_ACCENTS.includes(font);
}

/**
 * Fonts tried in order for a character the chosen font cannot draw, so Japanese typed in a Latin font
 * comes out in a bundled Japanese face of similar weight and not as empty boxes. Every list ends up
 * covering Vietnamese and Japanese; the faces for Korean, Chinese and Thai follow (see fontChain).
 * Past the list, Skia still asks the system fonts.
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
  // Jua and ZCOOL KuaiLe have no Vietnamese and no accented Latin: Huninn and the rounded face do.
  bubbly: ['rounded', 'marker'],
  playful: ['soft', 'rounded'],
  soft: ['rounded', 'marker'],
};

/**
 * The bundled faces for the scripts the Japanese and Latin fonts lack, best first. Text in one of these
 * scripts goes to them right after the chosen font, ahead of the Japanese faces, so a Chinese line is
 * not drawn half in a Japanese face and half in a Chinese one.
 */
const SCRIPT_FACES: Partial<Record<FontScript, readonly BubbleFont[]>> = {
  ko: ['bubbly'],
  'zh-Hans': ['playful', 'soft'],
  'zh-Hant': ['soft', 'playful'],
  th: ['casual'],
};

/**
 * After every chain, so any text finds a face. Han text that could be Japanese is given the script 'ja'
 * (see scriptOf): it goes to the chosen font's Japanese fallbacks, then to the Chinese faces here.
 */
const LAST: readonly BubbleFont[] = ['bubbly', 'playful', 'soft', 'casual'];

export const BUBBLE_FONTS = Object.keys(FONT_FAMILY) as BubbleFont[];

/**
 * The picker's order: fonts that have the interface language come first, otherwise as listed. For a
 * language written with accented Latin letters, the faces without them go last.
 */
export function fontsFor(locale: Locale): BubbleFont[] {
  const has = (font: BubbleFont) => (FONT_SCRIPTS[font] as readonly string[]).includes(locale);
  const fits = (font: BubbleFont) => hasAccents(font) || !ACCENT_LOCALES.includes(locale);
  return [
    ...BUBBLE_FONTS.filter(font => has(font) && fits(font)),
    ...BUBBLE_FONTS.filter(font => !has(font) && fits(font)),
    ...BUBBLE_FONTS.filter(font => !fits(font)),
  ];
}

export function isBubbleFont(value: unknown): value is BubbleFont {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FONT_FAMILY, value);
}

/** A story file written by another version of the app can name a font this one does not have. */
export function knownFont(value: unknown): BubbleFont {
  return isBubbleFont(value) ? value : DEFAULT_FONT;
}

/**
 * The chosen font, then the fonts that draw what it cannot. Given the script of the text, the faces for
 * that script come straight after the chosen font when it does not have the script itself.
 */
export function fontChain(font: unknown, script: FontScript | null = null): BubbleFont[] {
  const first = knownFont(font);
  const ahead = script && !FONT_SCRIPTS[first].includes(script) ? SCRIPT_FACES[script] ?? [] : [];
  return [...new Set([first, ...ahead, ...FALLBACK[first], ...LAST])];
}

/**
 * The font to give a bubble that starts with this text: the wanted one, or the first of its fallbacks
 * that has the script, or the accented letters. The font picker then shows the font the text is really
 * drawn in. It reads the text only, never the interface language, so a story is lettered the same for
 * everyone (see scriptOf for Han text that could be Japanese or Chinese).
 */
export function fontForText(font: BubbleFont, text: string): BubbleFont {
  const script = scriptOf(text);
  if (script) {
    return fontChain(font, script).find(item => FONT_SCRIPTS[item].includes(script)) || font;
  }
  return hasAccents(font) || !hasAccentedLatin(text) ? font : fontChain(font).find(hasAccents) ?? font;
}

/**
 * The family list a Skia paragraph takes: the font itself, then its fallbacks for the script of the text.
 * Like fontForText it reads the text only, so a bubble measures and draws the same in every interface language.
 */
export function fontFamilies(font: unknown, text = ''): string[] {
  return fontChain(font, text ? scriptOf(text) : null).map(key => FONT_FAMILY[key]);
}
