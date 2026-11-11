import { EMPTY_ACTIVITY, bestStreak, currentStreak, type Activity } from '../story/activity';
import type { Character, ID, Page, StoryData } from '../model/types';
import { DAY_MS, dayKeyToDate } from '../util/time';
import { EMPTY_STUDIO, type Metrics, type StudioState } from './types';

/** Projects the person can still see. Trashed stories count for nothing in the studio. */
export function liveProjectIds(state: Pick<StoryData, 'projects'>): Set<ID> {
  const ids = new Set<ID>();
  for (const project of Object.values(state.projects)) {
    if (!project.deletedAt) {
      ids.add(project.id);
    }
  }
  return ids;
}

/** Pages of live projects, in no particular order. */
export function livePages(state: Pick<StoryData, 'projects' | 'chapters' | 'pages'>): Page[] {
  const live = liveProjectIds(state);
  return Object.values(state.pages).filter(page => {
    const chapter = state.chapters[page.chapterId];
    return !!chapter && live.has(chapter.projectId);
  });
}

export function pageHasArt(page: Page, hasArt: (panelId: ID) => boolean): boolean {
  return Object.keys(page.panels).some(hasArt);
}

/** Whole days from one day key to another, negative when `to` is earlier. */
export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((dayKeyToDate(to).getTime() - dayKeyToDate(from).getTime()) / DAY_MS);
}

/** A profile filled in enough to write the character well. */
export function characterIsFull(character: Character): boolean {
  return (
    !!character.name.trim() &&
    !!character.role &&
    !!character.appearance.trim() &&
    !!character.goal.trim() &&
    character.traits.filter(trait => trait.trim()).length >= 2
  );
}

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  // Japanese has no spaces, so a long run of it is counted by characters, roughly two to a word.
  return words.reduce((sum, word) => sum + (/[぀-ヿ一-鿿]/.test(word) ? Math.max(1, Math.round(word.length / 2)) : 1), 0);
}

/** Every count the studio rules read, from what the person made and how often they drew. */
export function metricsOf(
  state: StoryData,
  activity: Activity,
  studio: StudioState,
  today: string,
  hasArt: (panelId: ID) => boolean,
): Metrics {
  const live = liveProjectIds(state);
  const projects = Object.values(state.projects).filter(project => live.has(project.id));
  const chapters = Object.values(state.chapters).filter(chapter => live.has(chapter.projectId));

  let chaptersWritten = 0;
  let chaptersDone = 0;
  let scriptWords = 0;
  let dialogueLines = 0;
  for (const chapter of chapters) {
    let blocks = 0;
    for (const sceneId of chapter.sceneIds) {
      for (const block of state.scenes[sceneId]?.blocks ?? []) {
        blocks++;
        scriptWords += wordCount(block.text);
        if (block.type === 'dialogue') {
          dialogueLines++;
        }
      }
    }
    if (blocks > 0) {
      chaptersWritten++;
    }
    const pages = chapter.pageIds.map(id => state.pages[id]).filter(Boolean);
    if (pages.length > 0 && pages.every(page => page.done)) {
      chaptersDone++;
    }
  }

  let pagesDone = 0;
  let panelsDrawn = 0;
  let bubbles = 0;
  let sfx = 0;
  let effects = 0;
  const pages = livePages(state);
  for (const page of pages) {
    if (page.done) {
      pagesDone++;
    }
    panelsDrawn += Object.keys(page.panels).filter(hasArt).length;
    for (const bubble of page.bubbles) {
      if (bubble.type === 'sfx') {
        sfx++;
      } else {
        bubbles++;
      }
    }
    effects += page.effects.length;
  }

  const characters = Object.values(state.characters).filter(character => live.has(character.projectId));
  const streak = currentStreak(activity, today);

  return {
    projects: projects.length,
    projectsDone: projects.filter(project => project.done).length,
    chapters: chapters.length,
    chaptersWritten,
    chaptersDone,
    pages: pages.length,
    pagesDone,
    panelsDrawn,
    bubbles,
    sfx,
    effects,
    characters: characters.length,
    charactersFull: characters.filter(characterIsFull).length,
    relations: Object.values(state.relations).filter(relation => live.has(relation.projectId)).length,
    worldEntries: Object.values(state.world).filter(entry => live.has(entry.projectId)).length,
    scriptWords,
    dialogueLines,
    strokes: activity.total,
    streak,
    // Only 400 days of activity are kept, so the current run is a floor for the best one.
    bestStreak: Math.max(bestStreak(activity), streak),
    activeDays: Object.keys(activity.days).length,
    promptsDone: Object.keys(studio.promptDays).length,
    giftsOpened: studio.giftsOpened.length,
  };
}

export const EMPTY_METRICS: Metrics = metricsOf(
  { projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} },
  EMPTY_ACTIVITY,
  EMPTY_STUDIO,
  '2000-01-01',
  () => false,
);
