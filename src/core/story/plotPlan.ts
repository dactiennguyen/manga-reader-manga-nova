import { isDefaultChapterTitle } from '../model/selectors';
import type { Chapter, ID, Project } from '../model/types';

export type PlanChapter = {
  id: ID;
  title: string;
  summary: string;
  goal: string;
  sceneCount: number;
  pageCount: number;
};

export type PlanAct = { id: ID; chapters: PlanChapter[] };

export type PlotApplyMode = 'append' | 'replace';

type PlannedChapter = { actId: ID; index: number; title: string; summary: string };

export type PlotPlan = { remove: ID[]; create: PlannedChapter[] };

export function isUntouchedChapter(chapter: PlanChapter): boolean {
  return (
    isDefaultChapterTitle(chapter.title) &&
    !chapter.summary.trim() &&
    !chapter.goal.trim() &&
    chapter.sceneCount === 0 &&
    chapter.pageCount === 0
  );
}

export function storyIsBlank(acts: PlanAct[]): boolean {
  return acts.every(act => act.chapters.every(isUntouchedChapter));
}

export function existingWork(acts: PlanAct[]): { chapters: number; scenes: number; pages: number } {
  const all = acts.flatMap(act => act.chapters);
  return {
    chapters: all.length,
    scenes: all.reduce((sum, chapter) => sum + chapter.sceneCount, 0),
    pages: all.reduce((sum, chapter) => sum + chapter.pageCount, 0),
  };
}

export function planPlotApply(
  acts: PlanAct[],
  direction: { title: string; summary: string }[][],
  mode: PlotApplyMode,
): PlotPlan {
  if (!acts.length) {
    return { remove: [], create: [] };
  }
  const clear = mode === 'replace' || storyIsBlank(acts);
  const remove = clear ? acts.flatMap(act => act.chapters.map(chapter => chapter.id)) : [];
  const counts = acts.map(act => (clear ? 0 : act.chapters.length));
  const create: PlannedChapter[] = [];
  direction.forEach((chapters, position) => {
    const target = Math.min(position, acts.length - 1);
    for (const chapter of chapters) {
      const title = chapter.title.trim();
      const summary = chapter.summary.trim();
      if (!title && !summary) {
        continue;
      }
      create.push({ actId: acts[target].id, index: counts[target], title, summary });
      counts[target] += 1;
    }
  });
  if (!create.length) {
    return { remove: [], create: [] };
  }
  return { remove, create };
}

export function planActsOf(project: Project, chapters: Record<ID, Chapter | undefined>): PlanAct[] {
  return project.acts.map(act => ({
    id: act.id,
    chapters: act.chapterIds.flatMap(id => {
      const chapter = chapters[id];
      return chapter
        ? [
            {
              id: chapter.id,
              title: chapter.title,
              summary: chapter.summary,
              goal: chapter.goal,
              sceneCount: chapter.sceneIds.length,
              pageCount: chapter.pageIds.length,
            },
          ]
        : [];
    }),
  }));
}
