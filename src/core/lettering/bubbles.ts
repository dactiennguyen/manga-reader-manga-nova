import { msg } from '../i18n';
import type { Pt } from '../layout/layout';
import type { Bubble, BubbleType } from '../model/types';
import { hashString, uid } from '../util/id';

export const MIN_FONT_SIZE = 17;
export const BUBBLE_STROKE = 3.5;

export const SFX_STYLES: { label: string; font: Bubble['font']; letterSpacing: number; skew: number }[] = [
  { label: msg('Bold'), font: 'display', letterSpacing: 1, skew: 0 },
  { label: msg('Slant'), font: 'display', letterSpacing: 2, skew: -0.25 },
  { label: msg('Wide'), font: 'display', letterSpacing: 10, skew: 0 },
  { label: msg('Hand'), font: 'hand', letterSpacing: 2, skew: -0.12 },
  { label: msg('Block'), font: 'sansBold', letterSpacing: 1, skew: 0 },
  { label: msg('Shake'), font: 'sansBold', letterSpacing: 6, skew: 0.2 },
];

type BubbleBox = Pick<Bubble, 'x' | 'y' | 'w' | 'h'>;
type RotatedBox = BubbleBox & Pick<Bubble, 'rotation'>;

/** Deterministic per id, so a burst or an effect looks the same on every redraw. */
export function seededRandom(seed: string): () => number {
  let a = parseInt(hashString(seed), 36) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBubble(type: BubbleType, center: Pt, init: Partial<Bubble> = {}): Bubble {
  const sfx = type === 'sfx';
  const narration = type === 'narration';
  const w = init.w ?? (sfx ? 300 : narration ? 320 : 260);
  const h = init.h ?? (sfx ? 130 : narration ? 110 : 170);
  return {
    id: uid(),
    type,
    text: '',
    x: center.x - w / 2,
    y: center.y - h / 2,
    w,
    h,
    rotation: sfx ? -8 : 0,
    tail: sfx || narration ? null : { x: center.x - w * 0.15, y: center.y + h / 2 + 50 },
    fontSize: sfx ? 84 : narration ? 26 : 28,
    font: sfx ? 'display' : narration ? 'sans' : 'hand',
    bold: type === 'shout',
    narrationStyle: narration ? 'box' : undefined,
    sfxStyle: sfx ? 0 : undefined,
    outline: sfx ? 6 : undefined,
    outlineColor: sfx ? 'white' : undefined,
    ...init,
  };
}

export function bubbleCenter(bubble: BubbleBox): Pt {
  return { x: bubble.x + bubble.w / 2, y: bubble.y + bubble.h / 2 };
}

export function ellipsePoint(bubble: BubbleBox, angle: number, scale = 1): Pt {
  const c = bubbleCenter(bubble);
  return { x: c.x + (Math.cos(angle) * bubble.w * scale) / 2, y: c.y + (Math.sin(angle) * bubble.h * scale) / 2 };
}

export function rotatePoint(p: Pt, center: Pt, degrees: number): Pt {
  if (!degrees) {
    return p;
  }
  const r = (degrees * Math.PI) / 180;
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * Math.cos(r) - dy * Math.sin(r),
    y: center.y + dx * Math.sin(r) + dy * Math.cos(r),
  };
}

export function toBubbleLocal(bubble: RotatedBox, p: Pt): Pt {
  return rotatePoint(p, bubbleCenter(bubble), -bubble.rotation);
}

export function hitTestBubble(bubble: RotatedBox, p: Pt, pad = 0): boolean {
  const q = toBubbleLocal(bubble, p);
  return (
    q.x >= bubble.x - pad &&
    q.x <= bubble.x + bubble.w + pad &&
    q.y >= bubble.y - pad &&
    q.y <= bubble.y + bubble.h + pad
  );
}

export function bubbleCorners(bubble: RotatedBox): Pt[] {
  const c = bubbleCenter(bubble);
  return [
    { x: bubble.x, y: bubble.y },
    { x: bubble.x + bubble.w, y: bubble.y },
    { x: bubble.x + bubble.w, y: bubble.y + bubble.h },
    { x: bubble.x, y: bubble.y + bubble.h },
  ].map(p => rotatePoint(p, c, bubble.rotation));
}

export function bubbleBounds(bubble: RotatedBox): { x: number; y: number; w: number; h: number } {
  const pts = bubbleCorners(bubble);
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function textInset(bubble: Pick<Bubble, 'type' | 'w' | 'h'>): Pt {
  switch (bubble.type) {
    case 'sfx':
      return { x: 0, y: 0 };
    case 'narration':
    case 'machine':
      return { x: 16, y: 12 };
    case 'think':
      return { x: bubble.w * 0.2, y: bubble.h * 0.2 };
    case 'shout':
      return { x: bubble.w * 0.2, y: bubble.h * 0.2 };
    default:
      return { x: bubble.w * 0.15, y: bubble.h * 0.14 };
  }
}

/** Angle from the bubble center towards a tail tip, in the bubble's own ellipse space. */
export function tailAngle(bubble: BubbleBox, tip: Pt): number {
  const c = bubbleCenter(bubble);
  return Math.atan2((tip.y - c.y) / bubble.h, (tip.x - c.x) / bubble.w);
}

/** Points render joins with lines, or with two quads for the curved kind. */
export type TailShape =
  | { kind: 'zigzag'; start: Pt; points: Pt[] }
  | { kind: 'spike'; start: Pt; tip: Pt; end: Pt }
  | { kind: 'curve'; start: Pt; c1: Pt; tip: Pt; c2: Pt; end: Pt };

export function tailShape(bubble: Bubble, tip: Pt): TailShape {
  const angle = tailAngle(bubble, tip);
  const boxed = bubble.type === 'machine';
  const spread = bubble.type === 'shout' ? 0.3 : boxed ? 0.16 : 0.22;
  const a = ellipsePoint(bubble, angle - spread, 0.9);
  const b = ellipsePoint(bubble, angle + spread, 0.9);
  if (boxed) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nx = (b.x - a.x) * 0.5;
    const ny = (b.y - a.y) * 0.5;
    const k1 = { x: mx + (tip.x - mx) * 0.55, y: my + (tip.y - my) * 0.55 };
    return {
      kind: 'zigzag',
      start: a,
      points: [
        { x: k1.x + nx, y: k1.y + ny },
        { x: k1.x + nx * 0.2, y: k1.y + ny * 0.2 },
        tip,
        { x: k1.x - nx, y: k1.y - ny },
        { x: k1.x - nx * 0.2, y: k1.y - ny * 0.2 },
        b,
      ],
    };
  }
  if (bubble.type === 'shout') {
    return { kind: 'spike', start: a, tip, end: b };
  }
  const bend = 0.18;
  return {
    kind: 'curve',
    start: a,
    c1: { x: a.x + (tip.x - a.x) * 0.5 + (b.x - a.x) * bend, y: a.y + (tip.y - a.y) * 0.5 + (b.y - a.y) * bend },
    tip,
    c2: { x: b.x + (tip.x - b.x) * 0.5 + (b.x - a.x) * bend, y: b.y + (tip.y - b.y) * 0.5 + (b.y - a.y) * bend },
    end: b,
  };
}

export function chamferPoints(bubble: BubbleBox): Pt[] {
  const k = Math.min(18, bubble.w * 0.12, bubble.h * 0.2);
  const { x, y, w, h } = bubble;
  return [
    { x: x + k, y },
    { x: x + w - k, y },
    { x: x + w, y: y + k },
    { x: x + w, y: y + h - k },
    { x: x + w - k, y: y + h },
    { x: x + k, y: y + h },
    { x, y: y + h - k },
    { x, y: y + k },
  ];
}

export function cloudShape(bubble: BubbleBox): {
  body: { x: number; y: number; w: number; h: number };
  bumps: Pt[];
  radius: number;
} {
  const count = Math.max(8, Math.round((bubble.w + bubble.h) / 55));
  const radius = Math.min(bubble.w, bubble.h) * 0.2;
  const bumps: Pt[] = [];
  for (let i = 0; i < count; i++) {
    bumps.push(ellipsePoint(bubble, (i / count) * Math.PI * 2, 0.78));
  }
  return {
    body: {
      x: bubble.x + radius * 0.6,
      y: bubble.y + radius * 0.6,
      w: bubble.w - radius * 1.2,
      h: bubble.h - radius * 1.2,
    },
    bumps,
    radius,
  };
}

export function burstPoints(bubble: BubbleBox & Pick<Bubble, 'id'>): Pt[] {
  const rand = seededRandom(bubble.id);
  const spikes = Math.max(12, Math.round((bubble.w + bubble.h) / 34));
  const points: Pt[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const scale = i % 2 === 0 ? 1.08 + rand() * 0.12 : 0.8 + rand() * 0.05;
    points.push(ellipsePoint(bubble, angle, scale));
  }
  return points;
}

export function thoughtTrail(bubble: BubbleBox, tip: Pt): { x: number; y: number; r: number }[] {
  const start = ellipsePoint(bubble, tailAngle(bubble, tip), 1.02);
  return [0.25, 0.6, 0.95].map((t, index) => ({
    x: start.x + (tip.x - start.x) * t,
    y: start.y + (tip.y - start.y) * t,
    r: 15 - index * 4.5,
  }));
}

export function hasBodyTail(bubble: Pick<Bubble, 'tail' | 'type'>): boolean {
  return !!bubble.tail && bubble.type !== 'think' && bubble.type !== 'narration';
}
