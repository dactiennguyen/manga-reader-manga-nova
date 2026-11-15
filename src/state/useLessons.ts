import { create } from 'zustand';

import {
  EMPTY_LESSON_PROGRESS,
  lessonsDone,
  parseLessonProgress,
  recordAttempt,
  serializeLessonProgress,
  type LessonProgress,
} from '../core/lessons/progress';
import type { Stroke } from '../core/model/types';
import type { MetaRepo } from '../core/ports';
import { dayKey } from '../core/util/time';

const KEY = 'lessons';

let repo: MetaRepo | null = null;

/** The practice run just finished, for the result screen. Kept in memory only. */
export type LessonRun = {
  lessonId: string;
  stepScores: number[];
  score: number;
  /** The ink of each step, in page units. */
  ink: Stroke[][];
  firstFinish: boolean;
  improved: boolean;
};

type LessonsStore = {
  progress: LessonProgress;
  lastRun: LessonRun | null;
  /** Records a finished run and keeps it for the result screen. */
  finish: (run: Pick<LessonRun, 'lessonId' | 'stepScores' | 'score' | 'ink'>) => LessonRun;
};

/** Progress through the drawing lessons. Every change is small and rare, so it is written at once. */
export const useLessons = create<LessonsStore>()((set, get) => ({
  progress: EMPTY_LESSON_PROGRESS,
  lastRun: null,
  finish: input => {
    const out = recordAttempt(get().progress, input.lessonId, input.score, dayKey());
    const run: LessonRun = { ...input, firstFinish: out.firstFinish, improved: out.improved };
    set({ progress: out.progress, lastRun: run });
    repo?.set(KEY, serializeLessonProgress(out.progress));
    return run;
  },
}));

export function connectLessons(next: MetaRepo | null): void {
  repo = next;
  useLessons.setState({ progress: parseLessonProgress(next?.get(KEY)), lastRun: null });
}

/** Lessons finished with a star, for the studio metrics. */
export function useLessonsDone(): number {
  return useLessons(s => lessonsDone(s.progress));
}
