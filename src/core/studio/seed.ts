/* eslint-disable no-bitwise -- hashing and seeded generators work on 32-bit integers. */
/**
 * Small deterministic randomness for the studio. The same input always gives the same pick, so a note,
 * a vote or a gift stays put between launches instead of reshuffling every render.
 */

/** FNV-1a over UTF-16 code units, as an unsigned 32-bit number. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded generator returning numbers in [0, 1). */
export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One item chosen by seed. The seed is mixed first so neighbouring seeds (day numbers) do not just cycle. Throws on an empty list, which is always a caller bug. */
export function pick<T>(items: readonly T[], seed: number): T {
  if (items.length === 0) throw new Error('pick from an empty list');
  return items[Math.floor(rand(seed)() * items.length)];
}
