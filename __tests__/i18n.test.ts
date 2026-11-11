import { getLocale, matchLocale, msg, resolveLocale, setLocale, t, tn } from '../src/core/i18n';

afterEach(() => setLocale('en'));

describe('picking the language', () => {
  it('matches a device tag by its language and falls back to English', () => {
    expect(matchLocale('vi-VN')).toBe('vi');
    expect(matchLocale('ja_JP')).toBe('ja');
    expect(matchLocale('VI')).toBe('vi');
    expect(matchLocale('fr-FR')).toBe('en');
    expect(matchLocale('zh-Hans-CN')).toBe('zh-Hans');
    expect(matchLocale('zh-CN')).toBe('zh-Hans');
    expect(matchLocale('zh')).toBe('zh-Hans');
    expect(matchLocale('zh-Hant-HK')).toBe('zh-Hant');
    expect(matchLocale('zh_TW')).toBe('zh-Hant');
    expect(matchLocale('ko-KR')).toBe('ko');
    expect(matchLocale('pt-BR')).toBe('pt');
    expect(matchLocale('in-ID')).toBe('id');
    expect(matchLocale('th-TH')).toBe('th');
    // Cantonese is written in Traditional characters unless the tag says otherwise.
    expect(matchLocale('yue-Hant-HK')).toBe('zh-Hant');
    expect(matchLocale('yue-HK')).toBe('zh-Hant');
    expect(matchLocale('yue')).toBe('zh-Hant');
    expect(matchLocale('yue-Hans-CN')).toBe('zh-Hans');
    expect(matchLocale(undefined)).toBe('en');
  });

  it('follows the device only when the choice is system', () => {
    expect(resolveLocale('system', 'ja-JP')).toBe('ja');
    expect(resolveLocale('vi', 'ja-JP')).toBe('vi');
    expect(resolveLocale('en', 'vi-VN')).toBe('en');
  });
});

describe('translating', () => {
  it('returns the English text in English', () => {
    expect(getLocale()).toBe('en');
    expect(t('Cancel')).toBe('Cancel');
    expect(t('Page {n} of {total}', { n: 2, total: 9 })).toBe('Page 2 of 9');
  });

  it('uses the catalog for the chosen language', () => {
    setLocale('vi');
    expect(t('Cancel')).toBe('Hủy');
    setLocale('ja');
    expect(t('Cancel')).toBe('キャンセル');
  });

  it('falls back to English for text the catalog does not have, and still fills it', () => {
    setLocale('vi');
    expect(t('Not in the catalog {n}', { n: 3 })).toBe('Not in the catalog 3');
  });

  it('leaves a placeholder alone when no value is given for it', () => {
    expect(t('Hi {name}', {})).toBe('Hi {name}');
  });

  it('picks the English form by count and fills the count', () => {
    expect(tn(1, '{count} page', '{count} pages')).toBe('1 page');
    expect(tn(4, '{count} page', '{count} pages')).toBe('4 pages');
    expect(tn(0, '{count} page', '{count} pages')).toBe('0 pages');
  });

  it('never takes what every object has for a translation', () => {
    setLocale('vi');
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(t(key)).toBe(key);
    }
    expect(t('toString', { a: 1 })).toBe('toString');
    expect(t('Hi {constructor}', {})).toBe('Hi {constructor}');
  });

  it('marks text without changing it', () => {
    setLocale('vi');
    expect(msg('Cancel')).toBe('Cancel');
  });
});

describe('a word with two meanings', () => {
  it('shows the plain word in English and the right one elsewhere', () => {
    expect(t('Art|mode')).toBe('Art');
    expect(msg('Art|mode')).toBe('Art|mode');
    setLocale('vi');
    expect(t('Art|mode')).toBe('Vẽ');
    expect(t('Art')).toBe('Hình vẽ');
    expect(t('Unknown word|context')).toBe('Unknown word');
  });
});

describe('quick start title', () => {
  const { isQuickStartTitle, QUICK_START_TITLE } = require('../src/core/story/quickStart');

  it('recognises the quick start in every interface language, and nothing else', () => {
    expect(isQuickStartTitle(QUICK_START_TITLE)).toBe(true);
    setLocale('vi');
    expect(isQuickStartTitle(t(QUICK_START_TITLE))).toBe(true);
    setLocale('ja');
    expect(isQuickStartTitle(t(QUICK_START_TITLE))).toBe(true);
    expect(isQuickStartTitle('My story')).toBe(false);
    expect(isQuickStartTitle('constructor')).toBe(false);
  });

  it('reads one text in every language without building the tables of languages not in use', () => {
    jest.isolateModules(() => {
      const locales = require('../src/core/i18n/locales');
      const built = jest.spyOn(Object, 'assign');
      const { inEveryLanguage } = require('../src/core/i18n');
      const all: string[] = inEveryLanguage('Untitled story');
      expect(all[0]).toBe('Untitled story');
      expect(all).toHaveLength(10);
      expect(all).toContain(locales.localeTable('vi')['Untitled story']);
      // Only the table asked for just now was built.
      expect(built.mock.calls.filter(call => call[0] && Object.getPrototypeOf(call[0]) === null)).toHaveLength(1);
      built.mockRestore();
    });
  });
});
