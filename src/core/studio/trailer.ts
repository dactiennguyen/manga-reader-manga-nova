/**
 * A story trailer: a title card, a handful of the person's best drawn panels with a slow pan and zoom and
 * a line of their own dialogue under each, then an end card. This file only plans it, in frames; the
 * feature layer draws the frames with Skia and encodes them.
 */
import type { ID, StoryData } from '../model/types';
import type { Poly, Rect, Size } from '../layout/layout';
import { drawnPanels, pickLines, pickPanels, type StrokeCounter, type TrailerLine } from './trailerPicks';

export * from './trailerPicks';

export const TRAILER_FPS = 24;
/** Vertical, for phones and stories. 720p keeps the frames small enough to draw and encode on a phone. */
export const TRAILER_SIZE: Size = { w: 720, h: 1280 };
/** Frames a shot takes to fade in from ink and back out. */
export const FADE_FRAMES = 8;
/** How far a shot zooms over its length. */
export const KEN_BURNS_ZOOM = 1.18;

/** The trailer's print colours: the studio's paper, ink and coral. Art data, so they never follow the theme. */
export const TRAILER_COLORS = {
  ink: '#1C1712',
  paper: '#F6EFE3',
  coralOnPaper: '#BF3419',
  coralOnInk: '#FF7A5C',
  mutedOnPaper: '#6B6157',
} as const;

const TITLE_SECONDS = 2.6;
const END_SECONDS = 2.8;
const TARGET_SECONDS = 15;
const PANEL_SECONDS = { min: 2.2, max: 3.4 } as const;

export type TrailerShot =
  | { kind: 'title'; start: number; frames: number }
  | {
      kind: 'panel';
      start: number;
      frames: number;
      pageId: ID;
      panelId: ID;
      /** The panel outline and its box, in page units. */
      poly: Poly;
      bbox: Rect;
      /** The part of the page on screen at the start and the end, in page units, with the stage's aspect. */
      from: Rect;
      to: Rect;
      line: TrailerLine | null;
    }
  | { kind: 'end'; start: number; frames: number };

export type PanelShot = Extract<TrailerShot, { kind: 'panel' }>;

export type TrailerPlan = {
  projectId: ID;
  title: string;
  penName: string;
  fps: number;
  size: Size;
  /** Where panels are shown, in pixels. Captions go under it. */
  stage: Rect;
  shots: TrailerShot[];
  totalFrames: number;
};

/** The panel area of a frame: most of the height, leaving a band at the top for the title and one under it for captions. */
export function trailerStage(size: Size): Rect {
  const x = Math.round(size.w * 0.05);
  return { x, y: Math.round(size.h * 0.1), w: size.w - 2 * x, h: Math.round(size.h * 0.64) };
}

/** The smallest box with the stage's aspect that shows the whole panel, centred on it. */
export function containWindow(bbox: Rect, aspect: number): Rect {
  const w = bbox.w / bbox.h > aspect ? bbox.w : bbox.h * aspect;
  const h = w / aspect;
  return { x: bbox.x + (bbox.w - w) / 2, y: bbox.y + (bbox.h - h) / 2, w, h };
}

/** Where the zoom heads, as a share of the panel: faces are usually in the upper half. */
const FOCUS: readonly [number, number][] = [
  [0.5, 0.45],
  [0.5, 0.3],
  [0.32, 0.38],
  [0.68, 0.4],
];

/** A slow push in or pull out, alternating, toward a different spot each time. */
export function kenBurns(bbox: Rect, aspect: number, variant: number): { from: Rect; to: Rect } {
  const wide = containWindow(bbox, aspect);
  const [fx, fy] = FOCUS[variant % FOCUS.length];
  const px = bbox.x + bbox.w * fx;
  const py = bbox.y + bbox.h * fy;
  const close = {
    x: px + (wide.x - px) / KEN_BURNS_ZOOM,
    y: py + (wide.y - py) / KEN_BURNS_ZOOM,
    w: wide.w / KEN_BURNS_ZOOM,
    h: wide.h / KEN_BURNS_ZOOM,
  };
  return variant % 2 === 0 ? { from: wide, to: close } : { from: close, to: wide };
}

export type TrailerInput = {
  state: StoryData;
  projectId: ID;
  penName: string;
  strokesOf: StrokeCounter;
  size?: Size;
  fps?: number;
};

/** The whole trailer, or null when nothing is drawn yet. */
export function planTrailer({ state, projectId, penName, strokesOf, size = TRAILER_SIZE, fps = TRAILER_FPS }: TrailerInput): TrailerPlan | null {
  const project = state.projects[projectId];
  const picks = project ? pickPanels(drawnPanels(state, projectId, strokesOf)) : [];
  if (!project || picks.length === 0) {
    return null;
  }
  const lines = pickLines(state, picks);
  const stage = trailerStage(size);
  const aspect = stage.w / stage.h;
  const panelSeconds = Math.min(
    PANEL_SECONDS.max,
    Math.max(PANEL_SECONDS.min, (TARGET_SECONDS - TITLE_SECONDS - END_SECONDS) / picks.length),
  );
  const shots: TrailerShot[] = [];
  let start = 0;
  const add = (frames: number) => {
    const at = start;
    start += frames;
    return at;
  };
  const titleFrames = Math.round(TITLE_SECONDS * fps);
  shots.push({ kind: 'title', start: add(titleFrames), frames: titleFrames });
  picks.forEach((pick, index) => {
    const frames = Math.round(panelSeconds * fps);
    const { from, to } = kenBurns(pick.bbox, aspect, index);
    shots.push({
      kind: 'panel',
      start: add(frames),
      frames,
      pageId: pick.pageId,
      panelId: pick.panelId,
      poly: pick.poly,
      bbox: pick.bbox,
      from,
      to,
      line: lines[index],
    });
  });
  const endFrames = Math.round(END_SECONDS * fps);
  shots.push({ kind: 'end', start: add(endFrames), frames: endFrames });
  return { projectId, title: project.title.trim(), penName: penName.trim(), fps, size, stage, shots, totalFrames: start };
}

/** The shot on screen at a frame, and how far into it, in frames. */
export function shotAt(plan: TrailerPlan, frame: number): { shot: TrailerShot; index: number; local: number } {
  const clamped = Math.min(plan.totalFrames - 1, Math.max(0, Math.floor(frame)));
  const index = Math.max(0, plan.shots.findIndex(shot => clamped < shot.start + shot.frames));
  const shot = plan.shots[index];
  return { shot, index, local: clamped - shot.start };
}

const ease = (t: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2;

/** The part of the page on screen at a frame of a panel shot. */
export function windowAt(shot: PanelShot, local: number): Rect {
  const t = ease(shot.frames <= 1 ? 1 : local / (shot.frames - 1));
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { x: mix(shot.from.x, shot.to.x), y: mix(shot.from.y, shot.to.y), w: mix(shot.from.w, shot.to.w), h: mix(shot.from.h, shot.to.h) };
}

/** How visible a shot is: it fades in and out, except the very end, which stays up. */
export function visibilityAt(shot: TrailerShot, local: number, last: boolean): number {
  const fadeIn = Math.min(1, (local + 1) / FADE_FRAMES);
  const fadeOut = last ? 1 : Math.min(1, (shot.frames - local) / FADE_FRAMES);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

/** Frames of a title or end card that look the same, so a video can repeat one image for them. */
export function isStillFrame(plan: TrailerPlan, frame: number): boolean {
  const { shot, index, local } = shotAt(plan, frame);
  return shot.kind !== 'panel' && visibilityAt(shot, local, index === plan.shots.length - 1) >= 1;
}

export function trailerSeconds(plan: TrailerPlan): number {
  return plan.totalFrames / plan.fps;
}
