import { chapterIdsOf, chapterProgress, chapterStatus } from '../model/selectors';
import type { Project, StoryData } from '../model/types';
import { plural } from '../util/format';
import type { StoryRoute } from './resume';

export type NextStep = { text: string; actions: { label: string; route: StoryRoute }[] };

export function nextStepOf(state: StoryData, project: Project): NextStep {
  const projectId = project.id;
  const chapterIds = chapterIdsOf(project);
  if (chapterIds.length === 0) {
    return {
      text: 'No chapters yet. Outline the story to plan your chapters first.',
      actions: [{ label: 'Open outline', route: { name: 'Outline', params: { projectId } } }],
    };
  }
  for (const [index, chapterId] of chapterIds.entries()) {
    const flagged = (state.chapters[chapterId]?.pageIds ?? []).filter(pageId => {
      const page = state.pages[pageId];
      return !!page && (!!page.flag || Object.values(page.panels).some(panel => panel.redo));
    }).length;
    if (flagged > 0) {
      return {
        text: `Chapter ${index + 1} has ${flagged} flagged pages to fix.`,
        actions: [{ label: 'Review and fix', route: { name: 'Storyboard', params: { chapterId } } }],
      };
    }
  }
  const statuses = chapterIds.map(chapterId => chapterStatus(state, chapterId));
  const firstOpen = statuses.findIndex(status => status !== 'done');
  if (firstOpen < 0) {
    return {
      text: 'Every page is done. Preview it once, then export!',
      actions: [
        { label: 'Preview', route: { name: 'Preview', params: { projectId } } },
        { label: 'Export', route: { name: 'Export', params: { projectId } } },
      ],
    };
  }
  const chapterId = chapterIds[firstOpen];
  const number = firstOpen + 1;
  const status = statuses[firstOpen];
  if (status === 'drawing') {
    const { done, total } = chapterProgress(state, chapterId);
    return {
      text: `Chapter ${number} has ${plural(total - done, 'page')} left.`,
      actions: [{ label: 'Keep drawing', route: { name: 'Storyboard', params: { chapterId } } }],
    };
  }
  if (status === 'writing') {
    return {
      text: `Chapter ${number} has a script. Split it into pages to start drawing.`,
      actions: [
        { label: `Paginate chapter ${number}`, route: { name: 'Storyboard', params: { chapterId } } },
        { label: 'Keep writing', route: { name: 'Script', params: { chapterId } } },
      ],
    };
  }
  if (statuses.every(item => item === 'unwritten')) {
    return {
      text: `Start with an outline, or go straight to the chapter ${number} script.`,
      actions: [
        { label: 'Outline', route: { name: 'Outline', params: { projectId } } },
        { label: 'Write script', route: { name: 'Script', params: { chapterId } } },
      ],
    };
  }
  return {
    text: `Chapter ${number} has no script yet.`,
    actions: [{ label: `Write chapter ${number}`, route: { name: 'Script', params: { chapterId } } }],
  };
}
