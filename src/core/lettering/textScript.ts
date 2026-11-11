/**
 * The writing system of a piece of text, for every part of the app that has to guess it: the fonts a
 * bubble is drawn in, and the voice a table read speaks in. Most scripts show in their letters. Two
 * cases need a rule, and the caller says which one by passing a language or not:
 * - Han characters with no kana, all of which Japanese also writes ('三年後', '東京', '贅沢'), could be
 *   Japanese, Simplified or Traditional Chinese. A character Japanese does not write ('你', '们', '說')
 *   makes the text Chinese, and then the Simplified or Traditional forms in it say which (see hanVariants.ts).
 * - Latin letters are only Vietnamese with letters no Western European language has (ă đ ơ ư ạ ả ế…):
 *   á é ó ã ê ô are as much Spanish, Portuguese or French.
 */
import type { Locale } from '../i18n';
import { JAPANESE_KANJI, SIMPLIFIED_FORMS, TRADITIONAL_FORMS } from './hanVariants';

/** A script beyond basic Latin, named like the language that writes in it. */
export type TextScript = Extract<Locale, 'vi' | 'ja' | 'ko' | 'zh-Hans' | 'zh-Hant' | 'th'>;

/**
 * What the letters alone tell: 'han' is Han text Japanese could have written, which could also be either
 * form of Chinese; 'zh' is Chinese with nothing to tell the form.
 */
export type Writing = TextScript | 'han' | 'zh' | null;

// Hiragana, katakana, the small katakana for Ainu (ㇰ-ㇿ) and half-width katakana (ｦ-ﾟ).
export const KANA = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/;
// Jamo, compatibility jamo (ㅋ ㅠ), jamo extended A (ꥠ-꥿) and B, syllables, and half-width jamo.
export const HANGUL = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff\uffa0-\uffdc]/;
export const THAI = /[\u0e01-\u0e5b]/;
// Ideographs: extension A, the unified block and the compatibility block.
export const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
// The full-width punctuation Chinese and Japanese share: '！？' and '「…」' need a CJK face.
export const CJK_PUNCTUATION = /[\u3000-\u303f\uff01-\uff60]/;
// Letters Vietnamese has and Western European languages do not: ă đ ĩ ũ ơ ư and the tone-marked vowels of U+1EA0-1EF9.
export const VIETNAMESE = /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/;
// Latin letters with a mark, and the Spanish ¡ ¿: what Spanish, Portuguese and Vietnamese add to a-z.
export const ACCENTED_LATIN = /[\u00a1\u00bf\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1e00-\u1eff]/;
// A letter followed by a combining accent, for text that is not in NFC.
const COMBINING_ACCENT = /[a-z][\u0300-\u036f]/i;

let sets: { japanese: Set<string>; simplified: Set<string>; traditional: Set<string> } | null = null;

/** Built the first time Han text comes by. */
function hanSets() {
  return (sets ??= {
    japanese: new Set(JAPANESE_KANJI),
    simplified: new Set(SIMPLIFIED_FORMS),
    traditional: new Set(TRADITIONAL_FORMS),
  });
}

/** Languages written in Latin letters with nothing to tell them apart but the words. */
export const LATIN_LOCALES: readonly Locale[] = ['en', 'es', 'pt', 'id'];

type HanFacts = { chinese: boolean; form: TextScript | null };

/**
 * Whether Han text has a character Japanese does not write, and the form of Chinese its characters point
 * to: forms Japanese does not write count first, then the most forms; null when they do not tell.
 */
function hanFacts(text: string): HanFacts {
  const { japanese, simplified, traditional } = hanSets();
  let chinese = false;
  const count = { simplified: 0, traditional: 0, simplifiedOnly: 0, traditionalOnly: 0 };
  for (const char of text) {
    if (!HAN.test(char)) {
      continue;
    }
    const foreign = !japanese.has(char);
    chinese ||= foreign;
    if (simplified.has(char)) {
      count.simplified++;
      count.simplifiedOnly += foreign ? 1 : 0;
    } else if (traditional.has(char)) {
      count.traditional++;
      count.traditionalOnly += foreign ? 1 : 0;
    }
  }
  const byOnly = Math.sign(count.simplifiedOnly - count.traditionalOnly);
  const byAll = Math.sign(count.simplified - count.traditional);
  const lead = (count.simplifiedOnly > 0) !== (count.traditionalOnly > 0) ? byOnly : byAll || byOnly;
  return { chinese, form: lead > 0 ? 'zh-Hans' : lead < 0 ? 'zh-Hant' : null };
}

/** The script the letters of the text show, without guessing. Kana wins over Han: Japanese mixes both. */
export function writingOf(text: string): Writing {
  if (KANA.test(text)) {
    return 'ja';
  }
  if (HANGUL.test(text)) {
    return 'ko';
  }
  if (THAI.test(text)) {
    return 'th';
  }
  if (HAN.test(text)) {
    const { chinese, form } = hanFacts(text);
    return chinese ? form ?? 'zh' : 'han';
  }
  if (VIETNAMESE.test(text.normalize('NFC'))) {
    return 'vi';
  }
  // Punctuation alone ('！？'), with no Latin letters next to it.
  return CJK_PUNCTUATION.test(text) && !/[A-Za-z]/.test(text) ? 'han' : null;
}

/**
 * The form of Chinese text that could be either: in Traditional Chinese Traditional, in any other
 * language Simplified. Without a language, Traditional: both Chinese faces have the characters the two
 * forms share, and Huninn also has the rarer Traditional ones no list here names (噠).
 */
export function chineseScript(locale: Locale | null): TextScript {
  return locale === null || locale === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans';
}

/**
 * The script for Han text Japanese could have written. In Japanese, and without a language, Japanese: the
 * drawing code takes it as the Japanese faces first and the Chinese faces after them, the same for every
 * reader. In any other language, Chinese, of the form its characters show or else as chineseScript says.
 */
export function hanScript(text: string, locale: Locale | null): TextScript {
  return locale === null || locale === 'ja' ? 'ja' : hanFacts(text).form ?? chineseScript(locale);
}

/**
 * The script of the text that needs more than basic Latin, or null for text in plain or Western European
 * Latin. Han text that could be more than one goes by `locale`, or by a fixed rule without one (hanScript,
 * chineseScript). Code that draws a story passes no language, so it looks the same to every reader.
 */
export function scriptOf(text: string, locale: Locale | null = null): TextScript | null {
  const writing = writingOf(text);
  return writing === 'han' ? hanScript(text, locale) : writing === 'zh' ? chineseScript(locale) : writing;
}

/** Text with Latin letters a font without accents cannot draw: 'café', '¿Qué?', 'Não', 'Trời'. */
export function hasAccentedLatin(text: string): boolean {
  return ACCENTED_LATIN.test(text) || COMBINING_ACCENT.test(text);
}
