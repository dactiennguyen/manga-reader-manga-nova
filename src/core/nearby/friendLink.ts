/**
 * The mangaka card's QR code: `manganova://friend?d=<data>`, where data is compact JSON in base64url. The phone's
 * own camera opens it, so it must stay short enough for a QR code that scans at arm's length, and anything
 * arriving through it is untrusted: every field is checked and capped, and a bad link is simply refused.
 */
import { z } from 'zod';

import { decodeBase64Url, encodeBase64Url } from './base64url';
import type { RoomAddress } from './types';
import { takeChars } from '../util/format';

export const FRIEND_SCHEME = 'manganova://friend';
export const FRIEND_LIMITS = { name: 40, stories: 3, title: 40, url: 1200, json: 900 } as const;

export type FriendCard = {
  /** A random id made once per phone, so scanning the same friend twice updates them instead of adding a copy. */
  id: string;
  name: string;
  /** A few story titles, newest first. */
  stories: string[];
  /** Set when the card was shown while a room was open: scanning it can also join that room. */
  room?: RoomAddress;
};

const token = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/);
const host = z.string().regex(/^[A-Za-z0-9.:%-]{1,64}$/);

const wire = z.object({
  v: z.literal(1),
  i: z.string().regex(/^[A-Za-z0-9_-]{4,32}$/),
  n: z.string().max(FRIEND_LIMITS.name * 2),
  s: z.array(z.string().max(FRIEND_LIMITS.title * 2)).max(FRIEND_LIMITS.stories).optional(),
  r: z
    .object({ h: host, p: z.number().int().min(1).max(65535), k: token, m: z.string().max(FRIEND_LIMITS.name * 2).optional() })
    .optional(),
});

/** Trims and cuts by characters, not UTF-16 units, so an emoji or kanji is never split in half. */
function clipText(text: string, max: number): string {
  return takeChars(text.replace(/\s+/g, ' ').trim(), max).trim();
}

export function friendLink(card: FriendCard): string {
  const stories = card.stories
    .map(title => clipText(title, FRIEND_LIMITS.title))
    .filter(Boolean)
    .slice(0, FRIEND_LIMITS.stories);
  const data: z.infer<typeof wire> = { v: 1, i: card.id, n: clipText(card.name, FRIEND_LIMITS.name) };
  if (stories.length) {
    data.s = stories;
  }
  if (card.room) {
    const { host: h, port: p, token: k, name } = card.room;
    data.r = name ? { h, p, k, m: clipText(name, FRIEND_LIMITS.name) } : { h, p, k };
  }
  return `${FRIEND_SCHEME}?d=${encodeBase64Url(JSON.stringify(data))}`;
}

/** The value of one query parameter, without URLSearchParams, which React Native only partly implements. */
function queryParam(url: string, key: string): string | null {
  const query = url.slice(url.indexOf('?') + 1).split('#')[0];
  for (const part of query.split('&')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at) === key) {
      return part.slice(at + 1);
    }
  }
  return null;
}

export function isFriendLink(url: string): boolean {
  return url.trim().toLowerCase().startsWith(`${FRIEND_SCHEME}?`);
}

/** The card in a scanned link, or null when the link is not ours, too long, garbled or out of shape. */
export function parseFriendLink(url: string): FriendCard | null {
  const trimmed = url.trim();
  if (trimmed.length > FRIEND_LIMITS.url || !isFriendLink(trimmed)) {
    return null;
  }
  const encoded = queryParam(trimmed, 'd');
  const json = encoded ? decodeBase64Url(encoded) : null;
  if (!json || json.length > FRIEND_LIMITS.json) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = wire.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  const { i, n, s, r } = parsed.data;
  const name = clipText(n, FRIEND_LIMITS.name);
  if (!name) {
    return null;
  }
  const card: FriendCard = {
    id: i,
    name,
    stories: (s ?? []).map(title => clipText(title, FRIEND_LIMITS.title)).filter(Boolean),
  };
  if (r) {
    card.room = { host: r.h, port: r.p, token: r.k };
    const roomName = r.m ? clipText(r.m, FRIEND_LIMITS.name) : '';
    if (roomName) {
      card.room.name = roomName;
    }
  }
  return card;
}
