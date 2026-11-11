/**
 * Collectible cards of the person's own characters. Stats come from the role, the traits and the age; rarity
 * rises with how complete the profile is, which is a gentle nudge to fill it in.
 */
import { msg, t } from '../i18n';
import { relationsOf } from '../model/selectors';
import type { Character, CharacterRole, StoryData } from '../model/types';
import { ageYears, clip, seedOf, type Params } from './castUtil';
import { unlockedOf } from './rewards';
import { pick, rand } from './seed';
import { traitKinds, type TraitKind } from './traits';
import type { CharacterCard, Rarity, StudioState } from './types';

type Stats = CharacterCard['stats'];

const ROLE_BASE: Record<CharacterRole, Stats> = {
  main: { power: 55, wit: 55, charm: 60, heart: 65 },
  villain: { power: 70, wit: 65, charm: 45, heart: 30 },
  support: { power: 45, wit: 55, charm: 55, heart: 60 },
  extra: { power: 35, wit: 40, charm: 40, heart: 45 },
};

const TRAIT_BIAS: Record<TraitKind, Partial<Stats>> = {
  brave: { power: 12, heart: 6 },
  shy: { charm: -6, heart: 10 },
  funny: { charm: 12, heart: 4 },
  cold: { wit: 8, charm: -4, heart: -8 },
  kind: { heart: 14, charm: 4 },
  smart: { wit: 15 },
  lazy: { power: -8, charm: 6 },
  proud: { power: 8, charm: 6, heart: -6 },
  fiery: { power: 12, wit: -6 },
  loyal: { heart: 12, power: 4 },
  mysterious: { wit: 8, charm: 8 },
  clumsy: { power: -4, charm: 10 },
};

const GOAL_QUOTES = [msg('My goal? {goal}.'), msg('Someday: {goal}. Watch me.'), msg("I won't stop until this happens: {goal}.")];

const ROLE_QUOTES: Record<CharacterRole, string> = {
  main: msg('This is my story. Turn the page.'),
  villain: msg('You came all this way just to lose?'),
  support: msg("I've got your back. Always."),
  extra: msg('Did you see me? Second panel, on the left.'),
};

/** How much of the profile is filled in, 0 to 1. */
export function profileCompleteness(state: StoryData, character: Character): number {
  const filled = (text: string) => (text.trim() ? 1 : 0);
  const parts = [
    filled(character.name),
    filled(character.age),
    filled(character.gender),
    filled(character.appearance),
    filled(character.goal),
    filled(character.weakness),
    filled(character.voice),
    filled(character.bio),
    Math.min(1, character.traits.filter(item => item.trim()).length / 2),
    character.sheet.face || character.sheet.body ? 1 : 0,
    Math.min(1, Object.values(character.sheet.expressions).filter(Boolean).length / 3),
    relationsOf(state, character.id).length ? 1 : 0,
  ];
  return parts.reduce((sum, part) => sum + part, 0) / parts.length;
}

export function rarityOf(completeness: number, role: CharacterRole): Rarity {
  const score = completeness + (role === 'main' ? 0.08 : 0);
  return score >= 0.9 ? 'legend' : score >= 0.7 ? 'epic' : score >= 0.45 ? 'rare' : 'common';
}

function ageBias(age: string): Partial<Stats> {
  const years = ageYears(age);
  if (years === null) {
    return {};
  }
  if (years < 13) {
    return { power: -10, charm: 10, heart: 6 };
  }
  if (years < 20) {
    return { power: 4, charm: 4 };
  }
  if (years >= 60) {
    return { power: -10, wit: 14, heart: 4 };
  }
  return { wit: 4 };
}

function statsOf(character: Character, completeness: number): Stats {
  const stats = { ...ROLE_BASE[character.role] };
  const biases = [...traitKinds(character.traits).map(kind => TRAIT_BIAS[kind]), ageBias(character.age)];
  const wobble = rand(seedOf('card', character.id));
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const bias = biases.reduce((sum, item) => sum + (item[key] ?? 0), 0);
    const value = stats[key] + bias + completeness * 15 + Math.round((wobble() - 0.5) * 10);
    stats[key] = Math.max(1, Math.min(99, Math.round(value)));
  }
  return stats;
}

/** A line in the character's own voice: a quoted line from the voice notes, else their goal, else their role. */
function quoteOf(character: Character): string {
  const quoted = character.voice.match(/["“「『]([^"”」』]{2,90})["”」』]/);
  if (quoted) {
    return quoted[1].trim();
  }
  const params: Params = { goal: clip(character.goal, 60) };
  if (params.goal) {
    return t(pick(GOAL_QUOTES, seedOf('quote', character.id)), params);
  }
  return t(ROLE_QUOTES[character.role]);
}

type CardStudio = Pick<StudioState, 'unlocked'> & Partial<Pick<StudioState, 'cardFrames'>>;

/** The frame chosen for this character if it is still won (or plain), else the frame won most recently, else 'plain'. */
function frameOf(studio: CardStudio, characterId: string): string {
  const frames = unlockedOf(studio, 'cardFrame');
  const chosen = studio.cardFrames?.[characterId];
  if (chosen && (chosen === 'plain' || frames.some(reward => reward.payload[0] === chosen))) {
    return chosen;
  }
  const latest = [...studio.unlocked].reverse().find(id => frames.some(reward => reward.id === id));
  return frames.find(reward => reward.id === latest)?.payload[0] ?? 'plain';
}

export function characterCard(state: StoryData, characterId: string, studio: CardStudio): CharacterCard {
  const character = state.characters[characterId];
  const frame = frameOf(studio, characterId);
  if (!character) {
    return { characterId, stats: { power: 1, wit: 1, charm: 1, heart: 1 }, rarity: 'common', quote: '', frame };
  }
  const completeness = profileCompleteness(state, character);
  return {
    characterId,
    stats: statsOf(character, completeness),
    rarity: rarityOf(completeness, character.role),
    quote: quoteOf(character),
    frame,
  };
}
