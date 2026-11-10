import { msg, t, tn } from '../i18n';
import { CHAPTER_STATUS_LABEL } from '../model/constants';
import { chapterName } from '../model/selectors';
import type { Act, Chapter, ChapterStatus, ID, Project } from '../model/types';

export function chapterCount(count: number): string {
  return tn(count, '{count} chapter', '{count} chapters');
}

export const STATUS_TEXT: Record<ChapterStatus, string> = {
  unwritten: msg('No script yet'),
  writing: msg('Script written'),
  drawing: CHAPTER_STATUS_LABEL.drawing,
  done: msg('Fully drawn'),
};

export type ChapterSpot = { actIndex: number; act: Act | undefined; index: number };

export function locateChapter(acts: Act[], chapterId: ID): ChapterSpot {
  const actIndex = acts.findIndex(act => act.chapterIds.includes(chapterId));
  return { actIndex, act: acts[actIndex], index: acts[actIndex]?.chapterIds.indexOf(chapterId) ?? -1 };
}

/** One step earlier or later, crossing into the neighbouring act at the edge. */
export function shiftTarget(
  acts: Act[],
  chapterId: ID,
  delta: -1 | 1,
): { actId: ID; index: number; crossed?: string } | null {
  const { actIndex, act, index } = locateChapter(acts, chapterId);
  if (!act) {
    return null;
  }
  const target = index + delta;
  if (target >= 0 && target < act.chapterIds.length) {
    return { actId: act.id, index: target };
  }
  const neighbor = acts[actIndex + delta];
  if (!neighbor) {
    return null;
  }
  return { actId: neighbor.id, index: delta < 0 ? neighbor.chapterIds.length : 0, crossed: neighbor.title };
}

export function chapterEdges(acts: Act[], chapterId: ID): { first: boolean; last: boolean } {
  const { actIndex, act, index } = locateChapter(acts, chapterId);
  return {
    first: actIndex <= 0 && index <= 0,
    last: actIndex === acts.length - 1 && act !== undefined && index === act.chapterIds.length - 1,
  };
}

export function outlineText(
  project: Pick<Project, 'title' | 'logline' | 'acts'>,
  chapters: Record<ID, Chapter | undefined>,
  numbers: Record<ID, number>,
): string {
  const lines = [project.title.toUpperCase()];
  if (project.logline) {
    lines.push(project.logline);
  }
  for (const act of project.acts) {
    lines.push('', act.title.toUpperCase());
    for (const id of act.chapterIds) {
      const chapter = chapters[id];
      if (!chapter) {
        continue;
      }
      lines.push(t('Chapter {n}. {title}', { n: numbers[id], title: chapterName(chapter.title, numbers[id]) }));
      if (chapter.summary) {
        lines.push(`  ${chapter.summary}`);
      }
      if (chapter.goal) {
        lines.push(`  ${t('Goal: {goal}', { goal: chapter.goal })}`);
      }
    }
  }
  return lines.join('\n');
}
