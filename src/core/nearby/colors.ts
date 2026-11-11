/**
 * Each member's ink, by `Member.color`: their cursor, their name tag and (in co-draw) their layer's tint.
 * Printing-ink tones that stay readable on cream paper and on the dark studio, and stay apart for
 * the common kinds of colour blindness when paired with the member's name, which is always shown.
 */
export const MEMBER_COLORS = [
  '#E4572E', // coral (the host)
  '#2F6FB5', // blue
  '#1E8C7E', // teal
  '#C9922B', // mustard
  '#5B8F3A', // leaf
  '#D2607A', // rose
  '#9A6037', // umber
  '#56626E', // slate
] as const;

export function memberColor(index: number): string {
  return MEMBER_COLORS[((index % MEMBER_COLORS.length) + MEMBER_COLORS.length) % MEMBER_COLORS.length];
}
