import { t, tn } from '../i18n';
import { chapterIdsOf, chapterProgress, chapterStatus } from '../model/selectors';
import type { Project, StoryData } from '../model/types';
import type { StoryRoute } from './resume';

export type NextStep = { text: string; actions: { label: string; route: StoryRoute }[] };

export function nextStepOf(state: StoryData, project: Project): NextStep {
  const projectId = project.id;
  const chapterIds = chapterIdsOf(project);
  if (chapterIds.length === 0) {
    return {
      text: t('No chapters yet. Outline the story to plan your chapters first.'),
      actions: [{ label: t('Open outline'), route: { name: 'Outline', params: { projectId } } }],
    };
  }
  for (const [index, chapterId] of chapterIds.entries()) {
    const flagged = (state.chapters[chapterId]?.pageIds ?? []).filter(pageId => {
      const page = state.pages[pageId];
      return !!page && (!!page.flag || Object.values(page.panels).some(panel => panel.redo));
    }).length;
    if (flagged > 0) {
      return {
        text: t('Chapter {n} has {flagged} flagged pages to fix.', { n: index + 1, flagged }),
        actions: [{ label: t('Review and fix'), route: { name: 'Storyboard', params: { chapterId } } }],
      };
    }
  }
  const statuses = chapterIds.map(chapterId => chapterStatus(state, chapterId));
  const firstOpen = statuses.findIndex(status => status !== 'done');
  if (firstOpen < 0) {
    return {
      text: t('Every page is done. Preview it once, then export!'),
      actions: [
        { label: t('Preview'), route: { name: 'Preview', params: { projectId } } },
        { label: t('Export'), route: { name: 'Export', params: { projectId } } },
      ],
    };
  }
  const chapterId = chapterIds[firstOpen];
  const number = firstOpen + 1;
  const status = statuses[firstOpen];
  if (status === 'drawing') {
    const { done, total } = chapterProgress(state, chapterId);
    return {
      text: tn(total - done, 'Chapter {n} has {count} page left.', 'Chapter {n} has {count} pages left.', { n: number }),
      actions: [{ label: t('Keep drawing'), route: { name: 'Storyboard', params: { chapterId } } }],
    };
  }
  if (status === 'writing') {
    return {
      text: t('Chapter {n} has a script. Split it into pages to start drawing.', { n: number }),
      actions: [
        { label: t('Paginate chapter {n}', { n: number }), route: { name: 'Storyboard', params: { chapterId } } },
        { label: t('Keep writing'), route: { name: 'Script', params: { chapterId } } },
      ],
    };
  }
  if (statuses.every(item => item === 'unwritten')) {
    return {
      text: t('Start with an outline, or go straight to the chapter {n} script.', { n: number }),
      actions: [
        { label: t('Outline'), route: { name: 'Outline', params: { projectId } } },
        { label: t('Write script'), route: { name: 'Script', params: { chapterId } } },
      ],
    };
  }
  return {
    text: t('Chapter {n} has no script yet.', { n: number }),
    actions: [{ label: t('Write chapter {n}', { n: number }), route: { name: 'Script', params: { chapterId } } }],
  };
}
