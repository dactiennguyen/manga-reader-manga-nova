/**
 * The colours a person keeps: the last ones drawn with, and a palette they build. Both live in settings, so
 * they are shared by every story. Colours are stored as upper case #RRGGBB, which makes the lists
 * case-insensitive.
 */

export const RECENT_COLORS_MAX = 8;
export const SAVED_COLORS_MAX = 24;

export type SaveColorResult = 'added' | 'duplicate' | 'full' | 'invalid';

/** #rgb and #rrggbb in any case become #RRGGBB. Anything else is null. */
export function normalizeColor(color: string): string | null {
  const text = typeof color === 'string' ? color.trim() : '';
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  }
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : null;
}

/** Drops what is not a colour and what repeats, and cuts the list to `max`. For lists read from disk. */
export function cleanColors(list: unknown, max: number): string[] {
  const out: string[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const color = normalizeColor(item as string);
      if (color && !out.includes(color) && out.length < max) {
        out.push(color);
      }
    }
  }
  return out;
}

/** Newest first. Returns the same list when nothing changes, so the caller can skip a write. */
export function addRecentColor(list: string[], color: string): string[] {
  const next = normalizeColor(color);
  if (!next || list[0] === next) {
    return list;
  }
  return [next, ...list.filter(item => normalizeColor(item) !== next)].slice(0, RECENT_COLORS_MAX);
}

/** New colours go to the end, so the palette keeps the order the person built it in. */
export function addSavedColor(list: string[], color: string): { list: string[]; result: SaveColorResult } {
  const next = normalizeColor(color);
  if (!next) {
    return { list, result: 'invalid' };
  }
  if (list.some(item => normalizeColor(item) === next)) {
    return { list, result: 'duplicate' };
  }
  if (list.length >= SAVED_COLORS_MAX) {
    return { list, result: 'full' };
  }
  return { list: [...list, next], result: 'added' };
}

export function removeSavedColor(list: string[], color: string): string[] {
  const gone = normalizeColor(color);
  const next = list.filter(item => normalizeColor(item) !== gone);
  return next.length === list.length ? list : next;
}

export function isGrayColor(color: string): boolean {
  const hex = normalizeColor(color);
  return !!hex && hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);
}

/** A black and white story is only offered grays, as with the built-in swatches. */
export function colorsFor(list: string[], colored: boolean): string[] {
  return colored ? list : list.filter(isGrayColor);
}
