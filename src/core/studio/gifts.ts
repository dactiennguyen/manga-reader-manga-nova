import { msg, t } from '../i18n';
import { LEVELS, levelIndexOf } from './journey';
import { REWARDS, rewardById } from './rewards';
import { hashString, pick } from './seed';
import type { Gift, Metrics, Reward, StudioState } from './types';

export { REWARDS, rewardById, unlockedOf, withPalette } from './rewards';

export const STREAK_GIFTS = [3, 7, 14, 30, 60, 100] as const;
export const PROMPTS_PER_GIFT = 10;

const STREAK_REASON = msg('For a {count}-day streak');
const LEVEL_REASON = msg('For reaching {level}');
const PROMPTS_REASON = msg('For finishing {count} daily prompts');

/**
 * Every gift the person has earned so far, opened or not. Ids name what earned them (streak-7,
 * level-serial, prompts-20), so each gift exists once and stays opened once it is.
 */
export function earnedGifts(m: Metrics): Gift[] {
  const gifts: Gift[] = [];
  for (const days of STREAK_GIFTS) {
    if (m.bestStreak >= days) {
      gifts.push({ id: `streak-${days}`, reason: STREAK_REASON });
    }
  }
  const level = levelIndexOf(m);
  for (const item of LEVELS.slice(1, level + 1)) {
    gifts.push({ id: `level-${item.id}`, reason: LEVEL_REASON });
  }
  for (let done = PROMPTS_PER_GIFT; done <= m.promptsDone; done += PROMPTS_PER_GIFT) {
    gifts.push({ id: `prompts-${done}`, reason: PROMPTS_REASON });
  }
  return gifts;
}

/** Earned and not opened yet. `today` is not used yet; it keeps room for gifts tied to a day. */
export function availableGifts(m: Metrics, studio: Pick<StudioState, 'giftsOpened'>, _today: string): Gift[] {
  const opened = new Set(studio.giftsOpened);
  return earnedGifts(m).filter(gift => !opened.has(gift.id));
}

/** The reason as shown, such as "For a 7-day streak". The numbers and the level come from the id. */
export function giftReason(gift: Gift): string {
  const [kind, value] = [gift.id.slice(0, gift.id.indexOf('-')), gift.id.slice(gift.id.indexOf('-') + 1)];
  if (kind === 'level') {
    const level = LEVELS.find(item => item.id === value);
    return t(gift.reason, { level: level ? t(level.title) : value });
  }
  return t(gift.reason, { count: Number(value) || 0 });
}

/**
 * Opens a gift: picks a reward the person has not won yet, the same one every time for the same gift and
 * the same collection, and records both, along with which reward this gift gave. Once everything is won, a
 * gift repeats a reward and unlocks nothing new. Opening a gift again changes nothing and returns the reward
 * it gave the first time; `fresh` is true only for the call that opened it.
 */
export function openGift(gift: Gift, studio: StudioState): { reward: Reward; studio: StudioState; fresh: boolean } {
  if (studio.giftsOpened.includes(gift.id)) {
    return { reward: rewardOfOpened(gift, studio), studio, fresh: false };
  }
  const won = new Set(studio.unlocked);
  const fresh = REWARDS.filter(reward => !won.has(reward.id));
  const reward = pick(fresh.length > 0 ? fresh : REWARDS, hashString(gift.id));
  return {
    reward,
    fresh: true,
    studio: {
      ...studio,
      giftsOpened: [...studio.giftsOpened, gift.id],
      unlocked: won.has(reward.id) ? studio.unlocked : [...studio.unlocked, reward.id],
      giftRewards: { ...studio.giftRewards, [gift.id]: reward.id },
    },
  };
}

/** What an opened gift gave. Gifts opened before rewards were recorded get one of the rewards the person won. */
function rewardOfOpened(gift: Gift, studio: StudioState): Reward {
  const recorded = rewardById(studio.giftRewards[gift.id] ?? '');
  if (recorded) {
    return recorded;
  }
  const won = new Set(studio.unlocked);
  const owned = REWARDS.filter(reward => won.has(reward.id));
  return pick(owned.length > 0 ? owned : REWARDS, hashString(gift.id));
}
