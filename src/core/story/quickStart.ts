import { activeProjects, chaptersOf, pageStatus } from '../model/selectors';
import type { ID, Page, StoryData } from '../model/types';

export const QUICK_START_TITLE = 'Untitled story';

/** A quick start nobody touched yet, so repeat taps reuse it instead of filling the library. */
export function unusedQuickStart(state: StoryData, hasArt: (panelId: ID) => boolean): Page | undefined {
  for (const project of activeProjects(state)) {
    const chapters = chaptersOf(state, project.id);
    const [chapter] = chapters;
    if (project.title !== QUICK_START_TITLE || project.logline || chapters.length !== 1 || !chapter) {
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
