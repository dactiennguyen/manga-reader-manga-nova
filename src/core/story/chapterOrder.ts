import type { Act, ID } from '../model/types';

export type ChapterMove = { toActId: ID; toIndex: number; crossedInto?: string };

/** One step up or down. At the edge of an act the chapter crosses into the neighbouring act. */
export function chapterMove(acts: Act[], chapterId: ID, delta: -1 | 1): ChapterMove | null {
  const actIndex = acts.findIndex(act => act.chapterIds.includes(chapterId));
  const act = acts[actIndex];
  if (!act) {
    return null;
  }
  const target = act.chapterIds.indexOf(chapterId) + delta;
  if (target >= 0 && target < act.chapterIds.length) {
    return { toActId: act.id, toIndex: target };
  }
  const neighbor = acts[actIndex + delta];
  if (!neighbor) {
    return null;
  }
  return {
    toActId: neighbor.id,
    toIndex: delta < 0 ? neighbor.chapterIds.length : 0,
    crossedInto: neighbor.title,
  };
}

export function canMoveChapterUp(acts: Act[], chapterId: ID): boolean {
  return acts.flatMap(act => act.chapterIds)[0] !== chapterId;
}

export function canMoveChapterDown(acts: Act[], chapterId: ID): boolean {
  const flat = acts.flatMap(act => act.chapterIds);
  const last = flat[flat.length - 1] === chapterId && acts[acts.length - 1]?.chapterIds.includes(chapterId);
  return !last;
}

/** New chapters join the last act that has any, so they land after the existing ones. */
export function actForNewChapter(acts: Act[]): Act | undefined {
  return [...acts].reverse().find(act => act.chapterIds.length > 0) ?? acts[0];
}
