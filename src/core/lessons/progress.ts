/**
 * What the person has done in the drawing lessons, saved on the device under the meta key `lessons`.
 * Everything here is pure, so the store only reads, records and writes.
 */
import { DAY_MS, dayKeyToDate } from '../util/time';
import { COURSES, LESSONS, lessonById, type Course, type Lesson } from './catalog';
import { starsFor, type Stars } from './score';

/** Bumped when the saved shape changes. parseLessonProgress reads every older version. */
export const LESSON_PROGRESS_VERSION = 1;

export type LessonRecord = {
  /** Best lesson score, 0 to 100. */
  best: number;
  stars: Stars;
  /** Practice runs finished, done or not. */
  tries: number;
  /** Day key of the first finish with a star, '' until then. */
  firstDay: string;
  /** Day key of the latest finish with a star, '' until then. */
  lastDay: string;
};

/**
 * Records by lesson id. Ids the catalogue no longer has are kept, so moving between app versions never loses
 * progress, but only lessons in the catalogue count anywhere.
 */
export type LessonProgress = { lessons: Record<string, LessonRecord> };

export const EMPTY_LESSON_PROGRESS: LessonProgress = { lessons: {} };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9-]{1,40}$/;
/** Far more lessons than will ever exist; only stops junk. */
const RECORDS_MAX = 500;

function readRecord(value: unknown): LessonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const best = typeof raw.best === 'number' && Number.isFinite(raw.best) ? Math.round(Math.min(100, Math.max(0, raw.best))) : 0;
  const tries = typeof raw.tries === 'number' && Number.isFinite(raw.tries) ? Math.max(0, Math.floor(raw.tries)) : 0;
  const day = (key: string) => (typeof raw[key] === 'string' && DAY.test(raw[key] as string) ? (raw[key] as string) : '');
  // Stars always follow the best score, so a hand-edited or older record cannot claim more.
  const stars = starsFor(best);
  const lastDay = stars > 0 ? day('lastDay') || day('firstDay') : '';
  const firstDay = stars > 0 ? day('firstDay') || lastDay : '';
  return { best, stars, tries: Math.max(tries, best > 0 ? 1 : 0), firstDay, lastDay };
}

/** Reads what was saved, keeping every good record and dropping anything broken. Never throws. */
export function parseLessonProgress(raw: string | null | undefined): LessonProgress {
  if (!raw) {
    return EMPTY_LESSON_PROGRESS;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_LESSON_PROGRESS;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_LESSON_PROGRESS;
  }
  // Version 1 is the first: a missing `v` reads as 1. A later version keeps the fields this one knows.
  const source = (value as Record<string, unknown>).lessons;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return EMPTY_LESSON_PROGRESS;
  }
  const lessons: Record<string, LessonRecord> = {};
  for (const [id, item] of Object.entries(source as Record<string, unknown>)) {
    const record = ID.test(id) ? readRecord(item) : null;
    if (record && Object.keys(lessons).length < RECORDS_MAX) {
      lessons[id] = record;
    }
  }
  return { lessons };
}

export function serializeLessonProgress(progress: LessonProgress): string {
  return JSON.stringify({ v: LESSON_PROGRESS_VERSION, lessons: progress.lessons });
}

export type AttemptResult = {
  progress: LessonProgress;
  record: LessonRecord;
  /** The lesson was done for the first time with this run. */
  firstFinish: boolean;
  /** The run beat the earlier best. */
  improved: boolean;
};

/** Adds one finished practice run. A run with no star still counts as a try. */
export function recordAttempt(progress: LessonProgress, lessonId: string, score: number, day: string): AttemptResult {
  const before = progress.lessons[lessonId];
  const clean = Math.round(Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0)));
  const best = Math.max(before?.best ?? 0, clean);
  const stars = starsFor(best);
  const earned = starsFor(clean) > 0;
  const record: LessonRecord = {
    best,
    stars,
    tries: (before?.tries ?? 0) + 1,
    firstDay: before?.firstDay || (earned ? day : ''),
    lastDay: earned ? day : (before?.lastDay ?? ''),
  };
  return {
    progress: { lessons: { ...progress.lessons, [lessonId]: record } },
    record,
    firstFinish: earned && !(before && before.stars > 0),
    improved: !!before && clean > before.best,
  };
}

export function isDone(progress: LessonProgress, lessonId: string): boolean {
  return (progress.lessons[lessonId]?.stars ?? 0) > 0;
}

/** Lessons of the catalogue done at least once with a star. */
export function lessonsDone(progress: LessonProgress): number {
  return LESSONS.filter(lesson => isDone(progress, lesson.id)).length;
}

export function courseProgress(course: Course, progress: LessonProgress): { done: number; total: number } {
  return { done: course.lessons.filter(lesson => isDone(progress, lesson.id)).length, total: course.lessons.length };
}

/** The first lesson not done yet, in catalogue order. */
export function nextLesson(progress: LessonProgress): Lesson | null {
  return LESSONS.find(lesson => !isDone(progress, lesson.id)) ?? null;
}

export type Suggestion = {
  lesson: Lesson;
  /** A lesson was finished with a star today, so today's practice is done. */
  doneToday: boolean;
  /** Every lesson is done: the suggestion is one to practise again. */
  review: boolean;
};

function dayNumber(day: string): number {
  return Math.round(dayKeyToDate(day).getTime() / DAY_MS);
}

/**
 * Today's lesson: the next one not done. Once all are done, one with the fewest stars, a different one each
 * day, so going back over the hardest lessons stays fresh.
 */
export function suggestLesson(progress: LessonProgress, today: string): Suggestion {
  const doneToday = LESSONS.some(lesson => progress.lessons[lesson.id]?.lastDay === today);
  const next = nextLesson(progress);
  if (next) {
    return { lesson: next, doneToday, review: false };
  }
  const fewest = Math.min(...LESSONS.map(lesson => progress.lessons[lesson.id]?.stars ?? 0));
  const candidates = LESSONS.filter(lesson => (progress.lessons[lesson.id]?.stars ?? 0) === fewest);
  const index = ((dayNumber(today) % candidates.length) + candidates.length) % candidates.length;
  return { lesson: candidates[index], doneToday, review: true };
}

/** The course a lesson belongs to, for its title. */
export function courseOf(lessonId: string): Course | undefined {
  const lesson = lessonById(lessonId);
  return lesson ? COURSES.find(item => item.id === lesson.courseId) : undefined;
}
