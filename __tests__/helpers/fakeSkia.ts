/** Just enough of Skia to run the render layer on Node. Paths and pictures are plain lists of what was drawn. */

export type Verb =
  | ['move', number, number]
  | ['line', number, number]
  | ['quad', number, number, number, number]
  | ['close'];

export type FakePath = { verbs: Verb[] };

export type FakePicture = { draws: unknown[]; id: number };

function makeBuilder(start: Verb[]) {
  const verbs = [...start];
  const builder = {
    moveTo(x: number, y: number) {
      verbs.push(['move', x, y]);
      return builder;
    },
    lineTo(x: number, y: number) {
      verbs.push(['line', x, y]);
      return builder;
    },
    quadTo(a: number, b: number, c: number, d: number) {
      verbs.push(['quad', a, b, c, d]);
      return builder;
    },
    close() {
      verbs.push(['close']);
      return builder;
    },
    build(): FakePath {
      return { verbs: [...verbs] };
    },
  };
  return builder;
}

export const counters = { pictures: 0, drawPath: 0 };

function makeRecorder() {
  const draws: unknown[] = [];
  const canvas = {
    drawPath(path: FakePath, paint: unknown) {
      counters.drawPath++;
      draws.push({ path, paint });
    },
    drawPicture(picture: FakePicture) {
      draws.push({ picture });
    },
    drawRect() {},
    drawImageRect() {},
    drawLine() {},
    drawCircle(x: number, y: number, r: number, paint: { alpha?: number }) {
      draws.push({ circle: [x, y, r], alpha: paint.alpha ?? 1 });
    },
    save() {
      draws.push({ save: true });
    },
    restore() {
      draws.push({ restore: true });
    },
    concat(matrix: unknown) {
      draws.push({ concat: matrix });
    },
  };
  return {
    beginRecording: () => canvas,
    finishRecordingAsPicture(): FakePicture {
      counters.pictures++;
      const picture = { draws, id: counters.pictures };
      return Object.assign(picture, { makeShader: (...args: unknown[]) => ({ shader: 'picture', picture, args }) });
    },
  };
}

function makePaint() {
  const paint: Record<string, unknown> = {};
  const noop = () => {};
  ['setAntiAlias', 'setBlendMode', 'setColor', 'setStyle', 'setStrokeWidth'].forEach(name => {
    paint[name] = noop;
  });
  ['setStrokeCap', 'setStrokeJoin'].forEach(name => {
    paint[name] = noop;
  });
  paint.setAlphaf = (alpha: number) => {
    paint.alpha = alpha;
  };
  paint.setShader = (shader: unknown) => {
    paint.shader = shader;
  };
  paint.setMaskFilter = (filter: unknown) => {
    paint.maskFilter = filter;
  };
  return paint;
}

export const Skia = {
  PathBuilder: {
    Make: () => makeBuilder([]),
    MakeFromPath: (path: FakePath) => makeBuilder(path.verbs),
  },
  Path: { Oval: () => ({ verbs: [] }), Rect: () => ({ verbs: [] }) },
  PictureRecorder: makeRecorder,
  Paint: makePaint,
  Matrix: (values?: readonly number[]) => ({ values, rotate: () => {} }),
  RuntimeEffect: {
    Make: (source: string) => ({ source, makeShader: (uniforms: number[]) => ({ shader: 'runtime', uniforms }) }),
  },
  Shader: {
    MakeBlend: (mode: number, one: unknown, two: unknown) => ({ shader: 'blend', mode, one, two }),
    MakeColor: (color: unknown) => ({ shader: 'color', color }),
  },
  MaskFilter: { MakeBlur: (style: number, sigma: number, respectCTM: boolean) => ({ blur: sigma, style, respectCTM }) },
  Color: (value: string) => value,
  XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
};

export const AlphaType = {};
export const BlendMode = { Clear: 0, SrcIn: 5, DstIn: 6, SrcOut: 7, DstOut: 8 };
export const BlurStyle = { Normal: 0 };
export const ColorType = {};
export const FilterMode = {};
export const PaintStyle = { Fill: 0, Stroke: 1 };
export const StrokeCap = { Round: 1 };
export const StrokeJoin = { Miter: 0, Round: 1 };
export const TileMode = {};

/** Shoelace area of every closed contour, with quads flattened. Cross edges of opposite direction cancel out. */
export function signedArea(path: FakePath): number {
  let area = 0;
  let start: number[] = [0, 0];
  let last: number[] = [0, 0];
  const edge = (x: number, y: number) => {
    area += last[0] * y - x * last[1];
    last = [x, y];
  };
  for (const verb of path.verbs) {
    if (verb[0] === 'move') {
      start = [verb[1], verb[2]];
      last = start;
    } else if (verb[0] === 'line') {
      edge(verb[1], verb[2]);
    } else if (verb[0] === 'quad') {
      const [, cx, cy, x, y] = verb;
      const [x0, y0] = last;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        edge(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
      }
    } else {
      edge(start[0], start[1]);
    }
  }
  return area / 2;
}
