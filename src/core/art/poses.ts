import { msg } from '../i18n';
import type { Stroke } from '../model/types';
import type { Box } from './artMath';

/**
 * Mannequins to trace, drawn by code. A pose is a set of joints in a unit box: x runs across the box and y
 * down it, both from 0 to 1, and `aspect` is the box's width over its height. The figures are about 7.5
 * heads tall, and `headSize` is the height of the head as a share of the box's height. Left and right are
 * as seen on screen.
 */

export type JointName =
  | 'head'
  | 'neck'
  | 'chest'
  | 'pelvis'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'handL'
  | 'handR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR'
  | 'toeL'
  | 'toeR'
  /** The tip of the nose, for figures seen from the side. It shows which way the head faces. */
  | 'nose';

export type PoseJoints = Partial<Record<JointName, readonly [number, number]>>;

export type Pose = { id: string; label: string; aspect: number; headSize: number; joints: PoseJoints };

/** A soft blue that reads as a guide. A black and white story gets the gray, so nothing coloured slips in. */
export const POSE_COLOR = '#5B9BD5';
export const POSE_GRAY = '#808080';
export const POSE_LAYER_OPACITY = 0.6;

const BONES: [JointName, JointName][] = [
  ['chest', 'pelvis'],
  ['shoulderL', 'shoulderR'],
  ['hipL', 'hipR'],
  ['shoulderL', 'elbowL'],
  ['elbowL', 'wristL'],
  ['wristL', 'handL'],
  ['shoulderR', 'elbowR'],
  ['elbowR', 'wristR'],
  ['wristR', 'handR'],
  ['hipL', 'kneeL'],
  ['kneeL', 'ankleL'],
  ['ankleL', 'toeL'],
  ['hipR', 'kneeR'],
  ['kneeR', 'ankleR'],
  ['ankleR', 'toeR'],
];

const DOTS: JointName[] = [
  'shoulderL',
  'shoulderR',
  'elbowL',
  'elbowR',
  'wristL',
  'wristR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
];

const OVAL_POINTS = 24;
/** Sizes in heads. */
const HEAD_HALF_WIDTH = 0.38;
const RIBCAGE_HALF_HEIGHT = 0.75;
const PELVIS_HALF_HEIGHT = 0.38;
const LINE_WIDTH = 0.05;
const DOT_WIDTH = 2.4;

export const POSES: Pose[] = [
  {
    id: 'standing',
    label: msg('Standing'),
    aspect: 0.347,
    headSize: 0.1262,
    joints: {
      head: [0.5, 0.081], neck: [0.5, 0.194], chest: [0.5, 0.283], pelvis: [0.5, 0.472],
      shoulderL: [0.209, 0.21], shoulderR: [0.791, 0.21], elbowL: [0.123, 0.396], elbowR: [0.877, 0.396],
      wristL: [0.092, 0.554], wristR: [0.908, 0.554], handL: [0.076, 0.629], handR: [0.924, 0.629],
      hipL: [0.362, 0.5], hipR: [0.638, 0.5], kneeL: [0.313, 0.739], kneeR: [0.687, 0.739],
      ankleL: [0.303, 0.941], ankleR: [0.697, 0.941], toeL: [0.169, 0.973], toeR: [0.831, 0.973],
    },
  },
  {
    id: 'walking',
    label: msg('Walking'),
    aspect: 0.608,
    headSize: 0.1295,
    joints: {
      head: [0.495, 0.083], neck: [0.488, 0.199], chest: [0.475, 0.29], pelvis: [0.453, 0.484],
      shoulderL: [0.439, 0.212], shoulderR: [0.533, 0.217], elbowL: [0.289, 0.384], elbowR: [0.663, 0.395],
      wristL: [0.252, 0.544], wristR: [0.86, 0.503], handL: [0.235, 0.621], handR: [0.955, 0.555],
      hipL: [0.424, 0.511], hipR: [0.475, 0.513], kneeL: [0.273, 0.739], kneeR: [0.64, 0.738],
      ankleL: [0.045, 0.893], ankleR: [0.675, 0.944], toeL: [0.136, 0.973], toeR: [0.833, 0.958],
      nose: [0.614, 0.083],
    },
  },
  {
    id: 'running',
    label: msg('Running'),
    aspect: 0.919,
    headSize: 0.1426,
    joints: {
      head: [0.593, 0.091], neck: [0.569, 0.217], chest: [0.535, 0.312], pelvis: [0.471, 0.518],
      shoulderL: [0.527, 0.223], shoulderR: [0.598, 0.244], elbowL: [0.337, 0.345], elbowR: [0.754, 0.403],
      wristL: [0.448, 0.491], wristR: [0.898, 0.284], handL: [0.501, 0.562], handR: [0.967, 0.226],
      hipL: [0.444, 0.543], hipR: [0.479, 0.552], kneeL: [0.262, 0.756], kneeR: [0.76, 0.636],
      ankleL: [0.043, 0.864], ankleR: [0.768, 0.864], toeL: [0.033, 0.97], toeR: [0.874, 0.909],
      nose: [0.679, 0.084],
    },
  },
  {
    id: 'sitting',
    label: msg('Sitting'),
    aspect: 0.611,
    headSize: 0.1617,
    joints: {
      head: [0.156, 0.103], neck: [0.148, 0.249], chest: [0.148, 0.362], pelvis: [0.169, 0.604],
      shoulderL: [0.085, 0.268], shoulderR: [0.212, 0.268], elbowL: [0.14, 0.508], elbowR: [0.321, 0.501],
      wristL: [0.442, 0.591], wristR: [0.635, 0.564], handL: [0.587, 0.63], handR: [0.786, 0.594],
      hipL: [0.135, 0.641], hipR: [0.209, 0.639], kneeL: [0.636, 0.662], kneeR: [0.704, 0.692],
      ankleL: [0.651, 0.921], ankleR: [0.748, 0.949], toeL: [0.847, 0.938], toeR: [0.944, 0.966],
      nose: [0.305, 0.103],
    },
  },
  {
    id: 'kneeling',
    label: msg('Kneeling'),
    aspect: 0.953,
    headSize: 0.1637,
    joints: {
      head: [0.466, 0.105], neck: [0.466, 0.252], chest: [0.458, 0.366], pelvis: [0.44, 0.611],
      shoulderL: [0.42, 0.269], shoulderR: [0.509, 0.275], elbowL: [0.393, 0.513], elbowR: [0.653, 0.478],
      wristL: [0.416, 0.717], wristR: [0.863, 0.521], handL: [0.426, 0.814], handR: [0.964, 0.541],
      hipL: [0.413, 0.646], hipR: [0.461, 0.649], kneeL: [0.43, 0.956], kneeR: [0.787, 0.66],
      ankleL: [0.155, 0.966], ankleR: [0.787, 0.922], toeL: [0.036, 0.92], toeR: [0.915, 0.935],
      nose: [0.562, 0.105],
    },
  },
  {
    id: 'jumping',
    label: msg('Jumping'),
    aspect: 0.564,
    headSize: 0.1112,
    joints: {
      head: [0.537, 0.241], neck: [0.524, 0.341], chest: [0.529, 0.419], pelvis: [0.55, 0.585],
      shoulderL: [0.369, 0.367], shoulderR: [0.681, 0.342], elbowL: [0.136, 0.264], elbowR: [0.894, 0.226],
      wristL: [0.072, 0.13], wristR: [0.937, 0.089], handL: [0.041, 0.065], handR: [0.958, 0.023],
      hipL: [0.478, 0.608], hipR: [0.628, 0.611], kneeL: [0.227, 0.765], kneeR: [0.959, 0.71],
      ankleL: [0.385, 0.919], ankleR: [0.756, 0.846], toeL: [0.326, 0.977], toeR: [0.806, 0.907],
    },
  },
  {
    id: 'punching',
    label: msg('Punching'),
    aspect: 0.866,
    headSize: 0.13,
    joints: {
      head: [0.416, 0.083], neck: [0.398, 0.199], chest: [0.372, 0.287], pelvis: [0.325, 0.478],
      shoulderL: [0.32, 0.198], shoulderR: [0.466, 0.23], elbowL: [0.426, 0.37], elbowR: [0.691, 0.243],
      wristL: [0.514, 0.227], wristR: [0.878, 0.243], handL: [0.557, 0.158], handR: [0.968, 0.243],
      hipL: [0.28, 0.499], hipR: [0.357, 0.513], kneeL: [0.129, 0.708], kneeR: [0.516, 0.717],
      ankleL: [0.032, 0.898], ankleR: [0.533, 0.925], toeL: [0.104, 0.973], toeR: [0.645, 0.932],
      nose: [0.5, 0.08],
    },
  },
  {
    id: 'kicking',
    label: msg('Kicking'),
    aspect: 0.822,
    headSize: 0.1271,
    joints: {
      head: [0.208, 0.081], neck: [0.218, 0.195], chest: [0.244, 0.282], pelvis: [0.315, 0.463],
      shoulderL: [0.162, 0.222], shoulderR: [0.282, 0.198], elbowL: [0.032, 0.38], elbowR: [0.398, 0.363],
      wristL: [0.196, 0.465], wristR: [0.55, 0.265], handL: [0.275, 0.505], handR: [0.623, 0.218],
      hipL: [0.296, 0.497], hipR: [0.355, 0.482], kneeL: [0.266, 0.738], kneeR: [0.646, 0.448],
      ankleL: [0.257, 0.941], ankleR: [0.893, 0.441], toeL: [0.366, 0.973], toeR: [0.968, 0.368],
      nose: [0.294, 0.084],
    },
  },
  {
    id: 'pointing',
    label: msg('Pointing'),
    aspect: 0.757,
    headSize: 0.1237,
    joints: {
      head: [0.305, 0.079], neck: [0.295, 0.19], chest: [0.295, 0.277], pelvis: [0.295, 0.462],
      shoulderL: [0.164, 0.205], shoulderR: [0.425, 0.205], elbowL: [0.034, 0.362], elbowR: [0.668, 0.179],
      wristL: [0.163, 0.45], wristR: [0.869, 0.152], handL: [0.2, 0.475], handR: [0.966, 0.139],
      hipL: [0.233, 0.489], hipR: [0.357, 0.489], kneeL: [0.2, 0.723], kneeR: [0.4, 0.722],
      ankleL: [0.191, 0.921], ankleR: [0.414, 0.92], toeL: [0.091, 0.974], toeR: [0.514, 0.973],
    },
  },
  {
    id: 'arms-crossed',
    label: msg('Arms crossed'),
    aspect: 0.369,
    headSize: 0.1237,
    joints: {
      head: [0.5, 0.079], neck: [0.5, 0.19], chest: [0.5, 0.277], pelvis: [0.5, 0.463],
      shoulderL: [0.232, 0.205], shoulderR: [0.768, 0.205], elbowL: [0.165, 0.38], elbowR: [0.835, 0.38],
      wristL: [0.568, 0.422], wristR: [0.418, 0.396], handL: [0.665, 0.433], handR: [0.318, 0.4],
      hipL: [0.373, 0.49], hipR: [0.627, 0.49], kneeL: [0.295, 0.723], kneeR: [0.705, 0.723],
      ankleL: [0.276, 0.921], ankleR: [0.724, 0.921], toeL: [0.07, 0.974], toeR: [0.93, 0.974],
    },
  },
  {
    id: 'looking-back',
    label: msg('Looking back'),
    aspect: 0.588,
    headSize: 0.1278,
    joints: {
      head: [0.587, 0.081], neck: [0.553, 0.195], chest: [0.567, 0.284], pelvis: [0.589, 0.475],
      shoulderL: [0.458, 0.207], shoulderR: [0.653, 0.213], elbowL: [0.315, 0.379], elbowR: [0.754, 0.395],
      wristL: [0.133, 0.498], wristR: [0.773, 0.554], handL: [0.046, 0.555], handR: [0.782, 0.631],
      hipL: [0.549, 0.505], hipR: [0.636, 0.501], kneeL: [0.381, 0.726], kneeR: [0.75, 0.734],
      ankleL: [0.345, 0.93], ankleR: [0.954, 0.9], toeL: [0.183, 0.94], toeR: [0.85, 0.973],
      nose: [0.708, 0.074],
    },
  },
  {
    id: 'lying-down',
    label: msg('Lying down'),
    aspect: 4.101,
    headSize: 0.4834,
    joints: {
      head: [0.129, 0.649], neck: [0.233, 0.725], chest: [0.316, 0.725], pelvis: [0.493, 0.725],
      shoulderL: [0.247, 0.822], shoulderR: [0.247, 0.628], elbowL: [0.159, 0.194], elbowR: [0.423, 0.704],
      wristL: [0.068, 0.67], wristR: [0.571, 0.704], handL: [0.025, 0.898], handR: [0.641, 0.704],
      hipL: [0.519, 0.783], hipR: [0.519, 0.667], kneeL: [0.742, 0.783], kneeR: [0.695, 0.102],
      ankleL: [0.931, 0.783], ankleR: [0.821, 0.676], toeL: [0.975, 0.469], toeR: [0.909, 0.638],
      nose: [0.129, 0.379],
    },
  },
  {
    id: 'bust',
    label: msg('Head and shoulders'),
    aspect: 0.72,
    headSize: 0.3199,
    joints: {
      head: [0.535, 0.204], neck: [0.5, 0.491], chest: [0.5, 0.715], shoulderL: [0.144, 0.53],
      shoulderR: [0.856, 0.53], elbowL: [0.093, 0.791], elbowR: [0.907, 0.791],
    },
  },
];

type XY = { x: number; y: number };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** The unit vector from one point towards another, or straight up when they coincide. */
function towards(from: XY, to: XY): XY {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length < 1e-6 ? { x: 0, y: -1 } : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/** A closed oval as freehand points, with its long axis along `axis`. */
function oval(center: XY, axis: XY, along: number, across: number): number[] {
  const points: number[] = [];
  for (let i = 0; i <= OVAL_POINTS; i++) {
    const angle = (i / OVAL_POINTS) * Math.PI * 2;
    const a = Math.cos(angle) * along;
    const b = Math.sin(angle) * across;
    points.push(round1(center.x + axis.x * a - axis.y * b), round1(center.y + axis.y * a + axis.x * b));
  }
  return points;
}

/** The largest box of the pose's shape that fits the panel, centred, with a margin on every side. */
export function fitPoseBox(pose: Pick<Pose, 'aspect'>, bbox: Box, margin = 0.06): Box {
  const roomW = bbox.w * (1 - margin * 2);
  const roomH = bbox.h * (1 - margin * 2);
  const h = Math.max(1, Math.min(roomH, roomW / pose.aspect));
  const w = h * pose.aspect;
  return { x: round1(bbox.x + (bbox.w - w) / 2), y: round1(bbox.y + (bbox.h - h) / 2), w: round1(w), h: round1(h) };
}

/**
 * The mannequin as ordinary strokes: an oval head, ribcage and pelvis, straight bones, and a dot on each
 * joint. Line widths follow the size of the figure. A joint the pose leaves out takes its bones with it.
 */
export function buildPoseStrokes(pose: Pose, box: Box, color: string): Stroke[] {
  const at = (name: JointName): XY | null => {
    const joint = pose.joints[name];
    return joint ? { x: box.x + joint[0] * box.w, y: box.y + joint[1] * box.h } : null;
  };
  const head = pose.headSize * box.h;
  const width = round1(clamp(head * LINE_WIDTH, 1.5, 8));
  const base = { color, opacity: 1 };
  const strokes: Stroke[] = [];
  const outline = (points: number[]) => strokes.push({ ...base, tool: 'pencil', size: width, points });
  const bone = (from: XY, to: XY) =>
    strokes.push({ ...base, tool: 'line', size: width, points: [round1(from.x), round1(from.y), round1(to.x), round1(to.y)] });

  const skull = at('head');
  const neck = at('neck');
  const chest = at('chest');
  const pelvis = at('pelvis');
  const span = (a: JointName, b: JointName) => {
    const p = at(a);
    const q = at(b);
    return p && q ? Math.hypot(q.x - p.x, q.y - p.y) : 0;
  };

  if (skull) {
    const up = neck ? towards(neck, skull) : { x: 0, y: -1 };
    outline(oval(skull, up, head / 2, head * HEAD_HALF_WIDTH));
    if (neck) {
      bone(neck, { x: skull.x - (up.x * head) / 2, y: skull.y - (up.y * head) / 2 });
    }
    const nose = at('nose');
    if (nose) {
      const out = towards(skull, nose);
      bone({ x: skull.x + out.x * head * HEAD_HALF_WIDTH, y: skull.y + out.y * head * HEAD_HALF_WIDTH }, nose);
    }
  }
  if (chest) {
    const up = neck ? towards(chest, neck) : { x: 0, y: -1 };
    const half = clamp(span('shoulderL', 'shoulderR') * 0.4, head * 0.42, head * 0.62);
    outline(oval(chest, up, head * RIBCAGE_HALF_HEIGHT, half));
  }
  if (pelvis) {
    const up = chest ? towards(pelvis, chest) : { x: 0, y: -1 };
    const half = clamp(span('hipL', 'hipR') * 0.75, head * 0.36, head * 0.6);
    outline(oval(pelvis, up, head * PELVIS_HALF_HEIGHT, half));
  }
  BONES.forEach(([a, b]) => {
    const from = at(a);
    const to = at(b);
    if (from && to) {
      bone(from, to);
    }
  });
  DOTS.forEach(name => {
    const joint = at(name);
    if (joint) {
      strokes.push({ ...base, tool: 'pencil', size: round1(width * DOT_WIDTH), points: [round1(joint.x), round1(joint.y)] });
    }
  });
  return strokes;
}
