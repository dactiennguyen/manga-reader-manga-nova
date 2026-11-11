/**
 * Notes friends left on a chapter while reading it together, kept on the author's phone as a review list.
 * Stored in the meta table under `reviewNotes` as { chapterId: ReviewNote[] }.
 */
import { z } from 'zod';

import type { ID } from '../model/types';
import { NOTE_TEXT_MAX, STICKER_IDS, type StickerId } from './readTogether';

export const REVIEW_KEY = 'reviewNotes';
export const NOTES_PER_CHAPTER = 300;

export type ReviewNote = {
  id: string;
  chapterId: ID;
  pageId: ID;
  panelId: ID | null;
  /** Where on the page, 0 to 1 across and down. */
  x: number;
  y: number;
  sticker: StickerId;
  text: string;
  /** The friend's name as it was in the room. */
  from: string;
  at: number;
};

export type ReviewNotes = Record<ID, ReviewNote[]>;

const unit = z.number().min(0).max(1);

const noteSchema = z.object({
  id: z.string().min(1).max(64),
  chapterId: z.string().min(1),
  pageId: z.string().min(1),
  panelId: z.string().min(1).nullable(),
  x: unit,
  y: unit,
  sticker: z.enum(STICKER_IDS),
  text: z.string().max(NOTE_TEXT_MAX * 2),
  from: z.string().max(80),
  at: z.number(),
});

/** Adds a note once (by id), oldest first, dropping the oldest beyond the cap. */
export function addReviewNote(notes: ReviewNotes, note: ReviewNote): ReviewNotes {
  const list = notes[note.chapterId] ?? [];
  if (list.some(item => item.id === note.id)) {
    return notes;
  }
  return { ...notes, [note.chapterId]: [...list, note].slice(-NOTES_PER_CHAPTER) };
}

export function removeReviewNote(notes: ReviewNotes, chapterId: ID, id: string): ReviewNotes {
  const list = notes[chapterId];
  if (!list) {
    return notes;
  }
  const next = list.filter(item => item.id !== id);
  if (next.length) {
    return { ...notes, [chapterId]: next };
  }
  const rest = { ...notes };
  delete rest[chapterId];
  return rest;
}

export function clearChapterNotes(notes: ReviewNotes, chapterId: ID): ReviewNotes {
  const rest = { ...notes };
  delete rest[chapterId];
  return rest;
}

/** A chapter's notes in reading order: by page, then top to bottom, so the list walks the chapter. */
export function notesInOrder(notes: ReviewNotes, chapterId: ID, pageIds: ID[]): ReviewNote[] {
  const at = new Map(pageIds.map((id, index) => [id, index]));
  return [...(notes[chapterId] ?? [])].sort(
    (a, b) => (at.get(a.pageId) ?? Infinity) - (at.get(b.pageId) ?? Infinity) || a.y - b.y || a.at - b.at,
  );
}

export function parseReviewNotes(raw: string | null | undefined): ReviewNotes {
  if (!raw) {
    return {};
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {};
    }
    const out: ReviewNotes = {};
    for (const [chapterId, list] of Object.entries(data)) {
      if (chapterId === '__proto__' || !Array.isArray(list)) {
        continue;
      }
      const notes = list.flatMap(item => {
        const parsed = noteSchema.safeParse(item);
        return parsed.success && parsed.data.chapterId === chapterId ? [parsed.data as ReviewNote] : [];
      });
      if (notes.length) {
        out[chapterId] = notes;
      }
    }
    return out;
  } catch {
    return {};
  }
}
