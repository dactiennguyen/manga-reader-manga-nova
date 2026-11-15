/**
 * Guide strokes for the drawing lessons, as plain polylines in page units. Curves are sampled into short
 * segments here, so drawing, scoring and testing all read the same points.
 */

/** The practice page: a 3:4 sheet, the shape of a manga page. */
export const PAGE_W = 900;
export const PAGE_H = 1200;

/** One stroke of a guide: x, y pairs in page units, in the order the stroke is drawn. */
export type GuideStroke = { points: number[] };

export type Box = { x: number; y: number; w: number; h: number };

const round = (value: number) => Math.round(value * 10) / 10;

function stroke(points: number[]): GuideStroke {
  return { points: points.map(round) };
}

/** Straight line, drawn from the first point to the second. */
export function line(x0: number, y0: number, x1: number, y1: number): GuideStroke {
  return stroke([x0, y0, x1, y1]);
}

/** Straight segments through every point given: poly(x0, y0, x1, y1, …). */
export function poly(...xy: number[]): GuideStroke {
  return stroke(xy);
}

/**
 * Part of an ellipse. Angles are in degrees, 0 points right and 90 points down (screen coordinates), and the
 * stroke runs from `from` to `to`. `rotate` turns the whole ellipse around its centre.
 */
export function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, rotate = 0): GuideStroke {
  const segments = Math.max(6, Math.ceil(Math.abs(to - from) / 8));
  const turn = (rotate * Math.PI) / 180;
  const out: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = ((from + ((to - from) * i) / segments) * Math.PI) / 180;
    const x = rx * Math.cos(angle);
    const y = ry * Math.sin(angle);
    out.push(cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn));
  }
  return stroke(out);
}

/** A whole ellipse, starting at the top and going clockwise, as a hand usually draws one. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rotate = 0): GuideStroke {
  return arc(cx, cy, rx, ry, -90, 270, rotate);
}

export function circle(cx: number, cy: number, r: number): GuideStroke {
  return ellipse(cx, cy, r, r);
}

/** Cubic Bézier from (x0, y0) to (x3, y3). */
export function cubic(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): GuideStroke {
  const segments = 20;
  const out: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    out.push(
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    );
  }
  return stroke(out);
}

/** Quadratic Bézier from (x0, y0) through the pull of (cx, cy) to (x1, y1). */
export function quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): GuideStroke {
  return cubic(x0, y0, x0 + ((cx - x0) * 2) / 3, y0 + ((cy - y0) * 2) / 3, x1 + ((cx - x1) * 2) / 3, y1 + ((cy - y1) * 2) / 3, x1, y1);
}

/** A rectangle with round corners, drawn as one closed stroke from the top left. */
export function roundRect(x: number, y: number, w: number, h: number, r: number): GuideStroke {
  const corner = (cx: number, cy: number, from: number) => arc(cx, cy, r, r, from, from + 90).points;
  return stroke([
    ...corner(x + r, y + r, 180),
    ...corner(x + w - r, y + r, 270),
    ...corner(x + w - r, y + h - r, 0),
    ...corner(x + r, y + h - r, 90),
    x,
    y + r,
  ]);
}

/** A tube with round ends around the line from (x0, y0) to (x1, y1): a finger, for example. */
export function capsule(x0: number, y0: number, x1: number, y1: number, r: number): GuideStroke {
  const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  const end = arc(x1, y1, r, r, angle - 90, angle + 90).points;
  const start = arc(x0, y0, r, r, angle + 90, angle + 270).points;
  return stroke([...end, ...start, end[0], end[1]]);
}

/** The point where line a-b crosses line c-d, or null when they run parallel. */
export function intersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): [number, number] | null {
  const denominator = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
  if (Math.abs(denominator) < 1e-9) {
    return null;
  }
  const t = ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / denominator;
  return [ax + t * (bx - ax), ay + t * (by - ay)];
}

/** The point a fraction `t` of the way from (x0, y0) to (x1, y1). */
export function along(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

/** The same strokes mirrored across the vertical line x = `axis`: the other eye of a pair. */
export function mirrored(strokes: GuideStroke[], axis = PAGE_W / 2): GuideStroke[] {
  return strokes.map(item => stroke(item.points.map((value, index) => (index % 2 === 0 ? 2 * axis - value : value))));
}

/** The smallest box holding every point, grown by `pad` on each side. Null when there are no points. */
export function boundsOf(strokes: readonly GuideStroke[], pad = 0): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of strokes) {
    for (let i = 0; i + 1 < item.points.length; i += 2) {
      minX = Math.min(minX, item.points[i]);
      maxX = Math.max(maxX, item.points[i]);
      minY = Math.min(minY, item.points[i + 1]);
      maxY = Math.max(maxY, item.points[i + 1]);
    }
  }
  if (minX === Infinity) {
    return null;
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

/** How to draw `box` as large as fits in a w×h view, centred: scale first, then the offset in view pixels. */
export function fitBox(box: Box, w: number, h: number): { scale: number; x: number; y: number } {
  const scale = Math.min(w / Math.max(1, box.w), h / Math.max(1, box.h));
  return { scale, x: (w - box.w * scale) / 2 - box.x * scale, y: (h - box.h * scale) / 2 - box.y * scale };
}

/** Total length of the strokes, in page units. */
export function lengthOf(strokes: readonly GuideStroke[]): number {
  let total = 0;
  for (const item of strokes) {
    for (let i = 2; i + 1 < item.points.length; i += 2) {
      total += Math.hypot(item.points[i] - item.points[i - 2], item.points[i + 1] - item.points[i - 1]);
    }
  }
  return total;
}
