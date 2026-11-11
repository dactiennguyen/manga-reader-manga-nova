/**
 * What the sharing activities keep on this phone: friends from mangaka cards, friends' character cards, the
 * notes friends left on the author's chapters, and the stories borrowed for a read-together session. Each is
 * a small JSON value in the meta table, written at once because changes are rare.
 */
import { create } from 'zustand';

import { keepCard, parseSavedCards, type SavedCard } from '../core/nearby/cardSwap';
import { parseFriendLink, type FriendCard } from '../core/nearby/friendLink';
import { addFriend, newMangakaId, parseFriends, removeFriend, type Friend } from '../core/nearby/friends';
import { REVIEW_KEY, addReviewNote, parseReviewNotes, removeReviewNote, type ReviewNote, type ReviewNotes } from '../core/nearby/reviewNotes';
import type { ID } from '../core/model/types';
import type { MetaRepo } from '../core/ports';
import { useStory } from './useStory';

const KEYS = { friends: 'friends', cards: 'friendCards', notes: REVIEW_KEY, id: 'mangakaId', borrowed: 'readBorrowed' } as const;

type ShareState = {
  mangakaId: string;
  friends: Friend[];
  cards: SavedCard[];
  notes: ReviewNotes;
  /** Stories copied in for reading together, deleted when the session ends unless kept. */
  borrowed: ID[];
  /** A friend card opened from a scanned link, waiting for "Add to friends". Not saved. */
  pendingFriend: FriendCard | null;
};

type ShareActions = {
  addFriend: (card: FriendCard) => boolean;
  removeFriend: (id: string) => void;
  keepCard: (card: SavedCard) => void;
  removeCard: (key: string) => void;
  addNote: (note: ReviewNote) => void;
  removeNote: (chapterId: ID, id: string) => void;
  setBorrowed: (ids: ID[]) => void;
  setPendingFriend: (card: FriendCard | null) => void;
};

let repo: MetaRepo | null = null;
/** Deletes a kept card's face picture; wired by boot so this store needs no file access. */
let removeImage: (path: string) => void = () => {};

function save(key: string, value: unknown): void {
  try {
    repo?.set(key, JSON.stringify(value));
  } catch {
    // The value stays in memory; the next change tries again.
  }
}

export const useNearbyShare = create<ShareState & ShareActions>()((set, get) => ({
  mangakaId: '',
  friends: [],
  cards: [],
  notes: {},
  borrowed: [],
  pendingFriend: null,
  addFriend: card => {
    const result = addFriend(get().friends, card, Date.now());
    set({ friends: result.list });
    save(KEYS.friends, result.list);
    return result.added;
  },
  removeFriend: id => {
    const friends = removeFriend(get().friends, id);
    set({ friends });
    save(KEYS.friends, friends);
  },
  keepCard: card => {
    const before = get().cards;
    const cards = keepCard(before, card);
    // A copy replaced by a newer one, or the oldest pushed past the limit, takes its face picture with it.
    const faces = new Set(cards.map(item => item.face));
    before.forEach(item => {
      if (item.face && !faces.has(item.face)) {
        removeImage(item.face);
      }
    });
    set({ cards });
    save(KEYS.cards, cards);
  },
  removeCard: key => {
    const face = get().cards.find(card => card.key === key)?.face;
    if (face) {
      removeImage(face);
    }
    const cards = get().cards.filter(card => card.key !== key);
    set({ cards });
    save(KEYS.cards, cards);
  },
  addNote: note => {
    const notes = addReviewNote(get().notes, note);
    if (notes !== get().notes) {
      set({ notes });
      save(KEYS.notes, notes);
    }
  },
  removeNote: (chapterId, id) => {
    const notes = removeReviewNote(get().notes, chapterId, id);
    set({ notes });
    save(KEYS.notes, notes);
  },
  setBorrowed: ids => {
    set({ borrowed: ids });
    save(KEYS.borrowed, ids);
  },
  setPendingFriend: card => set({ pendingFriend: card }),
}));

function parseIds(raw: string | null): ID[] {
  try {
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter((item): item is ID => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function connectNearbyShare(next: MetaRepo | null, removeFile: (path: string) => void = () => {}): void {
  repo = next;
  removeImage = removeFile;
  let id = next?.get(KEYS.id) ?? '';
  if (!/^[a-z0-9]{12}$/.test(id)) {
    id = newMangakaId();
    next?.set(KEYS.id, id);
  }
  useNearbyShare.setState({
    mangakaId: id,
    friends: parseFriends(next?.get(KEYS.friends)),
    cards: parseSavedCards(next?.get(KEYS.cards)),
    notes: parseReviewNotes(next?.get(KEYS.notes)),
    borrowed: parseIds(next?.get(KEYS.borrowed) ?? null),
    pendingFriend: null,
  });
}

/**
 * For the deep-link handler: keeps the friend card from a scanned `manganova://friend` link so the Mangaka
 * card screen can show it. False when the link is not a valid friend link.
 */
export function receiveFriendLink(url: string): boolean {
  const card = parseFriendLink(url);
  if (card) {
    useNearbyShare.getState().setPendingFriend(card);
  }
  return !!card;
}

/** The mangaka id, made on the spot when the store was never connected (tests, or before boot finished). */
export function mangakaId(): string {
  let id = useNearbyShare.getState().mangakaId;
  if (!id) {
    id = newMangakaId();
    useNearbyShare.setState({ mangakaId: id });
  }
  return id;
}

/** Deletes borrowed read-together copies. Run at start: a session never survives the app closing. */
export function dropBorrowedStories(keep: ID[] = []): void {
  const { borrowed, setBorrowed } = useNearbyShare.getState();
  const story = useStory.getState();
  for (const id of borrowed) {
    if (!keep.includes(id) && story.projects[id]) {
      story.deleteProjectForever(id);
    }
  }
  if (borrowed.length) {
    setBorrowed([]);
  }
}
