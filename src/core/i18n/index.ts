import { CATALOG } from './catalog';

/**
 * The interface text is written in English in the code, and the English text is the key:
 * `t('Start creating')`. Vietnamese and Japanese live in ./catalog. A missing entry falls back
 * to English, and __tests__/i18nCatalog.test.ts fails when one is missing.
 */

export type Locale = 'en' | 'vi' | 'ja';

export type LanguageChoice = 'system' | Locale;

export type CatalogPart = Record<string, { vi: string; ja: string }>;

export const LOCALES: readonly Locale[] = ['en', 'vi', 'ja'];

/** Shown in their own language, so they are not translated. */
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', vi: 'Tiếng Việt', ja: '日本語' };

let locale: Locale = 'en';

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
}

/** 'vi-VN' and 'vi' both give 'vi'. Anything the app has no text for gives English. */
export function matchLocale(tag: string | null | undefined): Locale {
  const language = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return LOCALES.find(item => item === language) ?? 'en';
}

export function resolveLocale(choice: LanguageChoice, deviceTag: string | null | undefined): Locale {
  return choice === 'system' ? matchLocale(deviceTag) : choice;
}

type Params = Record<string, string | number>;

function fill(text: string, params?: Params): string {
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : text;
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
  const current = locale;
  return fill((current === 'en' ? undefined : CATALOG[text]?.[current]) ?? plain(text), params);
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
