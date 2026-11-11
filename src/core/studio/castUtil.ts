/**
 * Helpers shared by the editor, the character messages, the prompts, the reading club and the letters.
 * Templates are English msg() keys with {placeholders}; a template is only used when every placeholder
 * has a value, so a line never reaches the screen half filled.
 */
import { t, tn } from '../i18n';
import { activeProjects, chapterIdsOf, chapterStatus, charactersOf } from '../model/selectors';
import type { Character, ID, Project, StoryData } from '../model/types';
import { DAY_MS, dayKey, dayKeyToDate } from '../util/time';
import { hashString, pick } from './seed';

export type Params = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function seedOf(...parts: (string | number)[]): number {
  return hashString(parts.join('|'));
}

/** The first number in a free-text age, so '16-18' or '16 tuổi' read as 16. Null when there is none. */
export function ageYears(age: string): number | null {
  const number = /\d+/.exec(age);
  return number ? Number(number[0]) : null;
}

export function canFill(template: string, params: Params): boolean {
  for (const match of template.matchAll(PLACEHOLDER)) {
    const value = params[match[1]];
    if (value === undefined || value === '') {
      return false;
    }
  }
  return true;
}

/** One fillable template, chosen by seed and translated. Null when none can be filled. */
export function pickLine(templates: readonly string[], params: Params, seed: number): string | null {
  const usable = templates.filter(template => canFill(template, params));
  return usable.length ? t(pick(usable, seed), params) : null;
}

/** Whole days from the day of `time` to `today`, never negative. */
export function daysSince(time: number, today: string): number {
  const from = dayKeyToDate(dayKey(time)).getTime();
  return Math.max(0, Math.round((dayKeyToDate(today).getTime() - from) / DAY_MS));
}

/** Days since an epoch, so prompts can alternate day by day. */
export function dayNumber(today: string): number {
  return Math.round(dayKeyToDate(today).getTime() / DAY_MS);
}

/** Free text from the person's profile, squeezed to fit a short line. */
export function clip(text: string, max: number): string {
  const flat = text.trim().replace(/\s+/g, ' ').replace(/[.!?。！？]+$/, '');
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function pagesText(count: number): string {
  return tn(count, '{count} page', '{count} pages');
}

export function panelsText(count: number): string {
  return tn(count, '{count} panel', '{count} panels');
}

/** The story the person worked on last. */
export function latestProject(state: StoryData): Project | undefined {
  return activeProjects(state)[0];
}

export function namedCast(state: StoryData, projectId: ID): Character[] {
  return charactersOf(state, projectId).filter(character => character.name.trim());
}

/** The last time anything in a chapter changed: its script, its pages or the chapter itself. */
export function chapterTouchedAt(state: StoryData, chapterId: ID): number {
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return 0;
  }
  let latest = Math.max(chapter.updatedAt, chapter.scriptChangedAt ?? 0, chapter.paginatedAt ?? 0);
  for (const pageId of chapter.pageIds) {
    latest = Math.max(latest, state.pages[pageId]?.updatedAt ?? 0);
  }
  return latest;
}

/** The first chapter not done yet, else the last one. Null for a story without chapters. */
export function currentChapter(state: StoryData, project: Project): { chapterId: ID; number: number } | null {
  const ids = chapterIdsOf(project).filter(id => state.chapters[id]);
  if (!ids.length) {
    return null;
  }
  const open = ids.findIndex(id => chapterStatus(state, id) !== 'done');
  const index = open < 0 ? ids.length - 1 : open;
  return { chapterId: ids[index], number: chapterIdsOf(project).indexOf(ids[index]) + 1 };
}
