import { rewardById } from './rewards';
import { EMPTY_STUDIO, type StudioState } from './types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A frame id such as 'gold'. Whether it is won is checked when the card is made. */
const FRAME = /^[a-z]{1,20}$/;
/** Lists grow by one item per gift, letter or badge, so this is far above any real use and only stops junk. */
const LIST_MAX = 2000;

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item && !out.includes(item) && out.length < LIST_MAX) {
      out.push(item);
    }
  }
  return out;
}

function dayOrEmpty(value: unknown): string {
  return typeof value === 'string' && DAY.test(value) ? value : '';
}

/** Reads what was saved under `studio`, keeping every good field and replacing anything broken. */
export function parseStudio(raw: string | null | undefined): StudioState {
  if (!raw) {
    return EMPTY_STUDIO;
  }
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return EMPTY_STUDIO;
    }
    value = parsed as Record<string, unknown>;
  } catch {
    return EMPTY_STUDIO;
  }
  const promptDays: Record<string, string> = {};
  if (value.promptDays && typeof value.promptDays === 'object' && !Array.isArray(value.promptDays)) {
    for (const [day, id] of Object.entries(value.promptDays as Record<string, unknown>)) {
      if (DAY.test(day) && typeof id === 'string' && id) {
        promptDays[day] = id;
      }
    }
  }
  const cardFrames: Record<string, string> = {};
  if (value.cardFrames && typeof value.cardFrames === 'object' && !Array.isArray(value.cardFrames)) {
    for (const [characterId, frame] of Object.entries(value.cardFrames as Record<string, unknown>)) {
      if (characterId && typeof frame === 'string' && FRAME.test(frame) && Object.keys(cardFrames).length < LIST_MAX) {
        cardFrames[characterId] = frame;
      }
    }
  }
  const giftRewards: Record<string, string> = {};
  if (value.giftRewards && typeof value.giftRewards === 'object' && !Array.isArray(value.giftRewards)) {
    for (const [giftId, rewardId] of Object.entries(value.giftRewards as Record<string, unknown>)) {
      if (giftId && typeof rewardId === 'string' && rewardById(rewardId) && Object.keys(giftRewards).length < LIST_MAX) {
        giftRewards[giftId] = rewardId;
      }
    }
  }
  const level = value.levelSeen;
  const weekday = value.issueWeekday;
  return {
    promptDays,
    giftsOpened: strings(value.giftsOpened),
    unlocked: strings(value.unlocked),
    giftRewards,
    badgesSeen: strings(value.badgesSeen),
    mailRead: strings(value.mailRead),
    levelSeen: typeof level === 'number' && Number.isInteger(level) && level >= 0 && level < 100 ? level : 0,
    clubIntroSeen: value.clubIntroSeen === true,
    issueWeekday: typeof weekday === 'number' && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : EMPTY_STUDIO.issueWeekday,
    editorHiddenDay: dayOrEmpty(value.editorHiddenDay),
    chatHiddenDay: dayOrEmpty(value.chatHiddenDay),
    cardFrames,
  };
}
