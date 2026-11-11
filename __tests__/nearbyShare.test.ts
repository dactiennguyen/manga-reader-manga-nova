import { decodeBase64Url, encodeBase64Url } from '../src/core/nearby/base64url';
import { cardBlob, cardSnapshot, keepCard, readCardBlob, parseCardPayload, parseSavedCards, snapshotCharacter, type SavedCard } from '../src/core/nearby/cardSwap';
import { FRIEND_LIMITS, friendLink, parseFriendLink, type FriendCard } from '../src/core/nearby/friendLink';
import { addFriend, parseFriends } from '../src/core/nearby/friends';
import {
  INITIAL_FOLLOW,
  JUMP_SETTLE_MS,
  buildNote,
  onHostPage,
  onLocalPage,
  panelIdsOf,
  resolveNote,
  setFollowing,
  storyIndexOf,
  storyPages,
} from '../src/core/nearby/readTogether';
import { NOTES_PER_CHAPTER, addReviewNote, notesInOrder, parseReviewNotes, removeReviewNote, type ReviewNote } from '../src/core/nearby/reviewNotes';
import { remapBundleIds, buildProjectBundle } from '../src/core/archive/bundle';
import type { StoryData } from '../src/core/model/types';
import { EMPTY_STUDIO } from '../src/core/studio/types';
import { addChapter, addPage, addProject, emptyStory, sampleStory } from './helpers/studioStory';

describe('base64url', () => {
  it('round-trips text in any script', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'Mai Nguyễn', '漫画家さくら', '🖋️ ink', '{"v":1}']) {
      expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
    }
  });

  it('refuses characters outside the alphabet and broken UTF-8', () => {
    expect(decodeBase64Url('ab$d')).toBeNull();
    expect(decodeBase64Url('a')).toBeNull();
    expect(decodeBase64Url('_w')).toBeNull(); // 0xFF is never valid UTF-8
    expect(decodeBase64Url('wK8')).toBeNull(); // C0 AF, an overlong '/'
    expect(decodeBase64Url('7aCA')).toBeNull(); // ED A0 80, a surrogate
  });
});

describe('friend link', () => {
  const card: FriendCard = {
    id: 'abc123def456',
    name: 'Sakura 桜',
    stories: ['Ink & Steel', 'Tôi là mèo', '空の手紙'],
    room: { host: '192.168.1.20', port: 40123, token: 'beef', name: 'Club night' },
  };

  it('round-trips a full card', () => {
    const link = friendLink(card);
    expect(link.startsWith('manganova://friend?d=')).toBe(true);
    expect(parseFriendLink(link)).toEqual(card);
  });

  it('round-trips a card with no stories or room', () => {
    const plain = { id: 'abcd', name: 'Ken', stories: [] };
    expect(parseFriendLink(friendLink(plain))).toEqual(plain);
  });

  it('stays short enough for a QR code and caps long fields', () => {
    const long: FriendCard = {
      id: 'abc123def456',
      name: 'N'.repeat(200),
      stories: Array.from({ length: 10 }, (_, i) => `${i} ${'T'.repeat(200)}`),
      room: card.room,
    };
    const link = friendLink(long);
    expect(link.length).toBeLessThan(FRIEND_LIMITS.url);
    const parsed = parseFriendLink(link)!;
    expect([...parsed.name]).toHaveLength(FRIEND_LIMITS.name);
    expect(parsed.stories).toHaveLength(FRIEND_LIMITS.stories);
  });

  it('refuses other links, garbled data and wrong shapes', () => {
    const wrap = (json: string) => `manganova://friend?d=${encodeBase64Url(json)}`;
    expect(parseFriendLink('https://example.com/friend?d=abc')).toBeNull();
    expect(parseFriendLink('manganova://join?h=1.2.3.4&p=1&k=abcd')).toBeNull();
    expect(parseFriendLink('manganova://friend?d=%%%')).toBeNull();
    expect(parseFriendLink('manganova://friend')).toBeNull();
    expect(parseFriendLink(wrap('not json'))).toBeNull();
    expect(parseFriendLink(wrap('{"v":2,"i":"abcd","n":"x"}'))).toBeNull();
    expect(parseFriendLink(wrap('{"v":1,"i":"ab","n":"x"}'))).toBeNull();
    expect(parseFriendLink(wrap('{"v":1,"i":"abcd","n":"   "}'))).toBeNull();
    expect(parseFriendLink(wrap('{"v":1,"i":"abcd","n":"x","r":{"h":"1.2.3.4","p":0,"k":"abcd"}}'))).toBeNull();
    expect(parseFriendLink(wrap('{"v":1,"i":"abcd","n":"x","r":{"h":"<script>","p":80,"k":"abcd"}}'))).toBeNull();
  });

  it('refuses oversized links', () => {
    expect(parseFriendLink(`manganova://friend?d=${'A'.repeat(FRIEND_LIMITS.url)}`)).toBeNull();
    const big = JSON.stringify({ v: 1, i: 'abcd', n: 'x', s: ['y'.repeat(70), 'y'.repeat(70), 'y'.repeat(70)], pad: 'z'.repeat(800) });
    expect(parseFriendLink(`manganova://friend?d=${encodeBase64Url(big)}`)).toBeNull();
  });

  it('keeps one entry per friend and leaves the room out', () => {
    const first = addFriend([], card, 1);
    expect(first.added).toBe(true);
    const again = addFriend(first.list, { ...card, name: 'Sakura' }, 2);
    expect(again.added).toBe(false);
    expect(again.list).toEqual([{ id: card.id, name: 'Sakura', stories: card.stories, addedAt: 2 }]);
    expect(parseFriends(JSON.stringify([...again.list, { id: 'x' }, 'junk']))).toEqual(again.list);
    expect(parseFriends('{oops')).toEqual([]);
  });
});

describe('card swap', () => {
  const state = sampleStory();
  const owner = { id: 'phone1', name: 'Mai' };

  it('snapshots a character card with its story and owner', () => {
    const snapshot = cardSnapshot(state, 'aki', EMPTY_STUDIO, owner)!;
    expect(snapshot).toMatchObject({ v: 1, key: 'phone1:aki', role: 'main', owner: 'Mai', frame: 'plain' });
    expect(snapshot.name).toBe(state.characters.aki.name);
    expect(snapshot.story).toBe(state.projects.p1.title);
    expect(snapshot.stats.power).toBeGreaterThanOrEqual(1);
    expect(cardSnapshot(state, 'nobody', EMPTY_STUDIO, owner)).toBeNull();
  });

  it('accepts a valid payload and refuses bad ones', () => {
    const card = cardSnapshot(state, 'kuro', EMPTY_STUDIO, owner)!;
    expect(parseCardPayload(JSON.stringify({ card, face: 'aGVsbG8=' }))).toEqual({ card, face: 'aGVsbG8=' });
    expect(parseCardPayload('nope')).toBeNull();
    expect(parseCardPayload(JSON.stringify({ card: { ...card, rarity: 'mythic' } }))).toBeNull();
    expect(parseCardPayload(JSON.stringify({ card: { ...card, stats: { ...card.stats, wit: 500 } } }))).toBeNull();
    expect(parseCardPayload(JSON.stringify({ card, face: 'not base64!' }))).toBeNull();
    expect(parseCardPayload(JSON.stringify({ card, face: 'A'.repeat(300_000) }))).toBeNull();
  });

  it('keeps the newest copy of a card and reads the saved list back', () => {
    const card = cardSnapshot(state, 'hina', EMPTY_STUDIO, owner)!;
    const first: SavedCard = { ...card, receivedAt: 1 };
    const second: SavedCard = { ...card, quote: 'new', receivedAt: 2, face: 'images/a.jpg' };
    const list = keepCard(keepCard([], first), second);
    expect(list).toEqual([second]);
    expect(parseSavedCards(JSON.stringify([...list, { key: 'bad' }]))).toEqual(list);
    const character = snapshotCharacter(second);
    expect(character).toMatchObject({ name: card.name, role: 'support', sheet: { face: 'images/a.jpg' } });
  });
});

function twoPanelStory(): StoryData {
  const state = emptyStory();
  addProject(state, 'p', 'Story');
  addChapter(state, 'p', 'c1');
  addChapter(state, 'p', 'c2');
  const layout = { kind: 'split', id: 's', dir: 'h', t0: 0.5, t1: 0.5, a: { kind: 'panel', id: 'a' }, b: { kind: 'panel', id: 'b' } } as const;
  const panels = { a: { id: 'a', blockIds: [] }, b: { id: 'b', blockIds: [] } } as never;
  addPage(state, 'c1', 'p1', { layout, panels });
  addPage(state, 'c1', 'p2');
  addPage(state, 'c2', 'p3', { layout: { ...layout, a: { kind: 'panel', id: 'x' }, b: { kind: 'panel', id: 'y' } }, panels: { x: { id: 'x' }, y: { id: 'y' } } as never });
  return state;
}

describe('read together', () => {
  it('numbers pages across chapters', () => {
    const state = twoPanelStory();
    const pages = storyPages(state, 'p');
    expect(pages.map(page => page.pageId)).toEqual(['p1', 'p2', 'p3']);
    expect(pages[2]).toEqual({ chapterId: 'c2', pageId: 'p3', indexInChapter: 0 });
    expect(storyIndexOf(pages, 'p3')).toBe(2);
    expect(panelIdsOf(state.pages.p1)).toEqual(['a', 'b']);
  });

  it('carries a note to a copy whose ids were remapped', () => {
    const host = twoPanelStory();
    const bundle = remapBundleIds(buildProjectBundle(host, 'p', () => ({}))!);
    const guest = emptyStory();
    guest.projects[bundle.project.id] = bundle.project;
    bundle.chapters.forEach(chapter => (guest.chapters[chapter.id] = chapter));
    bundle.pages.forEach(page => (guest.pages[page.id] = page));
    const guestPages = storyPages(guest, bundle.project.id);
    const guestPage = guest.pages[guestPages[2].pageId];
    const note = buildNote(guest, guestPages, {
      id: 'n1',
      from: 'g1',
      pageId: guestPage.id,
      panelId: panelIdsOf(guestPage)[1],
      x: 0.4,
      y: 2,
      sticker: 'love',
      text: '  so   good  ',
    })!;
    expect(note).toMatchObject({ pageIndex: 2, panelIndex: 1, y: 1, text: 'so good' });
    const resolved = resolveNote(host, storyPages(host, 'p'), note)!;
    expect(resolved).toMatchObject({ chapterId: 'c2', pageId: 'p3', panelId: 'y', sticker: 'love', id: 'n1' });
  });

  it('drops notes with an unknown sticker or page', () => {
    const state = twoPanelStory();
    const pages = storyPages(state, 'p');
    const base = { t: 'read.note' as const, from: 'g', pageId: 'p1', panelId: null, x: 0.5, y: 0.5, sticker: 'love', text: '' };
    expect(resolveNote(state, pages, { ...base, sticker: 'bomb' })).toBeNull();
    expect(resolveNote(state, pages, { ...base, pageId: 'nope' })).toBeNull();
    expect(resolveNote(state, pages, { ...base, pageIndex: 9 })).toBeNull();
    expect(resolveNote(state, pages, base)).toMatchObject({ pageId: 'p1', panelId: null });
  });

  it('follows the host until the reader turns away by hand', () => {
    let state = INITIAL_FOLLOW;
    let step = onHostPage(state, 3, 0);
    expect(step.jumpTo).toBe(3);
    state = step.state;
    // Pages passed while the jump scrolls do not count as the reader leaving.
    state = onLocalPage(state, 2, 100);
    expect(state.following).toBe(true);
    state = onLocalPage(state, 3, 200);
    expect(state.pending).toBeNull();
    // Now the reader flips back by hand.
    state = onLocalPage(state, 2, 300);
    expect(state.following).toBe(false);
    step = onHostPage(state, 4, 400);
    expect(step.jumpTo).toBeNull();
    expect(step.state.hostPage).toBe(4);
    step = setFollowing(step.state, true, 500);
    expect(step.jumpTo).toBe(4);
    expect(step.state.following).toBe(true);
  });

  it('stops waiting for a jump that never lands', () => {
    let state = onHostPage(INITIAL_FOLLOW, 5, 0).state;
    state = onLocalPage(state, 1, JUMP_SETTLE_MS + 1);
    expect(state.following).toBe(false);
  });

  it('turning follow off never jumps', () => {
    const step = setFollowing(onHostPage(INITIAL_FOLLOW, 2, 0).state, false, 1);
    expect(step).toEqual({ state: { following: false, hostPage: 2, pending: null }, jumpTo: null });
  });
});

describe('review notes', () => {
  const note = (id: string, pageId: string, y: number, at = 0): ReviewNote => ({
    id,
    chapterId: 'c1',
    pageId,
    panelId: null,
    x: 0.5,
    y,
    sticker: 'star',
    text: id,
    from: 'Ken',
    at,
  });

  it('adds each note once, in reading order, and removes them', () => {
    let notes = addReviewNote({}, note('b', 'p2', 0.1));
    notes = addReviewNote(notes, note('a', 'p1', 0.9));
    notes = addReviewNote(notes, note('c', 'p1', 0.2));
    expect(addReviewNote(notes, note('a', 'p1', 0.9))).toBe(notes);
    expect(notesInOrder(notes, 'c1', ['p1', 'p2']).map(item => item.id)).toEqual(['c', 'a', 'b']);
    notes = removeReviewNote(notes, 'c1', 'a');
    expect(notes.c1.map(item => item.id)).toEqual(['b', 'c']);
    expect(removeReviewNote(removeReviewNote(notes, 'c1', 'b'), 'c1', 'c')).toEqual({});
  });

  it('caps a chapter and survives a save and load, dropping bad rows', () => {
    let notes = {};
    for (let i = 0; i < NOTES_PER_CHAPTER + 5; i++) {
      notes = addReviewNote(notes, note(`n${i}`, 'p1', 0.5, i));
    }
    const loaded = parseReviewNotes(JSON.stringify(notes));
    expect(loaded.c1).toHaveLength(NOTES_PER_CHAPTER);
    expect(loaded.c1[0].id).toBe('n5');
    const broken = JSON.stringify({ c1: [note('ok', 'p1', 0.5), { ...note('bad', 'p1', 0.5), sticker: 'bomb' }], c2: [note('wrong', 'p1', 0.5)] });
    expect(Object.keys(parseReviewNotes(broken))).toEqual(['c1']);
    expect(parseReviewNotes(broken).c1.map(item => item.id)).toEqual(['ok']);
    expect(parseReviewNotes('[]')).toEqual({});
  });
});

describe('card blob', () => {
  it('round-trips through base64 and refuses junk', () => {
    const card = cardSnapshot(sampleStory(), 'aki', EMPTY_STUDIO, { id: 'phone1', name: 'Mai 桜' })!;
    const blob = cardBlob({ card, face: 'aGVsbG8=' });
    expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(readCardBlob(blob)).toEqual({ card, face: 'aGVsbG8=' });
    expect(readCardBlob('!!!')).toBeNull();
    expect(readCardBlob('A'.repeat(400_000))).toBeNull();
  });
});
