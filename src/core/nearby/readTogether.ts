/**
 * Read together: the host turns pages, guests follow, and anyone drops a sticker on a panel. Guests read a
 * copy of the story whose ids were remapped on import, so pages and panels are addressed by position on the
 * wire (page index across the whole story, panel index in layout order); each phone turns that back into its
 * own ids. Everything here is pure, so the follow rules and the mapping are tested without phones.
 */
import { collectPanelIds } from '../layout/layout';
import { chaptersOf } from '../model/selectors';
import type { ID, Page, StoryData } from '../model/types';
import type { Message } from './types';

export const STICKER_IDS = ['love', 'laugh', 'wow', 'fire', 'idea', 'question', 'thumbs', 'star'] as const;
export type StickerId = (typeof STICKER_IDS)[number];
export const NOTE_TEXT_MAX = 80;

export type ReadNote = Extract<Message, { t: 'read.note' }>;

export type StoryPage = { chapterId: ID; pageId: ID; indexInChapter: number };

/** Every page of the story in reading order, the same order on every phone holding a copy. */
export function storyPages(state: Pick<StoryData, 'projects' | 'chapters' | 'pages'>, projectId: ID): StoryPage[] {
  return chaptersOf(state as StoryData, projectId).flatMap(chapter =>
    chapter.pageIds
      .filter(id => !!state.pages[id])
      .map((pageId, indexInChapter) => ({ chapterId: chapter.id, pageId, indexInChapter })),
  );
}

export function storyIndexOf(pages: StoryPage[], pageId: ID | undefined): number {
  return pageId ? pages.findIndex(page => page.pageId === pageId) : -1;
}

/** Panels in layout order, which survives the id remap; panels outside the layout come last. */
export function panelIdsOf(page: Pick<Page, 'layout' | 'panels'>): ID[] {
  const inLayout = collectPanelIds(page.layout);
  const rest = Object.keys(page.panels ?? {}).filter(id => !inLayout.includes(id));
  return [...inLayout, ...rest];
}

export function isSticker(value: string): value is StickerId {
  return (STICKER_IDS as readonly string[]).includes(value);
}

export function cleanNoteText(text: string): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.slice(0, NOTE_TEXT_MAX).join('').trim();
}

const unit = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5);

/** A note from this phone, carrying both its own ids and the positions every other phone can resolve. */
export function buildNote(
  state: Pick<StoryData, 'projects' | 'chapters' | 'pages'>,
  pages: StoryPage[],
  input: { id: string; from: string; pageId: ID; panelId: ID | null; x: number; y: number; sticker: StickerId; text: string },
): ReadNote | null {
  const pageIndex = storyIndexOf(pages, input.pageId);
  const page = state.pages[input.pageId];
  if (pageIndex < 0 || !page) {
    return null;
  }
  const panelIndex = input.panelId ? panelIdsOf(page).indexOf(input.panelId) : -1;
  return {
    t: 'read.note',
    id: input.id,
    from: input.from,
    pageId: input.pageId,
    panelId: panelIndex >= 0 ? input.panelId : null,
    pageIndex,
    ...(panelIndex >= 0 ? { panelIndex } : {}),
    x: unit(input.x),
    y: unit(input.y),
    sticker: input.sticker,
    text: cleanNoteText(input.text),
  };
}

export type ResolvedNote = {
  id: string;
  from: string;
  chapterId: ID;
  pageId: ID;
  panelId: ID | null;
  x: number;
  y: number;
  sticker: StickerId;
  text: string;
};

/** Turns a note from any phone into this phone's ids, or null when it points nowhere or is out of shape. */
export function resolveNote(state: Pick<StoryData, 'pages'>, pages: StoryPage[], note: ReadNote): ResolvedNote | null {
  if (!isSticker(note.sticker)) {
    return null;
  }
  // A position wins: the ids in a note are the sender's own, which only match on the phone that sent it.
  const target = note.pageIndex !== undefined ? pages[note.pageIndex] : pages.find(page => page.pageId === note.pageId);
  const page = target ? state.pages[target.pageId] : undefined;
  if (!target || !page) {
    return null;
  }
  const panels = panelIdsOf(page);
  const panelId =
    note.panelIndex !== undefined
      ? panels[note.panelIndex] ?? null
      : note.panelId && panels.includes(note.panelId)
        ? note.panelId
        : null;
  return {
    id: note.id ?? `${note.from}:${note.pageIndex ?? note.pageId}:${note.x}:${note.y}`,
    from: note.from,
    chapterId: target.chapterId,
    pageId: target.pageId,
    panelId,
    x: unit(note.x),
    y: unit(note.y),
    sticker: note.sticker,
    text: cleanNoteText(note.text),
  };
}

// Following the host

/** How long a jump made for following may take to land before a page change counts as the reader's own. */
export const JUMP_SETTLE_MS = 1500;

export type FollowState = {
  following: boolean;
  /** The page the host is on, as a story index. */
  hostPage: number | null;
  /** A jump this phone made to follow, so its own page change is not mistaken for the reader leaving. */
  pending: { page: number; at: number } | null;
};

export const INITIAL_FOLLOW: FollowState = { following: true, hostPage: null, pending: null };

export type FollowStep = { state: FollowState; jumpTo: number | null };

/** The host turned a page. A following reader is taken there. */
export function onHostPage(state: FollowState, page: number, now: number): FollowStep {
  if (!state.following) {
    return { state: { ...state, hostPage: page }, jumpTo: null };
  }
  return { state: { following: true, hostPage: page, pending: { page, at: now } }, jumpTo: page };
}

/** The reader's own page changed. Turning away from the host by hand stops following. */
export function onLocalPage(state: FollowState, page: number, now: number): FollowState {
  if (state.pending) {
    if (page === state.pending.page) {
      return { ...state, pending: null };
    }
    if (now - state.pending.at < JUMP_SETTLE_MS) {
      return state;
    }
  }
  const pending = null;
  if (state.following && state.hostPage !== null && page !== state.hostPage) {
    return { following: false, hostPage: state.hostPage, pending };
  }
  return { ...state, pending };
}

/** The follow toggle. Turning it on jumps to where the host is now. */
export function setFollowing(state: FollowState, on: boolean, now: number): FollowStep {
  if (!on) {
    return { state: { ...state, following: false, pending: null }, jumpTo: null };
  }
  const jumpTo = state.hostPage;
  return { state: { following: true, hostPage: jumpTo, pending: jumpTo === null ? null : { page: jumpTo, at: now } }, jumpTo };
}
