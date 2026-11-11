import { inEveryLanguage, msg } from '../i18n';
import { activeProjects, chaptersOf, pageStatus } from '../model/selectors';
import type { ID, Page, StoryData } from '../model/types';

export const QUICK_START_TITLE = msg('Untitled story');

let quickStartTitles: Set<string> | null = null;

/**
 * The quick start is named in the interface language, so it may have been made in any of them. The names
 * are read from the language files once, the first time they are needed.
 */
export function isQuickStartTitle(title: string): boolean {
  quickStartTitles ??= new Set(inEveryLanguage(QUICK_START_TITLE));
  return quickStartTitles.has(title);
}

/** A quick start nobody touched yet, so repeat taps reuse it instead of filling the library. */
export function unusedQuickStart(state: StoryData, hasArt: (panelId: ID) => boolean): Page | undefined {
  for (const project of activeProjects(state)) {
    const chapters = chaptersOf(state, project.id);
    const [chapter] = chapters;
    if (!isQuickStartTitle(project.title) || project.logline || chapters.length !== 1 || !chapter) {
      continue;
    }
    const page = state.pages[chapter.pageIds[0]];
    const blank = page && chapter.pageIds.length === 1 && chapter.sceneIds.length === 0;
    if (blank && pageStatus(page, hasArt) === 'paneled') {
      return page;
    }
  }
  return undefined;
}
