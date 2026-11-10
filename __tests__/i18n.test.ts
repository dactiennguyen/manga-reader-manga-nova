import { getLocale, matchLocale, msg, resolveLocale, setLocale, t, tn } from '../src/core/i18n';

afterEach(() => setLocale('en'));

describe('picking the language', () => {
  it('matches a device tag by its language and falls back to English', () => {
    expect(matchLocale('vi-VN')).toBe('vi');
    expect(matchLocale('ja_JP')).toBe('ja');
    expect(matchLocale('VI')).toBe('vi');
    expect(matchLocale('fr-FR')).toBe('en');
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
