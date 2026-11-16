import { setLocale } from '../src/core/i18n';
import { formatDate, formatRelative } from '../src/core/util/time';

const NOV_16 = new Date(2026, 10, 16, 12).getTime();

afterEach(() => setLocale('en'));

describe('formatDate', () => {
  it('follows the app language', () => {
    setLocale('en');
    expect(formatDate(NOV_16)).toBe('11/16/2026');
    expect(formatDate(NOV_16, true)).toBe('Mon, 11/16/2026');
    setLocale('vi');
    expect(formatDate(NOV_16)).toBe('16/11/2026');
    setLocale('ja');
    expect(formatDate(NOV_16)).toBe('2026/11/16');
    setLocale('es');
    expect(formatDate(NOV_16)).toBe('16/11/2026');
  });

  it('falls back to a plain date in the right order when Intl fails', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no Intl');
    });
    try {
      setLocale('pt');
      expect(formatDate(NOV_16)).toBe('16/11/2026');
      setLocale('en');
      expect(formatDate(NOV_16, true)).toBe('Mon, 11/16/2026');
      setLocale('ko');
      expect(formatDate(NOV_16)).toBe('2026. 11. 16.');
    } finally {
      spy.mockRestore();
    }
  });

  it('is what an old relative time shows', () => {
    expect(formatRelative(NOV_16, NOV_16 + 40 * 24 * 60 * 60 * 1000)).toBe('11/16/2026');
  });
});
