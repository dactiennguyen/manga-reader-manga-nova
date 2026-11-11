import { localeTable, localeText, type LocaleTable, type TranslatedLocale } from './locales';

/**
 * The interface text is written in English in the code, and the English text is the key:
 * `t('Start creating')`. Every other language is one JSON file in ./locales, grouped by part of the
 * app and loaded only when that language is in use. A missing entry falls back to English, and
 * __tests__/i18nCatalog.test.ts fails when one is missing.
 */

export type Locale = 'en' | 'vi' | 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko' | 'es' | 'pt' | 'id' | 'th';

export type LanguageChoice = 'system' | Locale;

export type { LocaleTable, TranslatedLocale };

export const LOCALES: readonly Locale[] = ['en', 'vi', 'ja', 'zh-Hans', 'zh-Hant', 'ko', 'es', 'pt', 'id', 'th'];

export const TRANSLATED_LOCALES = LOCALES.filter((item): item is TranslatedLocale => item !== 'en');

/** Shown in their own language, so they are not translated. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ko: '한국어',
  es: 'Español',
  pt: 'Português (Brasil)',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
};

/** The BCP 47 tag of each language, for speech, sorting and the system. */
export const LOCALE_TAG: Record<Locale, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ko: 'ko-KR',
  es: 'es-ES',
  pt: 'pt-BR',
  id: 'id-ID',
  th: 'th-TH',
};

let locale: Locale = 'en';

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
}

/**
 * 'vi-VN' and 'vi' both give 'vi'. Chinese is told apart by script, then by region: Taiwan, Hong Kong and
 * Macau read Traditional. Cantonese ('yue') is written in Traditional characters unless the tag says
 * Simplified. Anything the app has no text for gives English.
 */
export function matchLocale(tag: string | null | undefined): Locale {
  const parts = (tag ?? '').toLowerCase().split(/[-_]/);
  const language = parts[0];
  if (language === 'zh') {
    if (parts.includes('hant')) {
      return 'zh-Hant';
    }
    if (parts.includes('hans')) {
      return 'zh-Hans';
    }
    return parts.some(part => part === 'tw' || part === 'hk' || part === 'mo') ? 'zh-Hant' : 'zh-Hans';
  }
  if (language === 'yue') {
    return parts.includes('hans') ? 'zh-Hans' : 'zh-Hant';
  }
  if (language === 'in') {
    // Older Android names Indonesian 'in'.
    return 'id';
  }
  return LOCALES.find(item => item === language) ?? 'en';
}

export function resolveLocale(choice: LanguageChoice, deviceTag: string | null | undefined): Locale {
  return choice === 'system' ? matchLocale(deviceTag) : choice;
}

type Params = Record<string, string | number>;

function fill(text: string, params?: Params): string {
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole)) : text;
}

/** `'Art|mode'` is the word "Art" as a mode name: the part after `|` only tells two meanings apart. */
function plain(text: string): string {
  const mark = text.lastIndexOf('|');
  return mark > 0 ? text.slice(0, mark) : text;
}

/**
 * Translates interface text. `{name}` in the text is replaced from `params`.
 * When one English word needs two translations, add a context: `t('Art|mode')` shows "Art" in English.
 */
export function t(text: string, params?: Params): string {
  return fill(lookup(locale, text) ?? plain(text), params);
}

function lookup(current: Locale, text: string): string | undefined {
  return current === 'en' ? undefined : localeTable(current)[text];
}

/**
 * One text in every language, English first. Reads every language file, without building tables for the
 * languages not in use, so keep it off hot paths and keep what it returns.
 */
export function inEveryLanguage(text: string): string[] {
  return [plain(text), ...TRANSLATED_LOCALES.map(item => localeText(item, text)).filter((value): value is string => !!value)];
}

/** For a count: `tn(pages, '{count} page', '{count} pages')`. `{count}` is filled in for you. */
export function tn(count: number, one: string, other: string, params?: Params): string {
  return t(count === 1 ? one : other, { count, ...params });
}

/**
 * Marks text that is defined outside a component, where the language is not known yet:
 * `const TABS = [{ label: msg('Chapters') }]`, then `t(tab.label)` when it is drawn.
 */
export function msg(text: string): string {
  return text;
}
