/**
 * The stories playing together saves into: "Drawn together", "Relay pages", "Speed battles". Each is an
 * ordinary story in the library, found again by its title so pages from many sessions gather in one.
 */
import { msg, t } from '../../../core/i18n';
import type { ID } from '../../../core/model/types';
import { useStory } from '../../../state/useStory';

export const DRAWN_TOGETHER = msg('Drawn together');
export const RELAY_PAGES = msg('Relay pages');
export const SPEED_BATTLES = msg('Speed battles');

function createStory(title: string): ID {
  return useStory.getState().createProject({
    title,
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'slice',
    color: true,
  });
}

/** The story with this title (in the current language), made when it is not there or is in the trash. */
export function ensureStory(title: string): ID {
  const name = t(title);
  const found = Object.values(useStory.getState().projects).find(item => item.title === name && !item.deletedAt);
  return found?.id ?? createStory(name);
}

/** A new page at the end of the story's first chapter. */
export function addStoryPage(projectId: ID, templateId: string): ID | null {
  const state = useStory.getState();
  const chapterId = state.projects[projectId]?.acts.flatMap(act => act.chapterIds).find(id => state.chapters[id]);
  if (!chapterId) {
    return null;
  }
  const pageId = state.addPage(chapterId, { templateId });
  return useStory.getState().pages[pageId] ? pageId : null;
}

/** Whether a story is one of the holders above, in the language it was made in or the current one. */
function isHolder(title: string): boolean {
  return [DRAWN_TOGETHER, RELAY_PAGES, SPEED_BATTLES].some(key => title === key || title === t(key));
}

/**
 * Drops a page nobody kept, e.g. the scratch page of a battle drawing that was not saved. A holder story
 * left with no pages goes too, so the library, the mangaka card and Send a story don't list an empty story.
 */
export function dropPage(pageId: ID): void {
  const state = useStory.getState();
  const page = state.pages[pageId];
  if (!page) {
    return;
  }
  const projectId = state.chapters[page.chapterId]?.projectId;
  state.removePage(pageId);
  const after = useStory.getState();
  const project = projectId ? after.projects[projectId] : undefined;
  if (!project || !isHolder(project.title)) {
    return;
  }
  const empty = project.acts.flatMap(act => act.chapterIds).every(id => (after.chapters[id]?.pageIds.length ?? 0) === 0);
  if (empty) {
    after.deleteProjectForever(project.id);
  }
}
