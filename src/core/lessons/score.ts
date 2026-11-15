/**
 * How closely a trace followed its guide. Two numbers, both forgiving:
 *
 * - coverage: how much of the guide has ink near it, so tracing only half the lines gives about half;
 * - accuracy: how much of the ink lies near the guide, so scribbling over the whole page scores low even
 *   though it covers everything.
 *
 * Near means within TOLERANCE page units for full credit, fading to nothing at twice that. The score is
 * coverage × accuracy^0.75, out of 100: missing lines costs more than a shaky hand.
 */
import type { GuideStroke } from './shapes';

/** Full credit within this distance, in page units (the page is 900 wide). */
export const TOLERANCE = 30;
/** Points are taken this far apart along both the guide and the ink. */
const SPACING = 8;

export type Stars = 0 | 1 | 2 | 3;

export type TraceScore = { coverage: number; accuracy: number; score: number };

/** Lowest score for each star. One star is enough to count the lesson as done. */
export const STAR_SCORES = [30, 60, 85] as const;

type Segment = [number, number, number, number];

function segmentsOf(strokes: readonly { points: readonly number[] }[]): Segment[] {
  const out: Segment[] = [];
  for (const item of strokes) {
    const p = item.points;
    if (p.length === 2) {
      // A dot: a segment of no length.
      out.push([p[0], p[1], p[0], p[1]]);
    }
    for (let i = 2; i + 1 < p.length; i += 2) {
      out.push([p[i - 2], p[i - 1], p[i], p[i + 1]]);
    }
  }
  return out;
}

/** Points every SPACING units along the strokes, ends included. */
export function samplePoints(strokes: readonly { points: readonly number[] }[]): number[] {
  const out: number[] = [];
  for (const [x0, y0, x1, y1] of segmentsOf(strokes)) {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const count = Math.max(1, Math.ceil(length / SPACING));
    for (let i = 0; i < count; i++) {
      out.push(x0 + ((x1 - x0) * i) / count, y0 + ((y1 - y0) * i) / count);
    }
    out.push(x1, y1);
  }
  return out;
}

function distanceToSegment(px: number, py: number, [x0, y0, x1, y1]: Segment): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length2 = dx * dx + dy * dy;
  const t = length2 > 0 ? Math.min(1, Math.max(0, ((px - x0) * dx + (py - y0) * dy) / length2)) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function nearest(px: number, py: number, segments: Segment[]): number {
  let best = Infinity;
  for (const segment of segments) {
    // Skip segments whose box is already farther than the best found.
    const minX = Math.min(segment[0], segment[2]) - best;
    const maxX = Math.max(segment[0], segment[2]) + best;
    const minY = Math.min(segment[1], segment[3]) - best;
    const maxY = Math.max(segment[1], segment[3]) + best;
    if (px < minX || px > maxX || py < minY || py > maxY) {
      continue;
    }
    best = Math.min(best, distanceToSegment(px, py, segment));
  }
  return best;
}

/** 1 within the tolerance, 0 beyond twice it, a straight fade between. */
function credit(distance: number): number {
  if (distance <= TOLERANCE) {
    return 1;
  }
  return Math.max(0, 2 - distance / TOLERANCE);
}

/** Mean credit of the points against the nearest segment of the other strokes. */
function closeness(points: number[], segments: Segment[]): number {
  if (!points.length || !segments.length) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i + 1 < points.length; i += 2) {
    sum += credit(nearest(points[i], points[i + 1], segments));
  }
  return sum / (points.length / 2);
}

/** Scores ink strokes (x, y pairs in page units) against a step's guide. */
export function scoreTrace(guide: readonly GuideStroke[], ink: readonly { points: readonly number[] }[]): TraceScore {
  const inkSegments = segmentsOf(ink);
  const guideSegments = segmentsOf(guide);
  if (!inkSegments.length || !guideSegments.length) {
    return { coverage: 0, accuracy: 0, score: 0 };
  }
  const coverage = closeness(samplePoints(guide), inkSegments);
  const accuracy = closeness(samplePoints(ink), guideSegments);
  const score = Math.round(100 * coverage * Math.pow(accuracy, 0.75));
  return { coverage, accuracy, score };
}

export function starsFor(score: number): Stars {
  return score >= STAR_SCORES[2] ? 3 : score >= STAR_SCORES[1] ? 2 : score >= STAR_SCORES[0] ? 1 : 0;
}

/** A lesson's score: the mean of its steps, rounded. A skipped step counts as 0. */
export function lessonScore(stepScores: readonly number[], stepCount: number): number {
  if (stepCount <= 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < stepCount; i++) {
    sum += Math.min(100, Math.max(0, stepScores[i] ?? 0));
  }
  return Math.round(sum / stepCount);
}
