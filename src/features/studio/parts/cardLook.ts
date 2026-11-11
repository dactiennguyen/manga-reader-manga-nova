import { msg } from '../../../core/i18n';
import type { Rarity } from '../../../core/studio/types';

/**
 * Character cards are printed on cream paper in both themes, so they look like the same card wherever they
 * are shown or shared. A frame is the band around the paper, drawn only with theme tokens and borders.
 */
export type CardFrameId = 'plain' | 'ink' | 'sakura' | 'gold' | 'tone';

export const CARD_FRAMES: readonly CardFrameId[] = ['plain', 'ink', 'sakura', 'gold', 'tone'];

/** `band` sits over a paper base; `edge` is the line around the inner paper. Literal strings for Uniwind. */
export const FRAME_LOOK: Record<CardFrameId, { outer: string; band: string; edge: string }> = {
  plain: { outer: 'border border-on-paper/20', band: '', edge: 'border border-on-paper/15' },
  ink: { outer: '', band: 'bg-on-paper', edge: '' },
  sakura: { outer: '', band: 'bg-accent/30', edge: 'border border-accent/50' },
  gold: { outer: '', band: 'bg-warning/60', edge: 'border-2 border-warning' },
  tone: { outer: 'border-4 border-dotted border-on-paper/60', band: '', edge: 'border border-dashed border-on-paper/50' },
};

export const FRAME_TITLE: Record<CardFrameId, string> = {
  plain: msg('Plain frame'),
  ink: msg('Ink frame'),
  sakura: msg('Sakura frame'),
  gold: msg('Gold frame'),
  tone: msg('Screentone frame'),
};

export function frameIdOf(frame: string): CardFrameId {
  return (CARD_FRAMES as readonly string[]).includes(frame) ? (frame as CardFrameId) : 'plain';
}

/** Stars say the rarity without colour; one per step. */
export const RARITY_LOOK: Record<Rarity, { stars: number; label: string }> = {
  common: { stars: 1, label: msg('Common') },
  rare: { stars: 2, label: msg('Rare') },
  epic: { stars: 3, label: msg('Epic') },
  legend: { stars: 4, label: msg('Legend') },
};

export const STAT_LABEL = {
  power: msg('Power'),
  wit: msg('Wit'),
  charm: msg('Charm'),
  heart: msg('Heart'),
} as const;
