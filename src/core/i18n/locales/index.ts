import type { Locale } from '..';

/** One language's text, by part of the app: `{ canvas: { 'Undo': '…' } }`. Keys are the English text. */
export type LocaleParts = Record<string, Record<string, string>>;

/** English text to one language's text, all parts together. */
export type LocaleTable = Record<string, string>;

export type TranslatedLocale = Exclude<Locale, 'en'>;

/* eslint-disable @typescript-eslint/no-require-imports */
// Required when first used, so a language's file is only read into memory when someone picks it.
const LOADERS: Record<TranslatedLocale, () => LocaleParts> = {
  vi: () => require('./vi.json'),
  ja: () => require('./ja.json'),
  'zh-Hans': () => require('./zh-Hans.json'),
  'zh-Hant': () => require('./zh-Hant.json'),
  ko: () => require('./ko.json'),
  es: () => require('./es.json'),
  pt: () => require('./pt.json'),
  id: () => require('./id.json'),
  th: () => require('./th.json'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const tables: Partial<Record<TranslatedLocale, LocaleTable>> = {};

export function localeParts(locale: TranslatedLocale): LocaleParts {
  return LOADERS[locale]();
}

const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * The language's text, all parts in one table built once. It has no prototype, so a key like
 * 'constructor' or 'toString' is only found when the file has it.
 */
export function localeTable(locale: TranslatedLocale): LocaleTable {
  return (tables[locale] ??= Object.assign(Object.create(null) as LocaleTable, ...Object.values(localeParts(locale))));
}

/**
 * One text in a language, without building that language's table: for reading a few texts in a
 * language nobody is using. Uses the table when it is already built.
 */
export function localeText(locale: TranslatedLocale, key: string): string | undefined {
  const table = tables[locale];
  if (table) {
    return table[key];
  }
  for (const part of Object.values(localeParts(locale))) {
    if (own(part, key)) {
      return part[key];
    }
  }
  return undefined;
}
