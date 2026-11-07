import {
  CORNER_STEP,
  DEFAULT_FIRST_PRESSURE,
  DEFAULT_PRESSURE,
  END_CAP_SEGMENTS,
  END_NOISE_THRESHOLD,
  FIXED_PI,
  MIN_RADIUS,
  MIN_STREAMLINE_T,
  START_CAP_SEGMENTS,
  STREAMLINE_T_RANGE,
  add,
  computeInitialPressure,
  dist,
  dist2,
  dpr,
  drawFlatEndCap,
  drawFlatStartCap,
  drawRoundEndCap,
  drawRoundStartCap,
  endTaperEase,
  getStroke,
  getStrokeRadius,
  isEqual,
  linear,
  lrp,
  mul,
  neg,
  per,
  rotAround,
  simulatePressure,
  startTaperEase,
  sub,
  uni,
  type Easing,
  type StrokeOptions,
  type StrokePoint,
  type Vec2,
} from './freehand';

/**
 * perfect-freehand's outline, computed as a stroke grows. Every point is a running function of the points
 * before it, except near the end, where the end taper and the look-ahead depend on the total length.
 * So the outline splits into a baked prefix that can never change and a short tail redone per event.
 * The result equals getStroke() on the same input; __tests__/liveOutline.test.ts holds that.
 */

/** computeInitialPressure reads the first ten points, so nothing bakes until they are final. */
const BAKE_MIN_POINTS = 12;

type Cursor = {
  index: number;
  prevPressure: number;
  prevVector: Vec2;
  prevLeft: Vec2;
  prevRight: Vec2;
  tl: Vec2;
  tr: Vec2;
  sharp: boolean;
  radius: number;
};

type Resolved = {
  size: number;
  thinning: number;
  minDistance: number;
  simulate: boolean;
  easing: Easing;
  startEase: Easing;
  endEase: Easing;
  taperStart: number;
  taperEnd: number;
  capStart: boolean;
  capEnd: boolean;
};

export type LiveOutline = {
  options: StrokeOptions;
  resolved: Resolved;
  streamT: number;
  input: number[][];
  /** Streamlined points that no later input can change. */
  points: StrokePoint[];
  running: number;
  reached: boolean;
  /** Input points already folded into `points`. */
  folded: number;
  cursor: Cursor | null;
  /** Baked sides, in stroke order. Only ever appended to. */
  left: Vec2[];
  right: Vec2[];
};

/** What is not baked. The stroke's whole outline is left, tailLeft, endCap, reversed tailRight and right, startCap. */
export type LiveTail = { tailLeft: Vec2[]; tailRight: Vec2[]; endCap: Vec2[]; startCap: Vec2[] };

export function createLiveOutline(options: StrokeOptions): LiveOutline {
  'worklet';
  const size = options.size ?? 16;
  const start = options.start ?? {};
  const end = options.end ?? {};
  return {
    options,
    resolved: {
      size,
      thinning: options.thinning ?? 0.5,
      minDistance: (size * (options.smoothing ?? 0.5)) ** 2,
      simulate: options.simulatePressure ?? true,
      easing: options.easing ?? linear,
      startEase: start.easing ?? startTaperEase,
      endEase: end.easing ?? endTaperEase,
      // Numeric tapers only: `true` would make every point depend on the total length.
      taperStart: typeof start.taper === 'number' ? start.taper : 0,
      taperEnd: typeof end.taper === 'number' ? end.taper : 0,
      capStart: start.cap ?? true,
      capEnd: end.cap ?? true,
    },
    streamT: MIN_STREAMLINE_T + (1 - (options.streamline ?? 0.5)) * STREAMLINE_T_RANGE,
    input: [],
    points: [],
    running: 0,
    reached: false,
    folded: 0,
    cursor: null,
    left: [],
    right: [],
  };
}

function pressureOf(point: number[], fallback: number): number {
  'worklet';
  return point[2] != null && point[2] >= 0 ? point[2] : fallback;
}

/** One getStrokePoints iteration for an input point that is not the last. */
function foldInput(live: LiveOutline, index: number): void {
  'worklet';
  const { points, input } = live;
  if (index === 0) {
    points.push({
      point: [input[0][0], input[0][1]],
      pressure: pressureOf(input[0], DEFAULT_FIRST_PRESSURE),
      vector: [1, 1],
      distance: 0,
      runningLength: 0,
    });
    return;
  }
  const prev = points[points.length - 1];
  const point = lrp(prev.point, input[index], live.streamT);
  if (isEqual(prev.point, point)) {
    return;
  }
  const distance = dist(point, prev.point);
  live.running += distance;
  if (!live.reached) {
    if (live.running < live.resolved.size) {
      return;
    }
    live.reached = true;
  }
  points.push({
    point,
    pressure: pressureOf(input[index], DEFAULT_PRESSURE),
    vector: uni(sub(prev.point, point)),
    distance,
    runningLength: live.running,
  });
  if (points.length === 2) {
    points[0].vector = points[1].vector;
  }
}

/** The iteration for the last input point, which is provisional until another point follows it. */
function lastPoint(live: LiveOutline): StrokePoint | null {
  'worklet';
  const prev = live.points[live.points.length - 1];
  const input = live.input[live.input.length - 1];
  const point = lrp(prev.point, input, live.streamT);
  if (isEqual(prev.point, point)) {
    return null;
  }
  const distance = dist(point, prev.point);
  return {
    point,
    pressure: pressureOf(input, DEFAULT_PRESSURE),
    vector: uni(sub(prev.point, point)),
    distance,
    runningLength: live.running + distance,
  };
}

function firstCursor(live: LiveOutline): Cursor {
  'worklet';
  const { points, resolved } = live;
  const first = points[0];
  return {
    index: 0,
    prevPressure: computeInitialPressure(points, resolved.simulate, resolved.size),
    prevVector: first.vector,
    prevLeft: first.point,
    prevRight: first.point,
    tl: first.point,
    tr: first.point,
    sharp: false,
    radius: 0,
  };
}

/** One getStrokeOutlinePoints iteration. Writes to the given sides and advances the cursor in place. */
function outlineStep(
  c: Cursor,
  o: Resolved,
  point: StrokePoint,
  next: StrokePoint | null,
  total: number,
  left: Vec2[],
  right: Vec2[],
): void {
  'worklet';
  const index = c.index;
  c.index = index + 1;
  const isLast = next === null;
  const { vector, distance, runningLength } = point;
  let { pressure } = point;

  if (!isLast && total - runningLength < END_NOISE_THRESHOLD) {
    return;
  }

  let radius: number;
  if (o.thinning) {
    if (o.simulate) {
      pressure = simulatePressure(c.prevPressure, distance, o.size);
    }
    radius = getStrokeRadius(o.size, o.thinning, pressure, o.easing);
  } else {
    radius = o.size / 2;
  }

  const ts = runningLength < o.taperStart ? o.startEase(runningLength / o.taperStart) : 1;
  const te = total - runningLength < o.taperEnd ? o.endEase((total - runningLength) / o.taperEnd) : 1;
  radius = Math.max(MIN_RADIUS, radius * Math.min(ts, te));
  c.radius = radius;

  const nextVector = next === null ? vector : next.vector;
  const nextDpr = isLast ? 1 : dpr(vector, nextVector);
  const isSharpCorner = dpr(vector, c.prevVector) < 0 && !c.sharp;
  const isNextSharpCorner = nextDpr < 0;

  if (isSharpCorner || isNextSharpCorner) {
    const offset = mul(per(c.prevVector), radius);
    for (let t = 0; t <= 1; t += CORNER_STEP) {
      c.tl = rotAround(sub(point.point, offset), point.point, FIXED_PI * t);
      left.push(c.tl);
      c.tr = rotAround(add(point.point, offset), point.point, FIXED_PI * -t);
      right.push(c.tr);
    }
    c.prevLeft = c.tl;
    c.prevRight = c.tr;
    if (isNextSharpCorner) {
      c.sharp = true;
    }
    return;
  }

  c.sharp = false;

  if (isLast) {
    const offset = mul(per(vector), radius);
    left.push(sub(point.point, offset));
    right.push(add(point.point, offset));
    return;
  }

  const offset = mul(per(lrp(nextVector, vector, nextDpr)), radius);

  c.tl = sub(point.point, offset);
  if (index <= 1 || dist2(c.prevLeft, c.tl) > o.minDistance) {
    left.push(c.tl);
    c.prevLeft = c.tl;
  }

  c.tr = add(point.point, offset);
  if (index <= 1 || dist2(c.prevRight, c.tr) > o.minDistance) {
    right.push(c.tr);
    c.prevRight = c.tr;
  }

  c.prevPressure = pressure;
  c.prevVector = vector;
}

function bake(live: LiveOutline, total: number): void {
  'worklet';
  const { points, resolved } = live;
  if (points.length < BAKE_MIN_POINTS) {
    return;
  }
  const cursor = live.cursor ?? firstCursor(live);
  live.cursor = cursor;
  const safe = Math.max(resolved.taperEnd, END_NOISE_THRESHOLD);
  while (cursor.index < points.length - 1 && total - points[cursor.index].runningLength >= safe) {
    outlineStep(cursor, resolved, points[cursor.index], points[cursor.index + 1], total, live.left, live.right);
  }
}

/** Adds a point as [x, y] or [x, y, pressure], and bakes whatever became final. */
export function addLivePoint(live: LiveOutline, point: number[]): void {
  'worklet';
  live.input.push(point);
  const n = live.input.length;
  // getStrokePoints treats one and two points specially, so folding starts at three.
  if (n >= 3) {
    for (let i = live.folded; i < n - 1; i++) {
      foldInput(live, i);
    }
    live.folded = n - 1;
    const last = lastPoint(live);
    bake(live, last ? last.runningLength : live.points[live.points.length - 1].runningLength);
  }
}

export function isBaked(live: LiveOutline): boolean {
  'worklet';
  return live.cursor !== null;
}

/** The part of the outline after the baked prefix. Only meaningful once isBaked. */
export function readLiveTail(live: LiveOutline): LiveTail {
  'worklet';
  const { points, resolved } = live;
  const cursor = live.cursor as Cursor;
  const last = lastPoint(live);
  const count = points.length + (last ? 1 : 0);
  const end = last ?? points[points.length - 1];
  const total = end.runningLength;
  const c: Cursor = { ...cursor };
  const tailLeft: Vec2[] = [];
  const tailRight: Vec2[] = [];
  const at = (i: number): StrokePoint => (i < points.length ? points[i] : (last as StrokePoint));

  while (c.index < count) {
    const i = c.index;
    outlineStep(c, resolved, at(i), i + 1 < count ? at(i + 1) : null, total, tailLeft, tailRight);
  }

  const first = points[0].point;
  const firstLeft = live.left[0] ?? tailLeft[0];
  const firstRight = live.right[0] ?? tailRight[0];
  const startCap: Vec2[] = [];
  if (!resolved.taperStart) {
    if (resolved.capStart) {
      startCap.push(...drawRoundStartCap(first, firstRight, START_CAP_SEGMENTS));
    } else {
      startCap.push(...drawFlatStartCap(first, firstLeft, firstRight));
    }
  }
  const direction = per(neg(end.vector));
  const lastPt: Vec2 = [end.point[0], end.point[1]];
  const endCap: Vec2[] = [];
  if (resolved.taperEnd) {
    endCap.push(lastPt);
  } else if (resolved.capEnd) {
    endCap.push(...drawRoundEndCap(lastPt, direction, c.radius, END_CAP_SEGMENTS));
  } else {
    endCap.push(...drawFlatEndCap(lastPt, direction, c.radius));
  }
  return { tailLeft, tailRight, endCap, startCap };
}

/** The whole outline as a flat list. O(n): for early points and for tests, not for every event. */
export function readLiveOutline(live: LiveOutline): Vec2[] {
  'worklet';
  if (!isBaked(live)) {
    return getStroke(live.input, live.options);
  }
  const tail = readLiveTail(live);
  const right = live.right.concat(tail.tailRight).reverse();
  return live.left.concat(tail.tailLeft, tail.endCap, right, tail.startCap);
}
