import { LIMITS } from '../model/constants';
import { t, tn } from '../i18n';
import type { Project, StoryData } from '../model/types';
import { DAY_MS } from '../util/time';

export type StoryStats = { projectCount: number; trashed: number; donePages: number; characterCount: number };

/** Counts only what the author can still see: trashed stories add to `trashed` and nothing else. */
export function storyStats({
  projects,
  chapters,
  pages,
  characters,
}: Pick<StoryData, 'projects' | 'chapters' | 'pages' | 'characters'>): StoryStats {
  const active = new Set<string>();
  let trashed = 0;
  Object.values(projects).forEach(project => {
    if (project.deletedAt) {
      trashed += 1;
    } else {
      active.add(project.id);
    }
  });
  const donePages = Object.values(pages).filter(page => {
    const chapter = chapters[page.chapterId];
    return page.done && !!chapter && active.has(chapter.projectId);
  }).length;
  const characterCount = Object.values(characters).filter(character => active.has(character.projectId)).length;
  return { projectCount: active.size, trashed, donePages, characterCount };
}

export function trashDaysLeft(project: Pick<Project, 'deletedAt'>, now: number): number {
  const expiresAt = (project.deletedAt ?? now) + LIMITS.trashDays * DAY_MS;
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}

export function trashCountdown(left: number): string {
  return left >= 1 ? tn(left, '{count} day left', '{count} days left') : t('Will be deleted today');
}
