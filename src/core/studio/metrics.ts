import { HAN, KANA, THAI } from '../lettering/textScript';
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

/** Letters per word, for the scripts written without spaces between words. */
const JAPANESE_PER_WORD = 2;
const CHINESE_PER_WORD = 1.5;
const THAI_PER_WORD = 5;

/**
 * Words in a text. Spaces part the words of Latin scripts and of Korean. Japanese, Chinese and Thai are
 * written without them, so their runs are counted by letters: about two to a Japanese word, one and a
 * half to a Chinese one and five to a Thai one. An estimate, but the same on every device: Hermes has no
 * Intl.Segmenter, and the studio's goals must not move with the engine.
 */
export function wordCount(text: string): number {
  let count = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let cjk = 0;
    let thai = 0;
    let kana = false;
    for (const char of word) {
      if (KANA.test(char)) {
        cjk++;
        kana = true;
      } else if (HAN.test(char)) {
        cjk++;
      } else if (THAI.test(char)) {
        thai++;
      }
    }
    const spaceless = Math.round(cjk / (kana ? JAPANESE_PER_WORD : CHINESE_PER_WORD)) + Math.round(thai / THAI_PER_WORD);
    // Anything else between spaces is one word, as it always was.
    count += Math.max(1, spaceless);
  }
  return count;
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
