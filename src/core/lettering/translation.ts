import type { Bubble } from '../model/types';

export const MAX_LANGUAGES = 5;
export const LANGUAGE_NAME_MAX = 24;
export const TRANSLATED_MIN_FONT_SIZE = 9;

export function cleanLanguageName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, LANGUAGE_NAME_MAX).trim();
}

export function sameLanguage(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function languageNameError(languages: string[], name: string, renaming?: string): string | null {
  const clean = cleanLanguageName(name);
  if (!clean) {
    return 'Enter a language name';
  }
  if (clean in Object.prototype) {
    return 'Choose a different name';
  }
  if (sameLanguage(clean, 'Original')) {
    return '"Original" is reserved for the source text';
  }
  if (languages.some(item => item !== renaming && sameLanguage(item, clean))) {
    return 'That language already exists';
  }
  if (!renaming && languages.length >= MAX_LANGUAGES) {
    return `A story can have up to ${MAX_LANGUAGES} extra languages`;
  }
  return null;
}

export function translationOf(bubble: Pick<Bubble, 'translations'>, lang?: string | null): string {
  if (!lang) {
    return '';
  }
  const value = bubble.translations?.[lang];
  return typeof value === 'string' && value.trim() ? value : '';
}

export function hasTranslation(bubble: Pick<Bubble, 'translations'>, lang?: string | null): boolean {
  return translationOf(bubble, lang) !== '';
}

export function bubbleText(bubble: Pick<Bubble, 'text' | 'translations'>, lang?: string | null): string {
  return translationOf(bubble, lang) || bubble.text;
}

export function localizeBubble(bubble: Bubble, lang?: string | null): Bubble {
  const translated = translationOf(bubble, lang);
  return translated ? { ...bubble, text: translated } : bubble;
}

export function setTranslation(bubble: Bubble, lang: string, text: string): Bubble {
  const translations = { ...(bubble.translations ?? {}) };
  if (text) {
    translations[lang] = text;
  } else {
    delete translations[lang];
  }
  return { ...bubble, translations: Object.keys(translations).length ? translations : undefined };
}

export function dropTranslations(bubble: Bubble, lang: string): Bubble {
  if (!bubble.translations || !(lang in bubble.translations)) {
    return bubble;
  }
  const rest = { ...bubble.translations };
  delete rest[lang];
  return { ...bubble, translations: Object.keys(rest).length ? rest : undefined };
}

export function renameTranslations(bubble: Bubble, from: string, to: string): Bubble {
  if (from === to || !bubble.translations || !(from in bubble.translations)) {
    return bubble;
  }
  const { [from]: moved, ...rest } = bubble.translations;
  return { ...bubble, translations: { ...rest, [to]: moved } };
}

export function translatableBubbles<T extends Pick<Bubble, 'text' | 'translations'>>(bubbles: T[], lang: string): T[] {
  return bubbles.filter(bubble => bubble.text.trim() !== '' || hasTranslation(bubble, lang));
}

export function translationProgress(
  bubbles: Pick<Bubble, 'text' | 'translations'>[],
  lang: string,
): { done: number; total: number } {
  const source = translatableBubbles(bubbles, lang);
  return { done: source.filter(bubble => hasTranslation(bubble, lang)).length, total: source.length };
}

export function languageFileTag(lang?: string | null): string {
  if (!lang) {
    return '';
  }
  const tag = lang
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LANGUAGE_NAME_MAX);
  return tag || 'translated';
}
