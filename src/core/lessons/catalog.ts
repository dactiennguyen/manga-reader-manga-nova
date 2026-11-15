/**
 * The drawing lessons: short courses for beginners, each lesson a few steps to trace. Every guide is drawn
 * here from simple shapes, so nothing is a bitmap and nothing looks generated: clean ink lines only.
 *
 * Lesson and step ids are saved with the person's progress, so they never change. A new lesson gets a new id.
 */
import { msg } from '../i18n';
import {
  PAGE_H,
  PAGE_W,
  along,
  arc,
  capsule,
  circle,
  cubic,
  ellipse,
  intersect,
  line,
  mirrored,
  poly,
  quad,
  roundRect,
  type GuideStroke,
} from './shapes';

export type LessonStep = {
  /** Unique inside its lesson. */
  id: string;
  /** msg() text: one short instruction. */
  text: string;
  /** What to trace in this step. */
  guide: GuideStroke[];
};

export type Lesson = {
  id: string;
  courseId: CourseId;
  /** msg() text. */
  title: string;
  /** Each step adds to the drawing of the steps before it, which stays on the page as context. */
  build: boolean;
  steps: LessonStep[];
};

export type CourseId = 'lines' | 'eyes' | 'faces' | 'hands' | 'perspective' | 'effects';

export type Course = { id: CourseId; title: string; lessons: Lesson[] };

const step = (id: string, text: string, guide: GuideStroke[]): LessonStep => ({ id, text, guide });

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

// Lines and pen control

const straightLines: Omit<Lesson, 'courseId'> = {
  id: 'lines-straight',
  title: msg('Straight lines'),
  build: false,
  steps: [
    step('a', msg('Draw each line in one steady stroke, left to right.'), range(5).map(i => line(150, 300 + i * 150, 750, 300 + i * 150))),
    step('b', msg('Now vertical lines, top to bottom.'), range(5).map(i => line(210 + i * 120, 250, 210 + i * 120, 950))),
    step('c', msg('Diagonals. Move your whole arm, not just the wrist.'), range(3).map(i => line(150, 250 + i * 250, 750, 500 + i * 250))),
  ],
};

const curves: Omit<Lesson, 'courseId'> = {
  id: 'lines-curves',
  title: msg('Curves and circles'),
  build: false,
  steps: [
    step('a', msg('Smooth arcs, like little hills.'), range(3).map(i => arc(450, 380 + i * 250, 240, 110, 200, 340))),
    step('b', msg('Ovals: keep the stroke going all the way round.'), [
      ellipse(450, 330, 250, 110),
      ellipse(450, 610, 210, 110, -15),
      ellipse(450, 890, 150, 110),
    ]),
    step('c', msg('Circles. Two or three light passes are fine.'), [circle(280, 420, 130), circle(620, 420, 130), circle(450, 800, 180)]),
  ],
};

const hatching: Omit<Lesson, 'courseId'> = {
  id: 'lines-hatching',
  title: msg('Hatching'),
  build: false,
  steps: [
    step('a', msg('Short lines, all in the same direction.'), range(9).map(i => line(200 + i * 50, 600, 300 + i * 50, 300))),
    step('b', msg('Cross-hatching: add a second layer across the first.'), [
      ...range(8).map(i => line(200 + i * 55, 1000, 300 + i * 55, 700)),
      ...range(8).map(i => line(200 + i * 55, 700, 300 + i * 55, 1000)),
    ]),
  ],
};

// Eyes

const eye = {
  upper: cubic(240, 600, 300, 480, 560, 450, 670, 560),
  lower: cubic(320, 690, 420, 735, 560, 725, 640, 640),
  iris: ellipse(450, 590, 85, 120),
};

const simpleEye: Omit<Lesson, 'courseId'> = {
  id: 'eyes-simple',
  title: msg('A simple eye'),
  build: true,
  steps: [
    step('a', msg('Upper lash line: one confident curve.'), [eye.upper]),
    step('b', msg('Lower lid: a short, light curve.'), [eye.lower]),
    step('c', msg('Iris: a tall oval touching the upper line.'), [eye.iris]),
    step('d', msg('Pupil, then a small circle for the shine.'), [ellipse(455, 605, 38, 55), circle(412, 540, 22)]),
  ],
};

/** The viewer's right eye of a pair; the left one is its mirror. */
const pairEye = {
  upper: cubic(550, 600, 590, 520, 700, 505, 750, 570),
  lower: cubic(580, 650, 630, 672, 700, 667, 735, 625),
  brow: cubic(540, 470, 600, 420, 700, 415, 770, 450),
};

const eyePair: Omit<Lesson, 'courseId'> = {
  id: 'eyes-pair',
  title: msg('A pair of eyes'),
  build: true,
  steps: [
    step('a', msg('Place both eyes one eye-width apart.'), [pairEye.upper, pairEye.lower, ...mirrored([pairEye.upper, pairEye.lower])]),
    // Not mirrored: both irises look the same way.
    step('b', msg('Irises, both looking the same way.'), [ellipse(660, 597, 42, 60), ellipse(260, 597, 42, 60)]),
    step('c', msg('Brows follow the curve of each eye.'), [pairEye.brow, ...mirrored([pairEye.brow])]),
  ],
};

const angryLid = cubic(170, 610, 220, 575, 310, 575, 360, 600);

const eyeMoods: Omit<Lesson, 'courseId'> = {
  id: 'eyes-moods',
  title: msg('Eye expressions'),
  build: false,
  steps: [
    step('a', msg('Happy: closed eyes curve upward.'), [arc(250, 640, 95, 70, 200, 340), arc(650, 640, 95, 70, 200, 340)]),
    step('b', msg('Angry: brows slant down toward the nose.'), [
      line(150, 450, 370, 530),
      line(750, 450, 530, 530),
      angryLid,
      ...mirrored([angryLid]),
      circle(270, 625, 32),
      circle(630, 625, 32),
    ]),
    step('c', msg('Surprised: round eyes, small irises, raised brows.'), [
      circle(250, 640, 95),
      circle(650, 640, 95),
      circle(250, 640, 25),
      circle(650, 640, 25),
      arc(250, 470, 110, 45, 200, 340),
      arc(650, 470, 110, 45, 200, 340),
    ]),
  ],
};

// Faces

const skullText = msg('Start with a circle for the skull.');

const faceFront: Omit<Lesson, 'courseId'> = {
  id: 'face-front',
  title: msg('A face from the front'),
  build: true,
  steps: [
    step('a', skullText, [circle(450, 500, 230)]),
    step('b', msg('Jaw: two curves that meet at the chin.'), [
      cubic(220, 520, 240, 720, 360, 840, 450, 870),
      cubic(680, 520, 660, 720, 540, 840, 450, 870),
    ]),
    step('c', msg('A cross: the eye line runs through the middle.'), [line(450, 270, 450, 870), line(220, 570, 680, 570)]),
    step('d', msg('Eyes on the line, then a small nose and mouth.'), [
      ellipse(355, 580, 45, 30),
      ellipse(545, 580, 45, 30),
      poly(455, 655, 438, 705, 462, 710),
      quad(400, 775, 450, 800, 500, 775),
    ]),
  ],
};

const faceTurned: Omit<Lesson, 'courseId'> = {
  id: 'face-three-quarter',
  title: msg('A face at three-quarter view'),
  build: true,
  steps: [
    step('a', skullText, [circle(450, 500, 230)]),
    step('b', msg('Curve the center line toward the side the face turns.'), [
      cubic(520, 275, 600, 420, 610, 650, 560, 865),
      cubic(225, 545, 330, 595, 520, 605, 670, 560),
    ]),
    step('c', msg('Jaw: the near side is long, the far cheek is short.'), [
      cubic(225, 545, 260, 745, 400, 860, 560, 868),
      cubic(670, 560, 682, 660, 640, 780, 560, 868),
    ]),
    step('d', msg('Features follow the curve. The far eye is narrower.'), [
      ellipse(420, 605, 52, 32),
      ellipse(625, 595, 26, 30),
      poly(598, 640, 640, 705, 603, 714),
      quad(500, 785, 545, 800, 582, 778),
    ]),
  ],
};

const faceProfile: Omit<Lesson, 'courseId'> = {
  id: 'face-profile',
  title: msg('A face in profile'),
  build: true,
  steps: [
    step('a', skullText, [circle(480, 500, 220)]),
    step('b', msg('Profile: brow, nose, lips and chin in one line.'), [
      poly(272, 380, 255, 520, 205, 612, 247, 640, 240, 680, 258, 700, 246, 732, 276, 770, 292, 822, 450, 842, 565, 650),
    ]),
    step('c', msg('An eye near the front, the ear behind the middle.'), [poly(330, 548, 300, 565, 332, 580), ellipse(565, 590, 36, 62)]),
  ],
};

// Hands, kept to simple shapes

const handShapes: Omit<Lesson, 'courseId'> = {
  id: 'hand-shapes',
  title: msg('A hand from simple shapes'),
  build: true,
  steps: [
    step('a', msg('Palm: a rounded square.'), [roundRect(320, 620, 260, 260, 50)]),
    step('b', msg('Fingers: four tubes. The middle one is longest.'), [
      capsule(352, 610, 352, 400, 28),
      capsule(417, 610, 417, 350, 28),
      capsule(482, 610, 482, 375, 28),
      capsule(546, 615, 546, 440, 25),
    ]),
    step('c', msg('Thumb: a thicker tube from the side of the palm.'), [capsule(326, 800, 226, 640, 34)]),
  ],
};

const fist: Omit<Lesson, 'courseId'> = {
  id: 'hand-fist',
  title: msg('A fist'),
  build: true,
  steps: [
    step('a', msg('A fist starts as a box.'), [roundRect(300, 500, 300, 280, 40)]),
    step('b', msg('Knuckles: a row of four bumps on top.'), range(4).map(i => arc(337.5 + i * 75, 505, 37, 32, 180, 360))),
    step('c', msg('Mark the fingers, then wrap the thumb across.'), [
      line(375, 525, 375, 640),
      line(450, 525, 450, 640),
      line(525, 525, 525, 640),
      capsule(322, 690, 482, 650, 32),
    ]),
  ],
};

const pointing: Omit<Lesson, 'courseId'> = {
  id: 'hand-point',
  title: msg('A pointing hand'),
  build: true,
  steps: [
    step('a', msg('Start from a smaller fist box.'), [roundRect(330, 560, 260, 240, 40)]),
    step('b', msg('The index finger points straight up.'), [capsule(362, 575, 362, 300, 30)]),
    step('c', msg('Fold the thumb over the other fingers.'), [capsule(340, 700, 480, 662, 30), line(440, 575, 440, 640), line(515, 575, 515, 640)]),
  ],
};

// Perspective

const VP1: [number, number] = [300, 400];
// The point is to the left of the box, so the top and the left side show.
const front = { tl: [480, 650], tr: [760, 650], bl: [480, 930] } as const;
const back = (corner: readonly number[]) => along(corner[0], corner[1], VP1[0], VP1[1], 0.35);

const onePoint: Omit<Lesson, 'courseId'> = {
  id: 'persp-one-point',
  title: msg('A box in one-point perspective'),
  build: true,
  steps: [
    step('a', msg('A horizon line with one vanishing point.'), [line(80, 400, 820, 400), circle(VP1[0], VP1[1], 12)]),
    step('b', msg('The front of the box: a square below the horizon.'), [poly(480, 650, 760, 650, 760, 930, 480, 930, 480, 650)]),
    step('c', msg('Pull lines from the corners to the point.'), [
      line(front.tl[0], front.tl[1], VP1[0], VP1[1]),
      line(front.tr[0], front.tr[1], VP1[0], VP1[1]),
      line(front.bl[0], front.bl[1], VP1[0], VP1[1]),
    ]),
    step('d', msg('Close the box with the back edges.'), [poly(...back(front.bl), ...back(front.tl), ...back(front.tr))]),
  ],
};

const LEFT: [number, number] = [80, 350];
const RIGHT: [number, number] = [820, 350];
const corner = { top: [450, 600], bottom: [450, 950] } as const;

/** Where the line from `from` toward a vanishing point crosses the vertical x. */
function toward(from: readonly number[], vp: readonly number[], x: number): [number, number] {
  return along(from[0], from[1], vp[0], vp[1], (x - from[0]) / (vp[0] - from[0]));
}

const sides = {
  leftTop: toward(corner.top, LEFT, 250),
  leftBottom: toward(corner.bottom, LEFT, 250),
  rightTop: toward(corner.top, RIGHT, 680),
  rightBottom: toward(corner.bottom, RIGHT, 680),
};
const farCorner = intersect(...sides.leftTop, ...RIGHT, ...sides.rightTop, ...LEFT) ?? [450, 400];

const twoPoint: Omit<Lesson, 'courseId'> = {
  id: 'persp-two-point',
  title: msg('A box in two-point perspective'),
  build: true,
  steps: [
    step('a', msg('A horizon with a point near each end.'), [line(60, 350, 840, 350), circle(LEFT[0], LEFT[1], 12), circle(RIGHT[0], RIGHT[1], 12)]),
    step('b', msg('The nearest corner: one vertical line.'), [line(corner.top[0], corner.top[1], corner.bottom[0], corner.bottom[1])]),
    step('c', msg('Pull lines from both ends to both points.'), [
      line(corner.top[0], corner.top[1], LEFT[0], LEFT[1]),
      line(corner.top[0], corner.top[1], RIGHT[0], RIGHT[1]),
      line(corner.bottom[0], corner.bottom[1], LEFT[0], LEFT[1]),
      line(corner.bottom[0], corner.bottom[1], RIGHT[0], RIGHT[1]),
    ]),
    step('d', msg('Two side edges, then the back edges finish the box.'), [
      line(...sides.leftTop, ...sides.leftBottom),
      line(...sides.rightTop, ...sides.rightBottom),
      poly(...sides.leftTop, ...farCorner, ...sides.rightTop),
    ]),
  ],
};

// To the right of the square, so its bottom and right side show.
const VP_LOW: [number, number] = [620, 820];
const high = { tl: [150, 300], tr: [400, 300], bl: [150, 550], br: [400, 550] } as const;
const under = (point: readonly number[]) => along(point[0], point[1], VP_LOW[0], VP_LOW[1], 0.3);

const aboveHorizon: Omit<Lesson, 'courseId'> = {
  id: 'persp-above',
  title: msg('A box above the horizon'),
  build: true,
  steps: [
    step('a', msg('A low horizon and its vanishing point.'), [line(80, 820, 820, 820), circle(VP_LOW[0], VP_LOW[1], 12)]),
    step('b', msg('A square high above the horizon.'), [poly(150, 300, 400, 300, 400, 550, 150, 550, 150, 300)]),
    step('c', msg('Pull lines from the corners to the point.'), [
      line(high.bl[0], high.bl[1], VP_LOW[0], VP_LOW[1]),
      line(high.br[0], high.br[1], VP_LOW[0], VP_LOW[1]),
      line(high.tr[0], high.tr[1], VP_LOW[0], VP_LOW[1]),
    ]),
    step('d', msg('Back edges: now you see the box from below.'), [poly(...under(high.bl), ...under(high.br), ...under(high.tr))]),
  ],
};

// Manga effects

const speedLines: Omit<Lesson, 'courseId'> = {
  id: 'fx-speed-lines',
  title: msg('Speed lines'),
  build: false,
  steps: [
    step(
      'a',
      msg('Fast, thin strokes, all starting from the same side.'),
      [200, 350, 150, 400, 250, 180, 320, 220, 380].map((end, i) => line(800, 280 + i * 80, end, 280 + i * 80)),
    ),
    step('b', msg('A ball in motion: lines trail behind it.'), [
      circle(250, 600, 90),
      ...[
        [480, 760],
        [540, 820],
        [600, 800],
        [660, 740],
        [720, 690],
      ].map(([y, end], i) => line(330 + Math.abs(2 - i) * 15, y, end, y)),
    ]),
  ],
};

const CENTER: [number, number] = [450, 600];
const ray = (angle: number, inner: number, outer: number) => {
  const a = (angle * Math.PI) / 180;
  return line(CENTER[0] + Math.cos(a) * outer, CENTER[1] + Math.sin(a) * outer, CENTER[0] + Math.cos(a) * inner, CENTER[1] + Math.sin(a) * inner);
};

const focusLines: Omit<Lesson, 'courseId'> = {
  id: 'fx-focus-lines',
  title: msg('Focus lines'),
  build: true,
  steps: [
    step('a', msg('Aim every line at the center, from the outside in.'), range(12).map(i => ray(i * 30, 230, 400))),
    step('b', msg('More lines between them. Keep the middle empty.'), range(12).map(i => ray(i * 30 + 15, i % 2 ? 300 : 260, 400))),
  ],
};

const BALL: [number, number, number] = [450, 600, 220];
const terminator = cubic(655, 520, 600, 650, 480, 760, 324, 780);

/** Short parallel strokes from the shadow edge out to the rim of the ball. */
function shadowHatching(): GuideStroke[] {
  const [cx, cy, r] = BALL;
  const dir = [0.6, 0.8];
  const out: GuideStroke[] = [];
  const points = terminator.points;
  const segments = points.length / 2 - 1;
  for (const t of [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84]) {
    const i = Math.round(t * segments) * 2;
    const sx = points[i];
    const sy = points[i + 1];
    // Solve |s + k·dir - c| = r for the far side, then stop a little inside the rim.
    const fx = sx - cx;
    const fy = sy - cy;
    const b = fx * dir[0] + fy * dir[1];
    const k = -b + Math.sqrt(Math.max(0, b * b - (fx * fx + fy * fy - r * r)));
    out.push(line(sx + dir[0] * 6, sy + dir[1] * 6, sx + dir[0] * (k - 8), sy + dir[1] * (k - 8)));
  }
  return out;
}

const toneShading: Omit<Lesson, 'courseId'> = {
  id: 'fx-tone-shading',
  title: msg('Shading for screentone'),
  build: true,
  steps: [
    step('a', msg('Draw a ball.'), [circle(...BALL)]),
    step('b', msg('Mark the shadow edge, away from the light.'), [terminator]),
    step('c', msg('Hatch the shadow. In your pages, the Tone tool fills it.'), shadowHatching()),
  ],
};

function course(id: CourseId, title: string, lessons: Omit<Lesson, 'courseId'>[]): Course {
  return { id, title, lessons: lessons.map(lesson => ({ ...lesson, courseId: id })) };
}

/** In the order a beginner takes them. Nothing is locked: the order is only a suggestion. */
export const COURSES: Course[] = [
  course('lines', msg('Lines and pen control'), [straightLines, curves, hatching]),
  course('eyes', msg('Drawing eyes'), [simpleEye, eyePair, eyeMoods]),
  course('faces', msg('Faces'), [faceFront, faceTurned, faceProfile]),
  course('hands', msg('Simple hands'), [handShapes, fist, pointing]),
  course('perspective', msg('Basic perspective'), [onePoint, twoPoint, aboveHorizon]),
  course('effects', msg('Manga effects'), [speedLines, focusLines, toneShading]),
];

/** Every lesson in catalogue order. */
export const LESSONS: Lesson[] = COURSES.flatMap(item => item.lessons);

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find(lesson => lesson.id === id);
}

export function courseById(id: string): Course | undefined {
  return COURSES.find(item => item.id === id);
}

/** The lesson after this one in catalogue order, or null after the last. */
export function lessonAfter(id: string): Lesson | null {
  const index = LESSONS.findIndex(lesson => lesson.id === id);
  return index >= 0 ? (LESSONS[index + 1] ?? null) : null;
}

/** The finished drawing of the steps before this one, shown as context when the lesson builds up. */
export function contextOf(lesson: Lesson, stepIndex: number): GuideStroke[] {
  return lesson.build ? lesson.steps.slice(0, Math.max(0, stepIndex)).flatMap(item => item.guide) : [];
}

/** Everything the lesson draws, for a preview of the finished result. */
export function finalDrawing(lesson: Lesson): GuideStroke[] {
  return lesson.build ? lesson.steps.flatMap(item => item.guide) : lesson.steps[0]?.guide ?? [];
}

export { PAGE_H, PAGE_W };
