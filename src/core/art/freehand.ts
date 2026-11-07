/*
 * perfect-freehand 1.2.3, vendored because an npm package cannot run inside a worklet.
 * The npm tarball ships only a minified bundle, so this file is that bundle written out by hand. The
 * changes are the 'worklet' directives, callees moved above their callers (the worklets plugin captures
 * closures when a function is defined) and the shared scratch vectors moved into the functions.
 *
 * MIT License
 *
 * Copyright (c) 2021 Stephen Ruiz Ltd
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type Vec2 = [number, number];

export type Easing = (t: number) => number;

export type StrokeOptions = {
  size?: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
  easing?: Easing;
  simulatePressure?: boolean;
  start?: { cap?: boolean; taper?: number | boolean; easing?: Easing };
  end?: { cap?: boolean; taper?: number | boolean; easing?: Easing };
  last?: boolean;
};

export type StrokePoint = {
  point: Vec2;
  pressure: number;
  distance: number;
  vector: Vec2;
  runningLength: number;
};

export const RATE_OF_PRESSURE_CHANGE = 0.275;
export const FIXED_PI = Math.PI + 0.0001;
export const DEFAULT_PRESSURE = 0.5;
export const DEFAULT_FIRST_PRESSURE = 0.25;
export const MIN_STREAMLINE_T = 0.15;
export const STREAMLINE_T_RANGE = 0.85;
export const MIN_RADIUS = 0.01;
export const END_NOISE_THRESHOLD = 3;
export const CORNER_CAP_SEGMENTS = 13;
export const START_CAP_SEGMENTS = 13;
export const END_CAP_SEGMENTS = 29;
export const CORNER_STEP = 1 / 13;

export function linear(t: number): number {
  'worklet';
  return t;
}

export function startTaperEase(t: number): number {
  'worklet';
  return t * (2 - t);
}

export function endTaperEase(t: number): number {
  'worklet';
  const u = t - 1;
  return u * u * u + 1;
}

export function getStrokeRadius(size: number, thinning: number, pressure: number, easing: Easing): number {
  'worklet';
  return size * easing(0.5 - thinning * (0.5 - pressure));
}

export function simulatePressure(prevPressure: number, distance: number, size: number): number {
  'worklet';
  const sp = Math.min(1, distance / size);
  const rp = Math.min(1, 1 - sp);
  return Math.min(1, prevPressure + (rp - prevPressure) * (sp * RATE_OF_PRESSURE_CHANGE));
}

export function neg(a: number[]): Vec2 {
  'worklet';
  return [-a[0], -a[1]];
}

export function add(a: number[], b: number[]): Vec2 {
  'worklet';
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a: number[], b: number[]): Vec2 {
  'worklet';
  return [a[0] - b[0], a[1] - b[1]];
}

export function mul(a: number[], n: number): Vec2 {
  'worklet';
  return [a[0] * n, a[1] * n];
}

export function div(a: number[], n: number): Vec2 {
  'worklet';
  return [a[0] / n, a[1] / n];
}

export function per(a: number[]): Vec2 {
  'worklet';
  return [a[1], -a[0]];
}

export function dpr(a: number[], b: number[]): number {
  'worklet';
  return a[0] * b[0] + a[1] * b[1];
}

export function isEqual(a: number[], b: number[]): boolean {
  'worklet';
  return a[0] === b[0] && a[1] === b[1];
}

export function len(a: number[]): number {
  'worklet';
  return Math.hypot(a[0], a[1]);
}

export function dist2(a: number[], b: number[]): number {
  'worklet';
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  return x * x + y * y;
}

export function uni(a: number[]): Vec2 {
  'worklet';
  return div(a, len(a));
}

export function dist(a: number[], b: number[]): number {
  'worklet';
  return Math.hypot(a[1] - b[1], a[0] - b[0]);
}

export function rotAround(a: number[], c: number[], r: number): Vec2 {
  'worklet';
  const s = Math.sin(r);
  const co = Math.cos(r);
  const px = a[0] - c[0];
  const py = a[1] - c[1];
  const nx = px * co - py * s;
  const ny = px * s + py * co;
  return [nx + c[0], ny + c[1]];
}

export function lrp(a: number[], b: number[], t: number): Vec2 {
  'worklet';
  return add(a, mul(sub(b, a), t));
}

export function prj(a: number[], b: number[], c: number): Vec2 {
  'worklet';
  return add(a, mul(b, c));
}

export function drawDot(center: number[], radius: number): Vec2[] {
  'worklet';
  const offset = prj(center, uni(per(sub(center, add(center, [1, 1])))), -radius);
  const dot: Vec2[] = [];
  const step = 1 / CORNER_CAP_SEGMENTS;
  for (let t = step; t <= 1; t += step) {
    dot.push(rotAround(offset, center, FIXED_PI * 2 * t));
  }
  return dot;
}

export function drawRoundStartCap(center: number[], rightPoint: number[], segments: number): Vec2[] {
  'worklet';
  const cap: Vec2[] = [];
  const step = 1 / segments;
  for (let t = step; t <= 1; t += step) {
    cap.push(rotAround(rightPoint, center, FIXED_PI * t));
  }
  return cap;
}

export function drawFlatStartCap(center: number[], leftPoint: number[], rightPoint: number[]): Vec2[] {
  'worklet';
  const side = sub(leftPoint, rightPoint);
  const a = mul(side, 0.5);
  const b = mul(side, 0.51);
  return [sub(center, a), sub(center, b), add(center, b), add(center, a)];
}

export function drawRoundEndCap(center: number[], direction: number[], radius: number, segments: number): Vec2[] {
  'worklet';
  const cap: Vec2[] = [];
  const start = prj(center, direction, radius);
  const step = 1 / segments;
  for (let t = step; t < 1; t += step) {
    cap.push(rotAround(start, center, FIXED_PI * 3 * t));
  }
  return cap;
}

export function drawFlatEndCap(center: number[], direction: number[], radius: number): Vec2[] {
  'worklet';
  return [
    add(center, mul(direction, radius)),
    add(center, mul(direction, radius * 0.99)),
    sub(center, mul(direction, radius * 0.99)),
    sub(center, mul(direction, radius)),
  ];
}

export function computeTaperDistance(taper: number | boolean | undefined, size: number, totalLength: number): number {
  'worklet';
  if (taper === false || taper === undefined) {
    return 0;
  }
  if (taper === true) {
    return Math.max(size, totalLength);
  }
  return taper;
}

export function computeInitialPressure(points: StrokePoint[], simulate: boolean, size: number): number {
  'worklet';
  let acc = points[0].pressure;
  const n = Math.min(points.length, 10);
  for (let i = 0; i < n; i++) {
    let pressure = points[i].pressure;
    if (simulate) {
      pressure = simulatePressure(acc, points[i].distance, size);
    }
    acc = (acc + pressure) / 2;
  }
  return acc;
}

export function getStrokeOutlinePoints(points: StrokePoint[], options: StrokeOptions = {}): Vec2[] {
  'worklet';
  const size = options.size ?? 16;
  const smoothing = options.smoothing ?? 0.5;
  const thinning = options.thinning ?? 0.5;
  const simulate = options.simulatePressure ?? true;
  const easing = options.easing ?? linear;
  const start = options.start ?? {};
  const end = options.end ?? {};
  const isComplete = options.last ?? false;
  const capStart = start.cap ?? true;
  const taperStartEase = start.easing ?? startTaperEase;
  const capEnd = end.cap ?? true;
  const taperEndEase = end.easing ?? endTaperEase;

  if (points.length === 0 || size <= 0) {
    return [];
  }

  const totalLength = points[points.length - 1].runningLength;
  const taperStart = computeTaperDistance(start.taper, size, totalLength);
  const taperEnd = computeTaperDistance(end.taper, size, totalLength);
  const minDistance = (size * smoothing) ** 2;
  const leftPts: Vec2[] = [];
  const rightPts: Vec2[] = [];
  let prevPressure = computeInitialPressure(points, simulate, size);
  let radius = getStrokeRadius(size, thinning, points[points.length - 1].pressure, easing);
  let firstRadius: number | undefined;
  let prevVector = points[0].vector;
  let prevLeftPoint = points[0].point;
  let prevRightPoint = prevLeftPoint;
  let tl: Vec2 = prevLeftPoint;
  let tr: Vec2 = prevRightPoint;
  let isPrevPointSharpCorner = false;

  for (let i = 0; i < points.length; i++) {
    let { pressure } = points[i];
    const { point, vector, distance, runningLength } = points[i];
    const isLast = i === points.length - 1;

    if (!isLast && totalLength - runningLength < END_NOISE_THRESHOLD) {
      continue;
    }

    if (thinning) {
      if (simulate) {
        pressure = simulatePressure(prevPressure, distance, size);
      }
      radius = getStrokeRadius(size, thinning, pressure, easing);
    } else {
      radius = size / 2;
    }

    if (firstRadius === undefined) {
      firstRadius = radius;
    }

    const ts = runningLength < taperStart ? taperStartEase(runningLength / taperStart) : 1;
    const te = totalLength - runningLength < taperEnd ? taperEndEase((totalLength - runningLength) / taperEnd) : 1;
    radius = Math.max(MIN_RADIUS, radius * Math.min(ts, te));

    const nextVector = (isLast ? points[i] : points[i + 1]).vector;
    const nextDpr = isLast ? 1 : dpr(vector, nextVector);
    const isSharpCorner = dpr(vector, prevVector) < 0 && !isPrevPointSharpCorner;
    const isNextSharpCorner = nextDpr !== null && nextDpr < 0;

    if (isSharpCorner || isNextSharpCorner) {
      const offset = mul(per(prevVector), radius);
      for (let t = 0; t <= 1; t += CORNER_STEP) {
        tl = rotAround(sub(point, offset), point, FIXED_PI * t);
        leftPts.push(tl);
        tr = rotAround(add(point, offset), point, FIXED_PI * -t);
        rightPts.push(tr);
      }
      prevLeftPoint = tl;
      prevRightPoint = tr;
      if (isNextSharpCorner) {
        isPrevPointSharpCorner = true;
      }
      continue;
    }

    isPrevPointSharpCorner = false;

    if (isLast) {
      const offset = mul(per(vector), radius);
      leftPts.push(sub(point, offset));
      rightPts.push(add(point, offset));
      continue;
    }

    const offset = mul(per(lrp(nextVector, vector, nextDpr)), radius);

    tl = sub(point, offset);
    if (i <= 1 || dist2(prevLeftPoint, tl) > minDistance) {
      leftPts.push(tl);
      prevLeftPoint = tl;
    }

    tr = add(point, offset);
    if (i <= 1 || dist2(prevRightPoint, tr) > minDistance) {
      rightPts.push(tr);
      prevRightPoint = tr;
    }

    prevPressure = pressure;
    prevVector = vector;
  }

  const firstPoint: Vec2 = [points[0].point[0], points[0].point[1]];
  const lastPoint: Vec2 =
    points.length > 1
      ? [points[points.length - 1].point[0], points[points.length - 1].point[1]]
      : add(points[0].point, [1, 1]);

  const startCap: Vec2[] = [];
  const endCap: Vec2[] = [];

  if (points.length === 1) {
    if (!(taperStart || taperEnd) || isComplete) {
      return drawDot(firstPoint, firstRadius || radius);
    }
  } else {
    if (taperStart || (taperEnd && points.length === 1)) {
      // The start point is tapered, so noop.
    } else if (capStart) {
      startCap.push(...drawRoundStartCap(firstPoint, rightPts[0], START_CAP_SEGMENTS));
    } else {
      startCap.push(...drawFlatStartCap(firstPoint, leftPts[0], rightPts[0]));
    }
    const direction = per(neg(points[points.length - 1].vector));
    if (taperEnd || (taperStart && points.length === 1)) {
      endCap.push(lastPoint);
    } else if (capEnd) {
      endCap.push(...drawRoundEndCap(lastPoint, direction, radius, END_CAP_SEGMENTS));
    } else {
      endCap.push(...drawFlatEndCap(lastPoint, direction, radius));
    }
  }

  return leftPts.concat(endCap, rightPts.reverse(), startCap);
}

export function getStrokePoints(input: number[][], options: StrokeOptions = {}): StrokePoint[] {
  'worklet';
  const streamline = options.streamline ?? 0.5;
  const size = options.size ?? 16;
  const isComplete = options.last ?? false;

  if (input.length === 0) {
    return [];
  }

  const t = MIN_STREAMLINE_T + (1 - streamline) * STREAMLINE_T_RANGE;
  let pts = input;

  if (pts.length === 2) {
    const last = pts[1];
    pts = pts.slice(0, -1);
    for (let i = 1; i < 5; i++) {
      pts.push(lrp(pts[0], last, i / 4));
    }
  }

  if (pts.length === 1) {
    pts = [...pts, [...add(pts[0], [1, 1]), ...pts[0].slice(2)]];
  }

  const strokePoints: StrokePoint[] = [
    {
      point: [pts[0][0], pts[0][1]],
      pressure: pts[0][2] != null && pts[0][2] >= 0 ? pts[0][2] : DEFAULT_FIRST_PRESSURE,
      vector: [1, 1],
      distance: 0,
      runningLength: 0,
    },
  ];

  let hasReachedMinimumLength = false;
  let runningLength = 0;
  let prev = strokePoints[0];
  const max = pts.length - 1;

  for (let i = 1; i < pts.length; i++) {
    const point: Vec2 = isComplete && i === max ? [pts[i][0], pts[i][1]] : lrp(prev.point, pts[i], t);
    if (isEqual(prev.point, point)) {
      continue;
    }
    const distance = dist(point, prev.point);
    runningLength += distance;
    if (i < max && !hasReachedMinimumLength) {
      if (runningLength < size) {
        continue;
      }
      hasReachedMinimumLength = true;
    }
    prev = {
      point,
      pressure: pts[i][2] != null && pts[i][2] >= 0 ? pts[i][2] : DEFAULT_PRESSURE,
      vector: uni(sub(prev.point, point)),
      distance,
      runningLength,
    };
    strokePoints.push(prev);
  }

  strokePoints[0].vector = strokePoints[1]?.vector || [0, 0];
  return strokePoints;
}

export function getStroke(points: number[][], options: StrokeOptions = {}): Vec2[] {
  'worklet';
  return getStrokeOutlinePoints(getStrokePoints(points, options), options);
}
