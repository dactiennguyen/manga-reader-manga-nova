import { msg, t } from '../../../core/i18n';
import type { Reward, RewardKind } from '../../../core/studio/types';

/** Where each kind of reward shows up, so the person can go and use it. */
const WHERE: Record<RewardKind, string> = {
  palette: msg('Its colours were added to your saved colours.'),
  cardFrame: msg('Dress your character cards with it.'),
  sfx: msg('Find it in the lettering presets.'),
  bubble: msg('Find it in the lettering presets.'),
  pose: msg('Find it in the poses sheet while drawing.'),
};
const PALETTE_FULL = msg('No new colours were added: they are already saved, or your saved colours are full.');

/** The line under a won reward. A palette that added no colours says so instead of claiming they were added. */
export function rewardWhere(reward: Reward, added: number): string {
  return t(reward.kind === 'palette' && added === 0 ? PALETTE_FULL : WHERE[reward.kind]);
}
