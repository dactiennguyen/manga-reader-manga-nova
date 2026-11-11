/**
 * Friends added from mangaka cards. Only what the card showed is kept; the room address is left out because a
 * room only lives while its host has it open.
 */
import { z } from 'zod';

import { FRIEND_LIMITS, type FriendCard } from './friendLink';

export const FRIENDS_MAX = 500;

export type Friend = Omit<FriendCard, 'room'> & { addedAt: number };

const friendSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{4,32}$/),
  name: z.string().min(1).max(FRIEND_LIMITS.name * 2),
  stories: z.array(z.string().max(FRIEND_LIMITS.title * 2)).max(FRIEND_LIMITS.stories),
  addedAt: z.number(),
});

/** Adds or refreshes a friend, newest first. `added` is false when they were already on the list. */
export function addFriend(list: Friend[], card: FriendCard, now: number): { list: Friend[]; added: boolean } {
  const known = list.some(friend => friend.id === card.id);
  const friend: Friend = { id: card.id, name: card.name, stories: card.stories, addedAt: now };
  return { list: [friend, ...list.filter(item => item.id !== card.id)].slice(0, FRIENDS_MAX), added: !known };
}

export function removeFriend(list: Friend[], id: string): Friend[] {
  return list.filter(friend => friend.id !== id);
}

export function parseFriends(raw: string | null | undefined): Friend[] {
  if (!raw) {
    return [];
  }
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data)
      ? data.flatMap(item => {
          const parsed = friendSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
}

/** A short random id for this phone's mangaka card, made once and kept. */
export function newMangakaId(random: () => number = Math.random): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(random() * chars.length)]).join('');
}
