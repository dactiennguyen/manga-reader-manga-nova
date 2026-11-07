import { chapterName } from '../model/selectors';
import type { ID } from '../model/types';

export function matchChapter(title: string, chapters: { id: ID; title: string }[]): ID | undefined {
  const needle = title.trim().toLowerCase();
  if (!needle) {
    return undefined;
  }
  const byTitle = chapters.find(chapter => chapter.title.trim().toLowerCase() === needle);
  if (byTitle) {
    return byTitle.id;
  }
  return chapters.find((chapter, index) => chapterName(chapter.title, index + 1).toLowerCase() === needle)?.id;
}

export const BODY_MAX = 4000;

export function appendBody(existing: string, text: string): string {
  const base = existing.trimEnd();
  return (base ? `${base}\n\n${text.trim()}` : text.trim()).slice(0, BODY_MAX);
}
