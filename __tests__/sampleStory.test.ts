import { connectTestStorage } from './helpers/storage';
import { exportArt, newLayer, saveArt } from '../src/state/artStore';
import { collectPanelIds, computePanels, isRtl, pageSize, panelOrder, type Rect } from '../src/core/layout/layout';
import { buildProjectBundle } from '../src/core/archive/bundle';
import { paginate } from '../src/core/model/paginate';
import { chapterIdsOf } from '../src/core/model/selectors';
import type { Block, Bubble, Effect, ID, Page, Stroke } from '../src/core/model/types';
import { useStory } from '../src/state/useStory';

beforeEach(() => {
  connectTestStorage();
});

declare const process: { env: Record<string, string | undefined> };
declare const require: (name: string) => {
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  writeFileSync: (path: string, data: string) => void;
  readFileSync: (path: string, encoding: string) => string;
};

const OUT = process.env.SEED_OUT ?? '';
const fs = OUT ? require('fs') : null;
const INK = '#16161A';
const story = () => useStory.getState();

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

function reset() {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
}

let blockSeq = 0;
const block = (type: Block['type'], text: string, characterId?: ID, kind?: Block['kind']): Block => ({
  id: `blk-${++blockSeq}`,
  type,
  text,
  characterId,
  kind,
});

const pen = (points: number[], size = 6, tool: Stroke['tool'] = 'gpen'): Stroke => ({
  tool,
  color: INK,
  size,
  opacity: 1,
  points: points.map(v => Math.round(v * 10) / 10),
});

const shape = (
  tool: 'line' | 'rect' | 'ellipse',
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size = 5,
): Stroke => ({
  tool,
  color: INK,
  size,
  opacity: 1,
  points: [x0, y0, x1, y1],
});

const tone = (points: number[], density: number): Stroke => ({
  tool: 'fill',
  color: INK,
  size: 1,
  opacity: 1,
  points,
  tone: { density },
});

const solid = (points: number[], color = INK): Stroke => ({ tool: 'fill', color, size: 1, opacity: 1, points });

function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps = 24): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return out;
}

function wobble(points: number[], amount: number, random: () => number): number[] {
  return points.map(v => v + (random() - 0.5) * amount);
}

type Face = 'hana' | 'ren' | 'kuro' | 'sato';

function bust(
  cx: number,
  cy: number,
  s: number,
  who: Face,
  random: () => number,
  mood: 'calm' | 'shout' = 'calm',
): Stroke[] {
  const out: Stroke[] = [];
  const r = 60 * s;
  const jaw = [
    ...arc(cx, cy, r * 0.98, r * 1.05, Math.PI * 0.95, Math.PI * 1.6, 10),
    ...arc(cx, cy, r * 0.98, r * 1.05, Math.PI * 1.6, Math.PI * 2.05, 10),
  ];
  out.push(
    pen(wobble([...jaw, ...arc(cx, cy + r * 0.1, r * 0.95, r * 1.08, 0.05, Math.PI * 0.95, 16)], 1.5, random), 7 * s),
  );
  if (who === 'hana') {
    const hair: number[] = [];
    for (let i = 0; i <= 7; i++) {
      const a = Math.PI * 1.05 + (Math.PI * 0.9 * i) / 7;
      hair.push(cx + r * 1.12 * Math.cos(a), cy - r * 0.15 + r * 1.12 * Math.sin(a));
      if (i < 7) {
        const b = a + Math.PI * 0.064;
        hair.push(cx + r * 0.78 * Math.cos(b), cy - r * 0.05 + r * 0.78 * Math.sin(b));
      }
    }
    out.push(pen(hair, 7 * s));
    out.push(pen([cx - r * 1.1, cy - r * 0.2, cx - r * 1.25, cy + r * 1.2, cx - r * 0.9, cy + r * 1.8], 7 * s));
    out.push(pen([cx + r * 1.1, cy - r * 0.2, cx + r * 1.28, cy + r * 1.1, cx + r * 0.95, cy + r * 1.9], 7 * s));
    const inner = arc(cx, cy - r * 0.05, r * 0.8, r * 0.8, Math.PI * 1.95, Math.PI * 1.05, 10);
    out.push(tone([...hair, ...inner], 0.4));
    out.push(
      tone(
        [
          cx - r * 1.1,
          cy - r * 0.2,
          cx - r * 1.25,
          cy + r * 1.2,
          cx - r * 0.9,
          cy + r * 1.8,
          cx - r * 0.98,
          cy + r * 0.3,
        ],
        0.4,
      ),
    );
    out.push(
      tone(
        [
          cx + r * 1.1,
          cy - r * 0.2,
          cx + r * 1.28,
          cy + r * 1.1,
          cx + r * 0.95,
          cy + r * 1.9,
          cx + r * 0.98,
          cy + r * 0.3,
        ],
        0.4,
      ),
    );
  } else if (who === 'ren') {
    const spikes: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * 1.05 + (Math.PI * 0.9 * i) / 6;
      spikes.push(cx + r * 1.45 * Math.cos(a), cy - r * 0.1 + r * 1.45 * Math.sin(a));
      spikes.push(cx + r * 0.95 * Math.cos(a + 0.2), cy - r * 0.05 + r * 0.95 * Math.sin(a + 0.2));
    }
    out.push(pen(spikes, 7 * s));
    out.push(tone(spikes, 0.4));
  } else if (who === 'kuro') {
    out.push(pen([cx - r * 1.3, cy - r * 0.55, cx + r * 1.3, cy - r * 0.55], 8 * s));
    out.push(
      solid([
        cx - r * 0.95,
        cy - r * 0.55,
        cx + r * 0.95,
        cy - r * 0.55,
        cx + r * 0.85,
        cy - r * 1.55,
        cx - r * 0.85,
        cy - r * 1.55,
      ]),
    );
    out.push(
      solid([
        cx - r * 1.3,
        cy - r * 0.55,
        cx + r * 1.3,
        cy - r * 0.55,
        cx + r * 1.3,
        cy - r * 0.42,
        cx - r * 1.3,
        cy - r * 0.42,
      ]),
    );
  } else {
    out.push(pen(arc(cx, cy - r * 0.95, r * 0.95, r * 0.55, Math.PI, Math.PI * 2, 14), 7 * s));
    out.push(pen(arc(cx, cy - r * 1.25, r * 0.38, r * 0.3, 0, Math.PI * 2, 14), 6 * s));
    out.push(shape('ellipse', cx - r * 0.72, cy - r * 0.2, cx - r * 0.1, cy + r * 0.25, 4 * s));
    out.push(shape('ellipse', cx + r * 0.1, cy - r * 0.2, cx + r * 0.72, cy + r * 0.25, 4 * s));
  }
  const ey = cy + r * 0.05;
  const open = mood === 'shout' ? 0.3 : 0.22;
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.42;
    out.push(
      pen(
        [
          ex - r * 0.3,
          ey - r * open * 0.5,
          ex - r * 0.1,
          ey - r * open,
          ex + r * 0.12,
          ey - r * open,
          ex + r * 0.3,
          ey - r * open * 0.5,
        ],
        8 * s,
      ),
    );
    out.push(pen([ex - r * 0.24, ey + r * 0.14, ex, ey + r * 0.22, ex + r * 0.24, ey + r * 0.14], 3 * s));
    if (who !== 'sato') {
      out.push(solid(arc(ex, ey + r * 0.02, r * 0.13, r * 0.17, 0, Math.PI * 2, 12)));
      out.push(solid(arc(ex - r * 0.05, ey - r * 0.05, r * 0.045, r * 0.05, 0, Math.PI * 2, 8), '#FFFFFF'));
    }
    out.push(pen([ex - r * 0.3, ey - r * 0.42, ex + r * 0.3, ey - r * (who === 'kuro' ? 0.3 : 0.46)], 5 * s));
  }
  out.push(pen([cx + r * 0.05, ey + r * 0.2, cx - r * 0.06, ey + r * 0.5, cx + r * 0.08, ey + r * 0.52], 4 * s));
  if (mood === 'shout') {
    out.push(pen(arc(cx, ey + r * 0.78, r * 0.26, r * 0.22, 0, Math.PI * 2, 12), 5 * s));
    out.push(solid(arc(cx, ey + r * 0.78, r * 0.24, r * 0.2, 0, Math.PI * 2, 12)));
  } else {
    out.push(pen([cx - r * 0.2, ey + r * 0.72, cx, ey + r * 0.8, cx + r * 0.22, ey + r * 0.7], 5 * s));
  }
  out.push(pen([cx - r * 0.3, cy + r * 1.05, cx - r * 0.34, cy + r * 1.45], 6 * s));
  out.push(pen([cx + r * 0.3, cy + r * 1.05, cx + r * 0.36, cy + r * 1.45], 6 * s));
  out.push(
    pen(
      [
        cx - r * 0.34,
        cy + r * 1.45,
        cx - r * 1.5,
        cy + r * 1.9,
        cx - r * 1.9,
        cy + r * 2.8,
        cx + r * 1.9,
        cy + r * 2.8,
        cx + r * 1.5,
        cy + r * 1.9,
        cx + r * 0.36,
        cy + r * 1.45,
      ],
      7 * s,
    ),
  );
  out.push(pen([cx - r * 0.34, cy + r * 1.45, cx, cy + r * 2.2, cx + r * 0.36, cy + r * 1.45], 5 * s));
  return out;
}

function rain(bb: Rect, count: number, random: () => number): Stroke[] {
  const out: Stroke[] = [];
  for (let i = 0; i < count; i++) {
    const x = bb.x + random() * bb.w;
    const y = bb.y + random() * bb.h;
    const len = 30 + random() * 60;
    out.push(shape('line', x, y, x - len * 0.25, y + len, 2));
  }
  return out;
}

function skyline(bb: Rect, random: () => number): Stroke[] {
  const out: Stroke[] = [];
  const base = bb.y + bb.h * 0.78;
  let x = bb.x - 10;
  const poly: number[] = [bb.x - 10, bb.y + bb.h + 10, bb.x - 10, base];
  while (x < bb.x + bb.w + 10) {
    const w = 50 + random() * 110;
    const h = 60 + random() * bb.h * 0.45;
    poly.push(x, base - h, x + w, base - h);
    for (let wy = base - h + 18; wy < base - 12; wy += 26) {
      for (let wx = x + 10; wx < x + w - 14; wx += 22) {
        if (random() > 0.45) {
          out.push(shape('rect', wx, wy, wx + 10, wy + 14, 2));
        }
      }
    }
    x += w;
  }
  poly.push(x, base, x, bb.y + bb.h + 10);
  out.unshift(pen(poly, 6));
  out.unshift(tone(poly, 0.25));
  return out;
}

function lanterns(bb: Rect, random: () => number): Stroke[] {
  const out: Stroke[] = [];
  const y0 = bb.y + 30;
  out.push(pen([bb.x, y0, bb.x + bb.w * 0.5, y0 + 40, bb.x + bb.w, y0 + 10], 4));
  for (let i = 0; i < 5; i++) {
    const t = 0.1 + i * 0.2;
    const x = bb.x + bb.w * t;
    const y = y0 + 40 * Math.sin(t * Math.PI) + 20 + random() * 10;
    out.push(shape('line', x, y - 20, x, y, 3));
    out.push(shape('ellipse', x - 22, y, x + 22, y + 56, 5));
    out.push(pen([x - 16, y + 16, x + 16, y + 16], 3));
    out.push(pen([x - 20, y + 32, x + 20, y + 32], 3));
    out.push(tone(arc(x, y + 28, 22, 28, 0, Math.PI * 2, 14), 0.1));
  }
  return out;
}

function sketch(strokes: Stroke[], random: () => number): Stroke[] {
  return strokes
    .filter(stroke => stroke.tool === 'gpen')
    .slice(0, 6)
    .map(stroke => ({
      ...stroke,
      tool: 'pencil' as const,
      color: '#C5C8CE',
      size: 2,
      points: wobble(stroke.points, 3, random),
    }));
}

type Art = { ink: Stroke[]; sketch: Stroke[] };

function drawPanel(bb: Rect, index: number, who: Face[], shot: string | undefined, random: () => number): Art {
  const ink: Stroke[] = [];
  const cx = bb.x + bb.w / 2;
  const tall = bb.h > bb.w;
  if (shot === 'wide') {
    ink.push(...skyline(bb, random));
    ink.push(...rain(bb, 40, random));
    if (who.length) {
      ink.push(...bust(cx + bb.w * 0.2, bb.y + bb.h * 0.52, Math.min(bb.w, bb.h) / 420, who[0], random));
    }
  } else if (shot === 'close' || shot === 'extreme') {
    ink.push(
      ...bust(
        cx,
        bb.y + bb.h * 0.5,
        Math.min(bb.w / 220, bb.h / 300),
        who[0] ?? 'hana',
        random,
        index % 2 ? 'shout' : 'calm',
      ),
    );
    ink.push(...rain(bb, 12, random));
  } else {
    const s = Math.min(bb.w / 330, bb.h / (tall ? 520 : 380));
    if (who.length > 1) {
      ink.push(...bust(bb.x + bb.w * 0.3, bb.y + bb.h * 0.52, s * 0.85, who[0], random));
      ink.push(...bust(bb.x + bb.w * 0.72, bb.y + bb.h * 0.48, s * 0.85, who[1], random, 'shout'));
    } else {
      ink.push(...bust(cx, bb.y + bb.h * 0.5, s, who[0] ?? 'hana', random));
    }
    if (index % 3 === 1) {
      ink.push(...lanterns(bb, random));
    }
    ink.push(...rain(bb, 18, random));
  }
  return { ink, sketch: sketch(ink, random) };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

let bubbleSeq = 0;
function makeBubble(b: Block, bb: Rect, slot: number, rtl: boolean, vi?: string): Bubble {
  const id = `bub-${++bubbleSeq}`;
  const translations = vi ? { Vietnamese: vi } : undefined;
  if (b.type === 'sfx') {
    const w = clamp(60 + b.text.length * 52, 180, bb.w * 0.8);
    return {
      id,
      type: 'sfx',
      text: b.text,
      x: clamp(bb.x + bb.w * (rtl ? 0.08 : 0.3), bb.x + 6, bb.x + bb.w - w - 6),
      y: bb.y + bb.h * 0.58,
      w,
      h: 120,
      rotation: -8,
      tail: null,
      fontSize: 72,
      font: 'display',
      bold: false,
      blockId: b.id,
      sfxStyle: 1,
      outline: 6,
      outlineColor: 'white',
      translations,
    };
  }
  if (b.type === 'narration') {
    const w = clamp(120 + b.text.length * 9, 200, bb.w * 0.8);
    return {
      id,
      type: 'narration',
      text: b.text,
      x: bb.x + 14,
      y: bb.y + 14,
      w,
      h: 64,
      rotation: 0,
      tail: null,
      fontSize: 24,
      font: 'sans',
      bold: false,
      blockId: b.id,
      narrationStyle: 'box',
      translations,
    };
  }
  const type = b.kind ?? 'speak';
  const w = clamp(140 + b.text.length * 5, 180, Math.min(bb.w * 0.6, 360));
  const lines = Math.ceil((b.text.length * 15) / (w * 0.7));
  const h = clamp(60 + lines * 34, 100, bb.h * 0.5);
  const right = (slot % 2 === 0) === rtl;
  const x = right ? bb.x + bb.w - w - 12 : bb.x + 12;
  const y = bb.y + 16 + slot * (h * 0.55);
  return {
    id,
    type,
    text: b.text,
    x,
    y: Math.min(y, bb.y + bb.h - h - 12),
    w,
    h,
    rotation: 0,
    tail: {
      x: clamp(x + w / 2 + (right ? -w * 0.2 : w * 0.2), bb.x + 8, bb.x + bb.w - 8),
      y: Math.min(y + h + 44, bb.y + bb.h - 8),
    },
    fontSize: 28,
    font: 'hand',
    bold: type === 'shout',
    characterId: b.characterId,
    blockId: b.id,
    translations,
  };
}

const VI: Record<string, string> = {
  "You're late, Hana.": 'Muộn rồi đấy, Hana.',
  'The bridge was out. Again.': 'Cầu lại sập. Lần nữa.',
  'Why is it warm?': 'Sao nó ấm thế nhỉ?',
  'Nobody told her what was inside.': 'Không ai nói cho cô biết bên trong là gì.',
  SPLASH: 'TÕM',
  "Hana! Your chain's loose!": 'Hana! Xích xe lỏng rồi!',
  'Later!': 'Để sau!',
  'The box. Hand it over.': 'Cái hộp. Đưa đây.',
  WHOOSH: 'VÙ',
  "Don't look down. Don't look down.": 'Đừng nhìn xuống. Đừng nhìn xuống.',
  'What…?!': 'Cái gì…?!',
  "Harbor Road, number nine. Don't open it.": 'Đường Cảng, số chín. Đừng mở ra.',
  'Wrong courier.': 'Nhầm người rồi.',
  'The storm had chosen her.': 'Cơn bão đã chọn cô.',
};

function write(name: string, projectId: ID) {
  const bundle = buildProjectBundle(useStory.getState(), projectId, exportArt);
  expect(bundle).not.toBeNull();
  fs?.mkdirSync(`${OUT}/${name}`, { recursive: true });
  fs?.writeFileSync(`${OUT}/${name}/story.json`, JSON.stringify(bundle));
}

function lanternCourier() {
  reset();
  const now = Date.now();
  const projectId = story().createProject({
    title: 'Lantern Courier',
    genres: ['Action', 'Adventure'],
    logline: 'In a city that never stops raining, a rookie courier carries a parcel that can rewrite the storm.',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
    coverUri: 'images/cover.png',
  });
  const project = story().projects[projectId];
  const [act1, act2, act3] = project.acts.map(act => act.id);
  const ch1 = chapterIdsOf(project)[0];
  story().updateChapter(ch1, {
    title: 'The Parcel',
    summary: 'Hana picks up a strange humming box at the harbor and gets chased across the Lantern District.',
    goal: 'Hana wants to finish one clean delivery. Instead she becomes the target of the Dry Guild.',
  });
  const ch2 = story().addChapter(projectId, {
    actId: act1,
    title: 'Rooftop Chase',
    summary: 'The Dry Guild corners Hana above the market. Ren shows up with a stolen cargo bike.',
    goal: 'Escape with the box and learn it reacts to Hana.',
  });
  const ch3 = story().addChapter(projectId, {
    actId: act2,
    title: 'Under the Bridge',
    summary: 'Hidden in the flooded underpass, Hana and Ren open the box and the rain answers.',
    goal: 'Discover rainwriting and decide whether to keep the parcel.',
  });
  story().addChapter(projectId, {
    actId: act2,
    title: "Kuro's Offer",
    summary: 'Kuro offers Hana a dry future for her grandmother in exchange for the box.',
    goal: 'Hana is tempted. Ren walks away.',
  });
  story().addChapter(projectId, {
    actId: act3,
    title: 'The Last Delivery',
    summary: 'Hana rides into the storm to deliver the box to the one person who can end the rain.',
    goal: 'Choose the city over the easy way out.',
  });

  const hana = story().addCharacter(projectId, {
    name: 'Hana Mori',
    role: 'main',
    age: '16',
    gender: 'Female',
    traits: ['stubborn', 'quick', 'loyal', 'bad liar'],
    goal: 'Keep the courier shop alive so Grandma Sato never has to move.',
    weakness: 'Takes every job alone and never asks for help.',
    voice: 'Short sentences, dry jokes, swears at bridges.',
    bio: 'Grew up above the courier shop in the Lantern District. Has delivered in the rain since she was ten and knows every rooftop shortcut in the city.',
    appearance:
      'Long dark hair tied low, soaked bangs, oversized yellow rain jacket, courier bag strapped across her chest, scraped knees.',
  });
  const ren = story().addCharacter(projectId, {
    name: 'Ren Takeda',
    role: 'support',
    age: '17',
    gender: 'Male',
    traits: ['calm', 'tinkerer', 'overthinks'],
    goal: 'Build a bike that can outrun the Dry Guild vans.',
    weakness: 'Freezes when he has to choose for someone else.',
    voice: 'Explains too much, apologises mid-sentence.',
    bio: "Fixes bikes in his uncle's shop next door. Hana's friend since the Great Flood.",
    appearance: 'Spiky short hair, grease on his cheek, mechanic overalls rolled to the knee, goggles on his forehead.',
  });
  const kuro = story().addCharacter(projectId, {
    name: 'Kuro',
    role: 'villain',
    age: '44',
    gender: 'Male',
    traits: ['patient', 'polite', 'ruthless'],
    goal: 'Own the only dry district in the city and sell the rain back to it.',
    weakness: 'Believes everyone has a price.',
    voice: 'Soft, formal, never raises his voice.',
    bio: 'Head of the Dry Guild. Built the sea wall that keeps his district dry while the rest of the city drowns.',
    appearance: 'Wide-brimmed black hat, long grey coat, thin smile, always perfectly dry.',
  });
  const sato = story().addCharacter(projectId, {
    name: 'Grandma Sato',
    role: 'extra',
    age: '71',
    gender: 'Female',
    traits: ['sharp', 'warm'],
    goal: 'Keep the shop open one more season.',
    weakness: 'Her knees.',
    voice: 'Scolds with love.',
    bio: 'Runs the harbor courier counter. Raised Hana.',
    appearance: 'Grey bun, round glasses, apron over a thick cardigan.',
  });
  story().addRelation(projectId, hana, ren, 'childhood friend', 'Met during the Great Flood.');
  story().addRelation(projectId, hana, kuro, 'hunted by');
  story().addRelation(projectId, hana, sato, 'raised by');
  story().updateChapter(ch1, { characterIds: [hana, sato, ren, kuro] });

  story().addWorldEntry(projectId, 'place', {
    title: 'Lantern District',
    body: 'The old market quarter. Paper lanterns are strung between every roof so couriers can read the streets through the rain. Half the ground floor is flooded; people live and trade from the second floor up.',
    sendToAi: true,
    order: 0,
  });
  story().addWorldEntry(projectId, 'faction', {
    title: 'The Dry Guild',
    body: 'Owners of the sea wall and the only dry district. Their grey-coated runners collect "rain tax" from shops that want to stay above water.',
    characterIds: [kuro],
    sendToAi: true,
    order: 1,
  });
  story().addWorldEntry(projectId, 'term', {
    title: 'Rainwriting',
    body: 'The lost craft of shaping where the rain falls. A rainwriter can hold a storm over one street or clear a rooftop for a minute. The humming box is the last rainwriting tool in the city.',
    reading: 'rain-writing',
    sendToAi: true,
    order: 2,
  });
  story().addWorldEntry(projectId, 'event', {
    title: 'The Great Flood',
    body: 'Seven years ago the river rose and never went back down. The sea wall went up a year later, and the Dry Guild with it.',
    anchor: 'before',
    sendToAi: true,
    order: 3,
  });
  story().addWorldEntry(projectId, 'note', {
    title: 'Tone',
    body: 'Rain in every panel. Keep the humour dry and the action wet. Hana never wins by strength, only by knowing the city better.',
    sendToAi: false,
    order: 4,
  });

  const scene1 = [
    block('setting', 'Harbor warehouse, dawn. Rain hammers the tin roof.'),
    block('action', 'A single bike light cuts through the downpour along Harbor Road.'),
    block('action', 'Hana ducks under the shutter, soaked, a courier bag strapped tight across her chest.'),
    block('dialogue', "You're late, Hana.", sato, 'speak'),
    block('dialogue', 'The bridge was out. Again.', hana, 'speak'),
    block('action', 'Sato slides a small wooden box across the counter. It hums.'),
    block('dialogue', 'Why is it warm?', hana, 'think'),
    block('action', 'Hana tucks the box into her bag and pulls her hood up.'),
    block('dialogue', "Harbor Road, number nine. Don't open it.", sato, 'speak'),
    block('narration', 'Nobody told her what was inside.'),
  ];
  const scene2 = [
    block('setting', 'Lantern District, morning. Paper lanterns glow through the downpour.'),
    block('action', 'Paper lanterns swing above the flooded market street.'),
    block('action', 'Hana weaves her bike between carts and umbrellas.'),
    block('sfx', 'SPLASH'),
    block('dialogue', "Hana! Your chain's loose!", ren, 'shout'),
    block('dialogue', 'Later!', hana, 'shout'),
    block('action', 'Two men in grey coats step out of an alley and block the road.'),
    block('action', 'Kuro follows, perfectly dry under a black umbrella.'),
    block('dialogue', 'The box. Hand it over.', kuro, 'speak'),
    block('action', "Hana's hand tightens on the strap."),
    block('dialogue', 'Wrong courier.', hana, 'speak'),
  ];
  const scene3 = [
    block('setting', 'Rooftops above the market.'),
    block('action', 'Hana shoulders the bike up a fire escape.'),
    block('action', 'She leaps the gap between two roofs.'),
    block('sfx', 'WHOOSH'),
    block('dialogue', "Don't look down. Don't look down.", hana, 'whisper'),
    block('action', 'Grey coats scramble up the ladder behind her.'),
    block('action', 'The box glows. The rain around her stops in mid-air.'),
    block('dialogue', 'What…?!', hana, 'shout'),
    block('action', 'Every drop hangs still. The city goes silent.'),
    block('narration', 'The storm had chosen her.'),
  ];
  story().addScene(ch1, { description: 'Pickup at the harbor', blocks: scene1 });
  story().addScene(ch1, { description: 'Through the Lantern District', blocks: scene2 });
  story().addScene(ch1, { description: 'The rooftops', blocks: scene3 });
  story().addScene(ch2, {
    description: 'Cornered',
    blocks: [
      block('setting', 'A narrow rooftop, rain blowing sideways.'),
      block('action', 'Grey coats climb the fire escape from both sides.'),
      block('dialogue', 'There is nowhere left to run, courier.', kuro, 'speak'),
      block('dialogue', "There's always a gutter.", hana, 'speak'),
    ],
  });
  story().addScene(ch3, {
    description: 'The underpass',
    blocks: [
      block('setting', 'Flooded underpass, water up to the knees.'),
      block('action', 'Ren pries the box open with a spanner.'),
    ],
  });

  const scenes = story().chapters[ch1].sceneIds.map(id => story().scenes[id]);
  const plans = paginate(scenes);
  const pageIds = story().applyPagination(ch1, plans, 'append');
  const allBlocks: Record<ID, Block> = {};
  scenes.forEach(scene => scene.blocks.forEach(b => (allBlocks[b.id] = b)));
  const faceOf: Record<ID, Face> = { [hana]: 'hana', [ren]: 'ren', [kuro]: 'kuro', [sato]: 'sato' };
  const rtl = isRtl(story().projects[projectId]);
  const random = rng(7);

  pageIds.forEach((pageId, pageIndex) => {
    const page = story().pages[pageId];
    const size = pageSize(story().projects[projectId], page);
    const shapes = computePanels(page, size, { rtl });
    const order = panelOrder(page, rtl);
    const bubbles: Bubble[] = [];
    const effects: Effect[] = [];
    order.forEach((panelId, panelIndex) => {
      const shapeOf = shapes.find(s => s.id === panelId);
      const panel = page.panels[panelId];
      if (!shapeOf || !panel) {
        return;
      }
      const blocks = panel.blockIds.map(id => allBlocks[id]).filter(Boolean);
      const who = [...new Set(blocks.map(b => b.characterId && faceOf[b.characterId]).filter(Boolean))] as Face[];
      const drawIt = pageIndex < 2 || (pageIndex === 2 && panelIndex === 0);
      if (drawIt) {
        const art = drawPanel(shapeOf.bbox, panelIndex, who, panel.shot, random);
        const sketchLayer = { ...newLayer('Sketch'), strokes: art.sketch };
        const inkLayer = { ...newLayer('Ink'), strokes: art.ink };
        saveArt(panelId, { layers: [sketchLayer, inkLayer], activeLayerId: inkLayer.id });
        if (blocks.some(b => b.type === 'sfx')) {
          effects.push({
            id: `fx-${panelId}`,
            panelId,
            type: 'speed',
            density: 0.5,
            angle: 20,
            cx: 0.5,
            cy: 0.5,
            opacity: 0.9,
          });
        }
        if (blocks.some(b => b.text.includes('glows'))) {
          effects.push({
            id: `fx2-${panelId}`,
            panelId,
            type: 'focus',
            density: 0.6,
            angle: 0,
            cx: 0.5,
            cy: 0.45,
            opacity: 1,
          });
        }
      }
      if (pageIndex < 3) {
        let slot = 0;
        blocks
          .filter(b => b.type === 'dialogue' || b.type === 'narration' || b.type === 'sfx')
          .forEach(b => {
            bubbles.push(makeBubble(b, shapeOf.bbox, slot, rtl, VI[b.text]));
            if (b.type === 'dialogue') {
              slot++;
            }
          });
      }
    });
    story().updatePage(pageId, { bubbles, effects, done: pageIndex < 2, artRev: 1 });
  });
  story().updateProject(projectId, { languages: ['Vietnamese'] });
  story().setLastOpened(projectId, { screen: 'Lettering', chapterId: ch1, pageId: pageIds[1] });
  story().updateProject(projectId, { updatedAt: now });
  write('lantern', projectId);
  return { pages: pageIds.length, plans };
}

function moonBakery() {
  reset();
  const projectId = story().createProject({
    title: 'Moon Bakery',
    genres: ['Romance', 'Comedy'],
    logline: 'A night-shift baker keeps finding love notes in the dough. The moon is writing them.',
    format: 'webtoon',
    pageSize: 'B5',
    style: 'shoujo',
    color: true,
    coverUri: 'images/cover.png',
  });
  const ch1 = chapterIdsOf(story().projects[projectId])[0];
  story().updateChapter(ch1, { title: 'First Note', summary: 'Yuki finds the first note folded inside a croissant.' });
  const yuki = story().addCharacter(projectId, {
    name: 'Yuki',
    role: 'main',
    age: '24',
    gender: 'Female',
    traits: ['sleepy', 'kind'],
  });
  story().addScene(ch1, {
    description: 'The bakery at 3 a.m.',
    blocks: [
      block('setting', 'Moon Bakery, 3 a.m. Flour everywhere.'),
      block('action', 'Yuki pulls a tray from the oven and a folded note slides out of a croissant.'),
      block('dialogue', 'Who puts paper in bread?', yuki, 'speak'),
      block('narration', 'The note said: "You looked tired tonight."'),
    ],
  });
  story().addPage(ch1, { templateId: 's3' });
  story().updateProject(projectId, { updatedAt: Date.now() - 1000 * 60 * 60 * 26 });
  write('bakery', projectId);
}

function hollowShrine() {
  reset();
  const projectId = story().createProject({
    title: 'Hollow Shrine',
    genres: ['Horror', 'Mystery'],
    logline: 'Every year one villager walks into the shrine on the hill. This year the shrine walks out.',
    format: 'manga',
    pageSize: 'A5',
    style: 'horror',
    color: false,
    coverUri: 'images/cover.png',
  });
  const ch1 = chapterIdsOf(story().projects[projectId])[0];
  story().updateChapter(ch1, { title: 'The Offering', summary: 'The village chooses Mei.' });
  const mei = story().addCharacter(projectId, {
    name: 'Mei',
    role: 'main',
    age: '19',
    gender: 'Female',
    traits: ['quiet'],
  });
  story().addScene(ch1, {
    description: 'The village square',
    blocks: [
      block('setting', 'Village square at dusk.'),
      block('dialogue', 'It has to be me, doesn’t it.', mei, 'whisper'),
    ],
  });
  const p1 = story().addPage(ch1, { templateId: 'g4-grid' });
  const p2 = story().addPage(ch1, { templateId: 'd3' });
  story().updatePage(p1, { done: true });
  story().updatePage(p2, { done: true });
  story().updateProject(projectId, { done: true, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9 });
  write('shrine', projectId);
}

(OUT ? test : test.skip)('writes the sample story bundles for store screenshots', () => {
  const result = lanternCourier();
  expect(result.pages).toBeGreaterThanOrEqual(3);
  moonBakery();
  hollowShrine();
  const page: Page = JSON.parse(fs?.readFileSync(`${OUT}/lantern/story.json`, 'utf8') ?? '{"pages":[]}').pages[0];
  expect(collectPanelIds(page.layout).length).toBeGreaterThan(0);
  fs?.writeFileSync(`${OUT}/plans.json`, JSON.stringify(result.plans, null, 1));
});
