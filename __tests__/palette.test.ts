import {
  RECENT_COLORS_MAX,
  SAVED_COLORS_MAX,
  addRecentColor,
  addSavedColor,
  cleanColors,
  colorsFor,
  isGrayColor,
  normalizeColor,
  removeSavedColor,
} from '../src/core/art/palette';
import { DEFAULT_SETTINGS } from '../src/state/useSettings';

const shade = (n: number) => `#${n.toString(16).padStart(2, '0').repeat(3)}`.toUpperCase();

describe('colour lists', () => {
  it('stores colours as upper case #RRGGBB', () => {
    expect(normalizeColor('#e53935')).toBe('#E53935');
    expect(normalizeColor(' #AbC ')).toBe('#AABBCC');
    expect(normalizeColor('red')).toBeNull();
    expect(normalizeColor('#12345')).toBeNull();
    expect(normalizeColor('#12345G')).toBeNull();
  });

  it('keeps the last eight distinct colours, newest first', () => {
    let list: string[] = [];
    for (let i = 0; i < 12; i++) {
      list = addRecentColor(list, shade(i));
    }
    expect(list).toHaveLength(RECENT_COLORS_MAX);
    expect(list[0]).toBe(shade(11));
    expect(list[7]).toBe(shade(4));
  });

  it('moves a colour used again to the front instead of listing it twice, whatever its case', () => {
    const list = addRecentColor(addRecentColor(addRecentColor([], '#111111'), '#abcdef'), '#222222');
    expect(addRecentColor(list, '#ABCDEF')).toEqual(['#ABCDEF', '#222222', '#111111']);
  });

  it('returns the same list when the newest colour is used again, so nothing is written', () => {
    const list = addRecentColor([], '#111111');
    expect(addRecentColor(list, '#111111')).toBe(list);
    expect(addRecentColor(list, 'nonsense')).toBe(list);
  });

  it('adds to the end of the saved palette and refuses a repeat in any case', () => {
    const first = addSavedColor([], '#e53935');
    expect(first).toEqual({ list: ['#E53935'], result: 'added' });
    const again = addSavedColor(first.list, '#E53935');
    expect(again.result).toBe('duplicate');
    expect(again.list).toBe(first.list);
    expect(addSavedColor(first.list, '#000').list).toEqual(['#E53935', '#000000']);
    expect(addSavedColor(first.list, 'blue').result).toBe('invalid');
  });

  it('holds 24 saved colours and says when it is full', () => {
    let list: string[] = [];
    for (let i = 0; i < SAVED_COLORS_MAX; i++) {
      list = addSavedColor(list, shade(i)).list;
    }
    expect(list).toHaveLength(24);
    const full = addSavedColor(list, '#E53935');
    expect(full.result).toBe('full');
    expect(full.list).toBe(list);
    expect(addSavedColor(list, shade(3)).result).toBe('duplicate');
  });

  it('removes one saved colour, and leaves the list alone when it is not there', () => {
    const list = ['#111111', '#E53935', '#222222'];
    expect(removeSavedColor(list, '#e53935')).toEqual(['#111111', '#222222']);
    expect(removeSavedColor(list, '#999999')).toBe(list);
  });

  it('repairs a list read from disk', () => {
    expect(cleanColors(['#abc', '#AABBCC', 'x', 7, '#000000'], 8)).toEqual(['#AABBCC', '#000000']);
    expect(cleanColors(['#111111', '#222222', '#333333'], 2)).toEqual(['#111111', '#222222']);
    expect(cleanColors(undefined, 8)).toEqual([]);
    expect(cleanColors('nope', 8)).toEqual([]);
  });

  it('offers a black and white story its grays only', () => {
    const list = ['#E53935', '#808080', '#000000', '#1E88E5'];
    expect(colorsFor(list, true)).toBe(list);
    expect(colorsFor(list, false)).toEqual(['#808080', '#000000']);
    expect(isGrayColor('#fff')).toBe(true);
    expect(isGrayColor('#FFFFFE')).toBe(false);
  });

  it('starts empty in settings, where both lists are kept between launches', () => {
    expect(DEFAULT_SETTINGS.recentColors).toEqual([]);
    expect(DEFAULT_SETTINGS.savedColors).toEqual([]);
  });
});
