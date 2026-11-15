import { COURSES, LESSONS, PAGE_H, PAGE_W, contextOf, finalDrawing, lessonAfter, lessonById } from '../src/core/lessons/catalog';
import {
  EMPTY_LESSON_PROGRESS,
  courseProgress,
  lessonsDone,
  nextLesson,
  parseLessonProgress,
  recordAttempt,
  serializeLessonProgress,
  suggestLesson,
  type LessonProgress,
} from '../src/core/lessons/progress';
import { TOLERANCE, lessonScore, samplePoints, scoreTrace, starsFor } from '../src/core/lessons/score';
import { arc, boundsOf, capsule, circle, fitBox, line, mirrored, roundRect, type GuideStroke } from '../src/core/lessons/shapes';
import { EMPTY_METRICS, metricsOf } from '../src/core/studio/metrics';
import { studioPoints } from '../src/core/studio/points';
import { EMPTY_ACTIVITY } from '../src/core/story/activity';
import { EMPTY_STUDIO } from '../src/core/studio/types';

const TODAY = '2026-11-15';

/** Ids are saved with the person's progress: changing one loses their stars. Add new ones at the end. */
const STABLE_IDS = [
  'lines-straight',
  'lines-curves',
  'lines-hatching',
  'eyes-simple',
  'eyes-pair',
  'eyes-moods',
  'face-front',
  'face-three-quarter',
  'face-profile',
  'hand-shapes',
  'hand-fist',
  'hand-point',
  'persp-one-point',
  'persp-two-point',
  'persp-above',
  'fx-speed-lines',
  'fx-focus-lines',
  'fx-tone-shading',
];

/** Every guide point moved by (dx, dy): a trace a little off the line. */
const shifted = (strokes: GuideStroke[], dx: number, dy: number) =>
  strokes.map(item => ({ points: item.points.map((value, index) => value + (index % 2 === 0 ? dx : dy)) }));

describe('lesson catalogue', () => {
  it('keeps lesson ids stable and unique', () => {
    expect(LESSONS.map(lesson => lesson.id)).toEqual(STABLE_IDS);
    expect(new Set(COURSES.map(course => course.id)).size).toBe(COURSES.length);
  });

  it('has 4 to 6 courses of 3 to 5 lessons', () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(4);
    expect(COURSES.length).toBeLessThanOrEqual(6);
    for (const course of COURSES) {
      expect(course.title).toBeTruthy();
      expect(course.lessons.length).toBeGreaterThanOrEqual(3);
      expect(course.lessons.length).toBeLessThanOrEqual(5);
      expect(course.lessons.every(lesson => lesson.courseId === course.id)).toBe(true);
    }
  });

  it('gives every lesson a few small steps with unique ids and text', () => {
    for (const lesson of LESSONS) {
      expect(lesson.title).toBeTruthy();
      expect(lesson.steps.length).toBeGreaterThanOrEqual(2);
      expect(lesson.steps.length).toBeLessThanOrEqual(5);
      expect(new Set(lesson.steps.map(step => step.id)).size).toBe(lesson.steps.length);
      for (const step of lesson.steps) {
        expect(step.text).toBeTruthy();
        expect(step.guide.length).toBeGreaterThan(0);
        // Short enough to read at a glance, and to translate.
        expect(step.text.length).toBeLessThanOrEqual(70);
      }
    }
  });

  it('keeps every guide point on the page, away from the edge', () => {
    const outside: string[] = [];
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        for (const stroke of step.guide) {
          expect(stroke.points.length % 2).toBe(0);
          expect(stroke.points.length).toBeGreaterThanOrEqual(4);
          for (let i = 0; i < stroke.points.length; i += 2) {
            const [x, y] = [stroke.points[i], stroke.points[i + 1]];
            if (!(Number.isFinite(x) && Number.isFinite(y) && x >= 30 && x <= PAGE_W - 30 && y >= 30 && y <= PAGE_H - 30)) {
              outside.push(`${lesson.id}/${step.id}: ${x},${y}`);
            }
          }
        }
      }
    }
    expect(outside).toEqual([]);
  });

  it('builds context from earlier steps only in lessons that build up', () => {
    const face = lessonById('face-front')!;
    expect(contextOf(face, 0)).toEqual([]);
    expect(contextOf(face, 2)).toEqual([...face.steps[0].guide, ...face.steps[1].guide]);
    expect(finalDrawing(face).length).toBe(face.steps.reduce((sum, step) => sum + step.guide.length, 0));
    const lines = lessonById('lines-straight')!;
    expect(contextOf(lines, 2)).toEqual([]);
    expect(finalDrawing(lines)).toBe(lines.steps[0].guide);
  });

  it('walks the lessons in order', () => {
    expect(lessonAfter('lines-straight')?.id).toBe('lines-curves');
    expect(lessonAfter('lines-hatching')?.id).toBe('eyes-simple');
    expect(lessonAfter(STABLE_IDS[STABLE_IDS.length - 1])).toBeNull();
    expect(lessonAfter('nope')).toBeNull();
  });
});

describe('guide shapes', () => {
  it('draws closed shapes back to where they start', () => {
    for (const shape of [circle(100, 100, 50), roundRect(10, 10, 100, 60, 10), capsule(100, 100, 100, 300, 20)]) {
      const p = shape.points;
      expect(Math.hypot(p[0] - p[p.length - 2], p[1] - p[p.length - 1])).toBeLessThan(1);
    }
  });

  it('puts circle points on the circle and mirrors across the page', () => {
    const c = circle(450, 600, 100);
    for (let i = 0; i < c.points.length; i += 2) {
      expect(Math.hypot(c.points[i] - 450, c.points[i + 1] - 600)).toBeCloseTo(100, 0);
    }
    expect(mirrored([line(100, 10, 200, 20)])[0].points).toEqual([800, 10, 700, 20]);
    expect(arc(0, 0, 10, 10, 0, 90).points.slice(-2)).toEqual([0, 10]);
  });

  it('fits a box into a view', () => {
    const box = boundsOf([line(100, 100, 300, 200)], 0)!;
    expect(box).toEqual({ x: 100, y: 100, w: 200, h: 100 });
    const fit = fitBox(box, 400, 400);
    expect(fit.scale).toBe(2);
    expect(100 * fit.scale + fit.x).toBe(0);
    expect(100 * fit.scale + fit.y).toBe(100);
    expect(boundsOf([])).toBeNull();
  });
});

describe('trace score', () => {
  const guide = lessonById('lines-straight')!.steps[0].guide;

  it('gives a perfect trace full marks', () => {
    expect(scoreTrace(guide, guide)).toEqual({ coverage: 1, accuracy: 1, score: 100 });
    expect(starsFor(100)).toBe(3);
  });

  it('forgives a hand a little off the line', () => {
    expect(scoreTrace(guide, shifted(guide, 0, TOLERANCE * 0.8)).score).toBe(100);
    const wobbly = scoreTrace(guide, shifted(guide, 0, TOLERANCE * 1.5)).score;
    // Half credit on both sides: 100 × 0.5 × 0.5^0.75, still one star.
    expect(wobbly).toBe(30);
    expect(starsFor(wobbly)).toBe(1);
    expect(scoreTrace(guide, shifted(guide, 0, TOLERANCE * 2.5)).score).toBe(0);
  });

  it('gives nothing for an empty page', () => {
    expect(scoreTrace(guide, []).score).toBe(0);
    expect(starsFor(0)).toBe(0);
  });

  it('scores a scribble over the whole page low, though it covers everything', () => {
    const scribble = Array.from({ length: 40 }, (_, i) => line(40, 40 + i * 28, 860, 54 + i * 28));
    const result = scoreTrace(guide, scribble);
    expect(result.coverage).toBe(1);
    expect(result.accuracy).toBeLessThan(0.35);
    expect(result.score).toBeLessThan(STAR(2));
  });

  it('gives about half for half the lines', () => {
    const result = scoreTrace(guide, guide.slice(0, 2).concat({ points: guide[2].points.slice(0, 2).concat(450, guide[2].points[3]) }));
    expect(result.accuracy).toBe(1);
    expect(result.score).toBeGreaterThan(40);
    expect(result.score).toBeLessThan(60);
    expect(starsFor(result.score)).toBe(1);
  });

  it('counts a tap as a dot of ink', () => {
    expect(scoreTrace([line(0, 0, 0, 1)], [{ points: [0, 0] }]).score).toBe(100);
  });

  it('samples along every segment', () => {
    expect(samplePoints([line(0, 0, 80, 0)]).length / 2).toBe(11);
  });

  it('averages steps into a lesson score, a skipped step as zero', () => {
    expect(lessonScore([100, 50], 2)).toBe(75);
    expect(lessonScore([100], 2)).toBe(50);
    expect(lessonScore([140, -5], 2)).toBe(50);
    expect(lessonScore([], 0)).toBe(0);
  });

  it('gives stars at gentle thresholds', () => {
    expect([29, 30, 59, 60, 84, 85].map(starsFor)).toEqual([0, 1, 1, 2, 2, 3]);
  });
});

function STAR(count: 1 | 2 | 3): number {
  return [30, 60, 85][count - 1];
}

describe('lesson progress', () => {
  it('records tries, best score and the days of finishing', () => {
    let run = recordAttempt(EMPTY_LESSON_PROGRESS, 'lines-straight', 20, '2026-11-10');
    expect(run.firstFinish).toBe(false);
    expect(run.record).toEqual({ best: 20, stars: 0, tries: 1, firstDay: '', lastDay: '' });
    run = recordAttempt(run.progress, 'lines-straight', 70, '2026-11-11');
    expect(run).toMatchObject({ firstFinish: true, improved: true });
    expect(run.record).toEqual({ best: 70, stars: 2, tries: 2, firstDay: '2026-11-11', lastDay: '2026-11-11' });
    run = recordAttempt(run.progress, 'lines-straight', 40, '2026-11-12');
    expect(run).toMatchObject({ firstFinish: false, improved: false });
    expect(run.record).toEqual({ best: 70, stars: 2, tries: 3, firstDay: '2026-11-11', lastDay: '2026-11-12' });
    // A run with no star does not move the day the lesson was last done.
    run = recordAttempt(run.progress, 'lines-straight', 5, '2026-11-13');
    expect(run.record.lastDay).toBe('2026-11-12');
  });

  it('saves and reads back the same progress', () => {
    const { progress } = recordAttempt(EMPTY_LESSON_PROGRESS, 'eyes-simple', 91, TODAY);
    const saved = serializeLessonProgress(progress);
    expect(JSON.parse(saved).v).toBe(1);
    expect(parseLessonProgress(saved)).toEqual(progress);
  });

  it('reads nothing, junk and broken records without throwing', () => {
    expect(parseLessonProgress(null)).toEqual(EMPTY_LESSON_PROGRESS);
    expect(parseLessonProgress('not json')).toEqual(EMPTY_LESSON_PROGRESS);
    expect(parseLessonProgress('[1,2]')).toEqual(EMPTY_LESSON_PROGRESS);
    expect(parseLessonProgress('{"lessons":[]}')).toEqual(EMPTY_LESSON_PROGRESS);
    const parsed = parseLessonProgress(
      JSON.stringify({
        lessons: {
          'lines-straight': { best: 250, stars: 1, tries: 'x', firstDay: 'yesterday', lastDay: '2026-11-01' },
          'eyes-simple': { best: 10, stars: 3, tries: 4, firstDay: '2026-11-01', lastDay: '2026-11-02' },
          'Bad Id!': { best: 90 },
          'face-front': 'oops',
        },
      }),
    );
    expect(parsed.lessons).toEqual({
      // Clamped to 100, and the missing first day falls back to the last one.
      'lines-straight': { best: 100, stars: 3, tries: 1, firstDay: '2026-11-01', lastDay: '2026-11-01' },
      // Stars follow the score, not what was saved.
      'eyes-simple': { best: 10, stars: 0, tries: 4, firstDay: '', lastDay: '' },
    });
  });

  it('reads a record saved without a version, and keeps lessons it does not know', () => {
    const parsed = parseLessonProgress('{"lessons":{"old-lesson":{"best":64,"tries":2,"lastDay":"2026-10-01"}}}');
    expect(parsed.lessons['old-lesson']).toEqual({ best: 64, stars: 2, tries: 2, firstDay: '2026-10-01', lastDay: '2026-10-01' });
    // Unknown lessons never count.
    expect(lessonsDone(parsed)).toBe(0);
    // A later version keeps what this one understands.
    expect(parseLessonProgress('{"v":7,"lessons":{"hand-fist":{"best":90}},"extra":1}').lessons['hand-fist'].stars).toBe(3);
  });

  it('counts lessons and course progress', () => {
    let progress: LessonProgress = EMPTY_LESSON_PROGRESS;
    for (const id of ['lines-straight', 'lines-curves', 'eyes-pair']) {
      progress = recordAttempt(progress, id, 80, TODAY).progress;
    }
    progress = recordAttempt(progress, 'lines-hatching', 10, TODAY).progress;
    expect(lessonsDone(progress)).toBe(3);
    expect(courseProgress(COURSES[0], progress)).toEqual({ done: 2, total: 3 });
    expect(nextLesson(progress)?.id).toBe('lines-hatching');
  });
});

describe('daily suggestion', () => {
  it('starts a newcomer on the first lesson', () => {
    expect(suggestLesson(EMPTY_LESSON_PROGRESS, TODAY)).toMatchObject({ doneToday: false, review: false });
    expect(suggestLesson(EMPTY_LESSON_PROGRESS, TODAY).lesson.id).toBe('lines-straight');
  });

  it('moves on after a lesson and says when today is done', () => {
    const { progress } = recordAttempt(EMPTY_LESSON_PROGRESS, 'lines-straight', 50, TODAY);
    expect(suggestLesson(progress, TODAY)).toMatchObject({ doneToday: true, review: false });
    expect(suggestLesson(progress, TODAY).lesson.id).toBe('lines-curves');
    expect(suggestLesson(progress, '2026-11-16').doneToday).toBe(false);
  });

  it('suggests the weakest lessons for review once all are done, a different one each day', () => {
    let progress: LessonProgress = EMPTY_LESSON_PROGRESS;
    for (const lesson of LESSONS) {
      progress = recordAttempt(progress, lesson.id, 95, '2026-11-01').progress;
    }
    progress = recordAttempt(progress, 'face-profile', 40, '2026-11-01').progress;
    expect(suggestLesson(progress, TODAY)).toMatchObject({ review: true, doneToday: false });
    // face-profile kept its best of 95, so every lesson ties at three stars.
    const days = ['2026-11-15', '2026-11-16', '2026-11-17'].map(day => suggestLesson(progress, day).lesson.id);
    expect(new Set(days).size).toBe(3);
    expect(suggestLesson(progress, TODAY).lesson.id).toBe(suggestLesson(progress, TODAY).lesson.id);
    const weak = LESSONS.reduce((acc, lesson) => recordAttempt(acc, lesson.id, lesson.id === 'hand-fist' ? 35 : 95, '2026-11-01').progress, EMPTY_LESSON_PROGRESS);
    expect(suggestLesson(weak, TODAY).lesson.id).toBe('hand-fist');
  });
});

describe('lessons in the studio', () => {
  it('counts finished lessons toward Studio points', () => {
    const m = metricsOf(
      { projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} },
      EMPTY_ACTIVITY,
      EMPTY_STUDIO,
      TODAY,
      () => false,
      3,
    );
    expect(m.lessonsDone).toBe(3);
    expect(EMPTY_METRICS.lessonsDone).toBe(0);
    expect(studioPoints(m)).toBeGreaterThan(studioPoints(EMPTY_METRICS));
  });
});
