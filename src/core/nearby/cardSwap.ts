/**
 * Card swap: a character card leaves the phone as a frozen snapshot (name, role, stats, quote, frame and a small
 * face picture), so the friend's copy never changes when the owner later edits the character. Arriving cards
 * are untrusted and checked field by field before they are kept.
 */
import { z } from 'zod';

import type { Character, CharacterRole, StoryData } from '../model/types';
import { characterCard } from '../studio/cards';
import type { CharacterCard, StudioState } from '../studio/types';
import { decodeBase64Text, encodeBase64Text } from './base64url';

/** A face thumbnail is a small JPEG; anything bigger is refused rather than stored. */
export const FACE_MAX_BASE64 = 200_000;
export const SAVED_CARDS_MAX = 300;

export type CardSnapshot = {
  v: 1;
  /** The owner's phone id plus their character id: a newer copy of the same card replaces the old one. */
  key: string;
  name: string;
  role: CharacterRole;
  story: string;
  stats: CharacterCard['stats'];
  rarity: CharacterCard['rarity'];
  quote: string;
  frame: string;
  /** Pen name of the person who offered it. */
  owner: string;
};

/** What travels in the 'card' blob. */
export type CardPayload = { card: CardSnapshot; face?: string };

/** A friend's card kept on this phone: `face` is then a saved image path, not base64. */
export type SavedCard = CardSnapshot & { face?: string; receivedAt: number };

const text = (max: number) => z.string().max(max);
const stat = z.number().int().min(1).max(99);

const snapshotSchema = z.object({
  v: z.literal(1),
  key: z.string().regex(/^[A-Za-z0-9_:-]{3,80}$/),
  name: text(80),
  role: z.enum(['main', 'support', 'villain', 'extra']),
  story: text(120),
  stats: z.object({ power: stat, wit: stat, charm: stat, heart: stat }),
  rarity: z.enum(['common', 'rare', 'epic', 'legend']),
  quote: text(200),
  frame: z.string().regex(/^[a-z0-9-]{1,24}$/),
  owner: text(80),
});

const payloadSchema = z.object({
  card: snapshotSchema,
  face: z.string().max(FACE_MAX_BASE64).regex(/^[A-Za-z0-9+/=]+$/).optional(),
});

const savedSchema = snapshotSchema.extend({ face: z.string().max(300).optional(), receivedAt: z.number() });

export function cardSnapshot(
  state: StoryData,
  characterId: string,
  studio: Pick<StudioState, 'unlocked'> & Partial<Pick<StudioState, 'cardFrames'>>,
  owner: { id: string; name: string },
): CardSnapshot | null {
  const character = state.characters[characterId];
  if (!character) {
    return null;
  }
  const card = characterCard(state, characterId, studio);
  return {
    v: 1,
    key: `${owner.id}:${characterId}`,
    name: character.name.trim().slice(0, 80),
    role: character.role,
    story: (state.projects[character.projectId]?.title ?? '').trim().slice(0, 120),
    stats: card.stats,
    rarity: card.rarity,
    quote: card.quote.slice(0, 200),
    frame: card.frame,
    owner: owner.name.trim().slice(0, 80),
  };
}

/** Null for anything that is not a well-formed card: wrong JSON, wrong shape, oversized face. */
export function parseCardPayload(json: string): CardPayload | null {
  if (json.length > FACE_MAX_BASE64 + 4000) {
    return null;
  }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? (parsed.data as CardPayload) : null;
  } catch {
    return null;
  }
}

/** The payload as the base64 of a 'card' blob. */
export function cardBlob(payload: CardPayload): string {
  return encodeBase64Text(JSON.stringify(payload));
}

/** Reads a received 'card' blob; null for anything oversized, garbled or out of shape. */
export function readCardBlob(data: string): CardPayload | null {
  if (data.length > Math.ceil(((FACE_MAX_BASE64 + 4000) * 4) / 3) + 4) {
    return null;
  }
  const json = decodeBase64Text(data);
  return json ? parseCardPayload(json) : null;
}

/** Keeps a card, newest first; the same card received again replaces the older copy. */
export function keepCard(list: SavedCard[], card: SavedCard): SavedCard[] {
  return [card, ...list.filter(item => item.key !== card.key)].slice(0, SAVED_CARDS_MAX);
}

export function parseSavedCards(raw: string | null | undefined): SavedCard[] {
  if (!raw) {
    return [];
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.flatMap(item => {
      const parsed = savedSchema.safeParse(item);
      return parsed.success ? [parsed.data as SavedCard] : [];
    });
  } catch {
    return [];
  }
}

/** The card view draws a Character; a friend's card has no real one, so this fills in just what it reads. */
export function snapshotCharacter(card: Pick<SavedCard, 'key' | 'name' | 'role' | 'face'>): Character {
  return {
    id: card.key,
    projectId: '',
    name: card.name,
    role: card.role,
    age: '',
    gender: '',
    traits: [],
    goal: '',
    weakness: '',
    voice: '',
    bio: '',
    notes: '',
    appearance: '',
    sheet: { face: card.face, expressions: {} },
    locked: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function snapshotCard(card: Pick<SavedCard, 'key' | 'stats' | 'rarity' | 'quote' | 'frame'>): CharacterCard {
  return { characterId: card.key, stats: card.stats, rarity: card.rarity, quote: card.quote, frame: card.frame };
}
