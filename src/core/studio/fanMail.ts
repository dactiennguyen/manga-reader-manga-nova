/**
 * Letters from the Manganova reading club, newest first. Each one answers something the person really did:
 * a first finished page, a finished chapter, a streak, a new journey level, a first character, a finished
 * story. Ids name the event, so a letter exists once and keeps its read state.
 */
import { t } from '../i18n';
import { activeProjects, chapterIdsOf, chapterStatus } from '../model/selectors';
import type { ID, StoryData } from '../model/types';
import { DAY_MS } from '../util/time';
import { canFill, chapterTouchedAt, namedCast, pagesText, seedOf, type Params } from './castUtil';
import { READERS } from './cast';
import { LEVELS, levelIndexOf } from './journey';
import {
  CHAPTER_LETTERS,
  FIRST_CHARACTER_LETTERS,
  FIRST_PAGE_LETTERS,
  LEVEL_LETTERS,
  STORY_DONE_LETTERS,
  STREAK_30_LETTERS,
  STREAK_7_LETTERS,
  type LetterLine,
} from './letterLines';
import { chapterReview } from './readers';
import { pick } from './seed';
import type { ChapterReview, Letter, Metrics, StudioState } from './types';

function write(id: string, line: LetterLine, params: Params, at: number, chapterId?: ID): Letter {
  return { id, fromId: line.from, subject: t(line.subject, params), body: t(line.body, params), chapterId, at };
}

function fillable(lines: LetterLine[], params: Params): LetterLine[] {
  return lines.filter(line => canFill(line.subject, params) && canFill(line.body, params));
}

/**
 * Where the club's votes come from: `hasArt` so a drawn chapter is read as drawn, the same as in the club,
 * and `reviews` when they are already worked out (from clubReviews), so they are not worked out again.
 */
export type LetterSources = { hasArt?: (panelId: ID) => boolean; reviews?: ReadonlyMap<ID, ChapterReview> };

/** Club members ordered by how much they liked the chapter, so the biggest fan writes. */
function fansOf(state: StoryData, chapterId: ID, sources: LetterSources): string[] {
  const review = sources.reviews ? (sources.reviews.get(chapterId) ?? null) : chapterReview(state, chapterId, sources.hasArt);
  const order = READERS.map(reader => reader.id as string);
  if (!review) {
    return order;
  }
  return [...review.votes]
    .sort((a, b) => b.score - a.score || order.indexOf(a.readerId) - order.indexOf(b.readerId))
    .map(vote => vote.readerId);
}

function chapterLetters(state: StoryData, sources: LetterSources): Letter[] {
  const letters: Letter[] = [];
  for (const project of activeProjects(state)) {
    const main = namedCast(state, project.id)[0]?.name.trim() ?? '';
    chapterIdsOf(project).forEach((chapterId, index) => {
      const chapter = state.chapters[chapterId];
      if (!chapter || chapterStatus(state, chapterId) !== 'done') {
        return;
      }
      const inChapter = chapter.characterIds.map(id => state.characters[id]?.name.trim()).find(Boolean);
      const params: Params = {
        n: index + 1,
        story: project.title.trim(),
        name: inChapter ?? main,
        pages: pagesText(chapter.pageIds.length),
      };
      const lines = fillable(CHAPTER_LETTERS, params);
      const fan = fansOf(state, chapterId, sources).find(id => lines.some(line => line.from === id));
      const line = lines.find(item => item.from === fan);
      if (line) {
        letters.push(write(`chapter-${chapterId}`, line, params, chapterTouchedAt(state, chapterId), chapterId));
      }
    });
  }
  return letters;
}

function firstPageLetter(state: StoryData): Letter | null {
  let first: { at: number; pageId: ID; story: string } | null = null;
  for (const project of activeProjects(state)) {
    for (const chapterId of chapterIdsOf(project)) {
      for (const pageId of state.chapters[chapterId]?.pageIds ?? []) {
        const page = state.pages[pageId];
        if (page?.done && (!first || page.updatedAt < first.at)) {
          first = { at: page.updatedAt, pageId, story: project.title.trim() };
        }
      }
    }
  }
  if (!first) {
    return null;
  }
  const params: Params = { story: first.story };
  return write('first-page', pick(fillable(FIRST_PAGE_LETTERS, params), seedOf('first-page', first.pageId)), params, first.at);
}

function firstCharacterLetter(state: StoryData): Letter | null {
  const live = new Set(activeProjects(state).map(project => project.id));
  const first = Object.values(state.characters)
    .filter(character => live.has(character.projectId) && character.name.trim())
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!first) {
    return null;
  }
  const params: Params = { name: first.name.trim(), story: state.projects[first.projectId]?.title.trim() ?? '' };
  const line = pick(fillable(FIRST_CHARACTER_LETTERS, params), seedOf('first-character', first.id));
  return write('first-character', line, params, first.createdAt);
}

/**
 * Streaks and levels leave no date in the stories, so their letters get one that cannot move: days after
 * the first story was made, never later than the last change. The same letter always shows the same date.
 */
function milestoneAt(state: StoryData, days: number): number {
  const projects = activeProjects(state);
  const first = Math.min(...projects.map(project => project.createdAt));
  const last = Math.max(...projects.map(project => project.updatedAt));
  return Math.min(last, first + days * DAY_MS);
}

export function lettersOf(
  state: StoryData,
  m: Metrics,
  _studio: StudioState,
  levelIndex?: number,
  sources: LetterSources = {},
): Letter[] {
  if (!activeProjects(state).length) {
    return [];
  }
  const letters: Letter[] = [...chapterLetters(state, sources)];
  const firstPage = firstPageLetter(state);
  const firstCharacter = firstCharacterLetter(state);
  for (const letter of [firstPage, firstCharacter]) {
    if (letter) {
      letters.push(letter);
    }
  }
  if (m.bestStreak >= 7) {
    letters.push(write('streak-7', pick(STREAK_7_LETTERS, seedOf('streak-7')), {}, milestoneAt(state, 7)));
  }
  if (m.bestStreak >= 30) {
    letters.push(write('streak-30', pick(STREAK_30_LETTERS, seedOf('streak-30')), {}, milestoneAt(state, 30)));
  }
  const reached = Math.min(levelIndex ?? levelIndexOf(m), LEVELS.length - 1);
  for (let index = 1; index <= reached; index++) {
    const level = LEVELS[index];
    const line = LEVEL_LETTERS[(index - 1) % LEVEL_LETTERS.length];
    letters.push(write(`level-${level.id}`, line, { level: t(level.title) }, milestoneAt(state, index * 3)));
  }
  for (const project of activeProjects(state).filter(item => item.done)) {
    const params: Params = { story: project.title.trim() };
    const lines = fillable(STORY_DONE_LETTERS, params);
    if (lines.length) {
      letters.push(write(`done-${project.id}`, pick(lines, seedOf('done', project.id)), params, project.updatedAt));
    }
  }
  return letters.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
}
