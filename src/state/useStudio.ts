import { create } from 'zustand';

import type { MetaRepo } from '../core/ports';
import { openGift as openStudioGift, unlockedOf, withPalette } from '../core/studio/gifts';
import { parseStudio } from '../core/studio/studioState';
import { EMPTY_STUDIO, type Gift, type Reward, type StudioState } from '../core/studio/types';
import { useSettings } from './useSettings';

const KEY = 'studio';

let repo: MetaRepo | null = null;

type StudioActions = {
  markPromptDone: (day: string, id: string) => void;
  /**
   * Opens a gift and returns what was in it. A palette goes straight into the saved colours, and `added` says
   * how many of its colours were new (0 for other rewards, and for a gift that was already open).
   */
  openGift: (gift: Gift) => { reward: Reward; added: number };
  markBadgesSeen: (ids: string[]) => void;
  markMailRead: (id: string) => void;
  setLevelSeen: (level: number) => void;
  setClubIntroSeen: () => void;
  setIssueWeekday: (weekday: number) => void;
  hideEditor: (day: string) => void;
  hideChat: (day: string) => void;
  /** Chooses the frame of one character's card. 'plain' is always allowed; other frames must be won. */
  setCardFrame: (characterId: string, frame: string) => void;
};

export type StudioStore = StudioState & StudioActions;

const FIELDS = Object.keys(EMPTY_STUDIO) as (keyof StudioState)[];

/** The saved fields only, without the actions. */
function data(store: StudioStore): StudioState {
  return Object.fromEntries(FIELDS.map(key => [key, store[key]])) as StudioState;
}

/** Adds the colours of a palette reward to the saved ones. 0 when it is not a palette or nothing fit. */
function addPaletteColors(reward: Reward): number {
  if (reward.kind !== 'palette') {
    return 0;
  }
  const settings = useSettings.getState();
  const out = withPalette(settings.savedColors, reward.payload);
  if (out.added > 0) {
    settings.set({ savedColors: out.list });
  }
  return out.added;
}

export const useStudio = create<StudioStore>()((set, get) => {
  /** Every change is rare and small, so it is written at once. */
  const update = (patch: Partial<StudioState>) => {
    set(patch);
    repo?.set(KEY, JSON.stringify(data(get())));
  };
  const addOnce = (list: string[], items: string[]) => {
    const fresh = items.filter(item => item && !list.includes(item));
    return fresh.length > 0 ? [...list, ...fresh] : list;
  };
  return {
    ...EMPTY_STUDIO,
    markPromptDone: (day, id) => {
      if (get().promptDays[day] !== id) {
        update({ promptDays: { ...get().promptDays, [day]: id } });
      }
    },
    openGift: gift => {
      const before = data(get());
      const opened = openStudioGift(gift, before);
      if (!opened.fresh) {
        return { reward: opened.reward, added: 0 };
      }
      update({ giftsOpened: opened.studio.giftsOpened, unlocked: opened.studio.unlocked, giftRewards: opened.studio.giftRewards });
      return { reward: opened.reward, added: addPaletteColors(opened.reward) };
    },
    markBadgesSeen: ids => {
      const next = addOnce(get().badgesSeen, ids);
      if (next !== get().badgesSeen) {
        update({ badgesSeen: next });
      }
    },
    markMailRead: id => {
      const next = addOnce(get().mailRead, [id]);
      if (next !== get().mailRead) {
        update({ mailRead: next });
      }
    },
    setLevelSeen: level => {
      if (level > get().levelSeen) {
        update({ levelSeen: level });
      }
    },
    setClubIntroSeen: () => {
      if (!get().clubIntroSeen) {
        update({ clubIntroSeen: true });
      }
    },
    setIssueWeekday: weekday => {
      if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) {
        update({ issueWeekday: weekday });
      }
    },
    hideEditor: day => update({ editorHiddenDay: day }),
    hideChat: day => update({ chatHiddenDay: day }),
    setCardFrame: (characterId, frame) => {
      if (frame !== 'plain' && !unlockedOf(get(), 'cardFrame').some(reward => reward.payload[0] === frame)) {
        return;
      }
      if (get().cardFrames[characterId] !== frame) {
        update({ cardFrames: { ...get().cardFrames, [characterId]: frame } });
      }
    },
  };
});

export function connectStudio(next: MetaRepo | null): void {
  repo = next;
  useStudio.setState(parseStudio(next?.get(KEY)));
}
