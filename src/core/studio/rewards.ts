import { SAVED_COLORS_MAX, addSavedColor, cleanColors } from '../art/palette';
import { msg } from '../i18n';
import type { Reward, RewardKind, StudioState } from './types';

/**
 * What a gift can hold. Every reward is real content the person can use: colours go into their palette,
 * frames dress their character cards, and the bonus presets and poses appear in the lettering and pose
 * sheets once won. Ids are saved, so they never change.
 */
export const PALETTE_REWARDS: Reward[] = [
  { id: 'palette:riso', kind: 'palette', title: msg('Riso classics'), payload: ['#F15060', '#3D5588', '#FFB511', '#00838A', '#2B2B2B'] },
  { id: 'palette:sakura', kind: 'palette', title: msg('Sakura dusk'), payload: ['#F2B8C6', '#D9667A', '#7A4E6D', '#F6E3D4', '#3E3A4D'] },
  { id: 'palette:sea', kind: 'palette', title: msg('Sea and ink'), payload: ['#E4EEF0', '#8FB8C4', '#3F7C8C', '#1E4D5C', '#12232E'] },
  { id: 'palette:matcha', kind: 'palette', title: msg('Matcha shop'), payload: ['#EEF0DC', '#B5C38E', '#6B8E4E', '#3C5A3A', '#2A2620'] },
  { id: 'palette:sunset', kind: 'palette', title: msg('Summer festival'), payload: ['#FFE3B3', '#FFAA5E', '#E8603C', '#8E3B46', '#2E2A3B'] },
  // Grays, so a black and white story gets something too: it is only offered grays.
  { id: 'palette:tones', kind: 'palette', title: msg('Screentone grays'), payload: ['#E6E6E6', '#BFBFBF', '#8C8C8C', '#595959', '#262626'] },
];

/** The home screen draws these frames by id. */
export const FRAME_REWARDS: Reward[] = [
  { id: 'frame:ink', kind: 'cardFrame', title: msg('Ink frame'), payload: ['ink'] },
  { id: 'frame:sakura', kind: 'cardFrame', title: msg('Sakura frame'), payload: ['sakura'] },
  { id: 'frame:gold', kind: 'cardFrame', title: msg('Gold frame'), payload: ['gold'] },
  { id: 'frame:tone', kind: 'cardFrame', title: msg('Screentone frame'), payload: ['tone'] },
];

/** Payloads are preset ids in core/lettering/presets and pose ids in core/art/poses, whose `unlock` is the reward id. */
export const CONTENT_REWARDS: Reward[] = [
  { id: 'sfx:kaboom', kind: 'sfx', title: msg('KABOOM sound effect'), payload: ['sfx-kaboom'] },
  { id: 'sfx:swish', kind: 'sfx', title: msg('SWISH sound effect'), payload: ['sfx-swish'] },
  { id: 'sfx:sparkle', kind: 'sfx', title: msg('SPARKLE sound effect'), payload: ['sfx-sparkle'] },
  { id: 'bubble:flashback', kind: 'bubble', title: msg('Flashback narration box'), payload: ['flashback'] },
  { id: 'pose:victory', kind: 'pose', title: msg('Victory pose'), payload: ['victory'] },
  { id: 'pose:thinking', kind: 'pose', title: msg('Thinking pose'), payload: ['thinking'] },
  { id: 'pose:waving', kind: 'pose', title: msg('Waving pose'), payload: ['waving'] },
];

export const REWARDS: Reward[] = [...PALETTE_REWARDS, ...FRAME_REWARDS, ...CONTENT_REWARDS];

export function rewardById(id: string): Reward | undefined {
  return REWARDS.find(reward => reward.id === id);
}

/** Rewards of one kind the person has won, in catalogue order. */
export function unlockedOf(studio: Pick<StudioState, 'unlocked'>, kind: RewardKind): Reward[] {
  const won = new Set(studio.unlocked);
  return REWARDS.filter(reward => reward.kind === kind && won.has(reward.id));
}

/** Adds a palette's colours to the saved ones, skipping those already there, until the palette is full. */
export function withPalette(saved: unknown, colors: string[]): { list: string[]; added: number } {
  let list = cleanColors(saved, SAVED_COLORS_MAX);
  let added = 0;
  for (const color of colors) {
    const out = addSavedColor(list, color);
    if (out.result === 'added') {
      list = out.list;
      added++;
    }
  }
  return { list, added };
}
