import { msg } from '../i18n';
import { PAGE_MARGIN, hitTestPanel, type PanelShape, type Pt, type Rect, type Size } from '../layout/layout';
import type { Bubble, BubbleType, ID } from '../model/types';
import { clampFontSize } from './bubbleEdit';
import { BUBBLE_STROKE, MIN_FONT_SIZE, SFX_STYLES, bubbleBounds, bubbleCenter, createBubble } from './bubbles';
import type { TextMeasure } from './fit';
import { FONT_SCRIPTS, fontForText, scriptOf } from './fonts';
import { sized } from './script';

export type SfxGroup = 'impact' | 'motion' | 'weather' | 'feeling' | 'quiet';

type PresetStyle = { fontSize: number } & Partial<
  Pick<Bubble, 'font' | 'bold' | 'rotation' | 'narrationStyle' | 'sfxStyle' | 'skew' | 'outline' | 'outlineColor'>
>;

/** A recipe over the fields a bubble already has: placing one never needs new drawing code. */
export type LetteringPreset = {
  id: string;
  group: 'bubble' | SfxGroup;
  /** Name under the tile. A sound effect is named by its word. */
  label: string;
  /** What it says at first. Translated when it is placed, so it follows the interface language. */
  text: string;
  type: BubbleType;
  /** Body size on a page 1000 wide. A sound effect has none: its box follows the word. */
  w?: number;
  h?: number;
  tail?: boolean;
  style: PresetStyle;
};

const bubble = (
  id: string,
  label: string,
  text: string,
  type: BubbleType,
  w: number,
  h: number,
  style: PresetStyle,
  tail = false,
): LetteringPreset => ({ id, group: 'bubble', label, text, type, w, h, tail, style });

export const BUBBLE_PRESETS: LetteringPreset[] = [
  bubble('speech', msg('Speech'), msg('Hello!'), 'speak', 270, 160, { font: 'hand', fontSize: 30 }, true),
  bubble('shout', msg('Shout'), msg('Watch out!'), 'shout', 320, 210, { font: 'comic', fontSize: 44, bold: false }, true),
  bubble('whisper', msg('Whisper'), msg('Psst… over here'), 'whisper', 250, 150, { font: 'casual', fontSize: 24 }, true),
  bubble('thought', msg('Thought'), msg('What do I do…'), 'think', 290, 190, { font: 'hand', fontSize: 28 }, true),
  bubble('narration', msg('Narration box'), msg('The next morning…'), 'narration', 320, 90, {
    font: 'sans',
    fontSize: 26,
    narrationStyle: 'box',
  }),
  bubble('inverse', msg('Black narration'), msg('Meanwhile…'), 'narration', 300, 90, {
    font: 'sansBold',
    fontSize: 26,
    narrationStyle: 'inverse',
  }),
  bubble('caption', msg('Caption'), msg('Three years later'), 'narration', 340, 72, {
    font: 'sansBold',
    fontSize: 32,
    narrationStyle: 'plain',
  }),
  bubble('reaction', msg('Big reaction'), msg('WHAT?!'), 'shout', 460, 290, { font: 'display', fontSize: 68, bold: false }),
  bubble('machine', msg('Machine voice'), msg('Access denied.'), 'machine', 310, 120, { font: 'sans', fontSize: 26 }, true),
  bubble('aside', msg('Handwritten aside'), msg('(phew…)'), 'narration', 220, 72, {
    font: 'marker',
    fontSize: 30,
    narrationStyle: 'plain',
  }),
];

// Indexes into SFX_STYLES.
const BOLD = 0;
const SLANT = 1;
const WIDE = 2;
const HAND = 3;
const BLOCK = 4;
const SHAKE = 5;
const COMIC = 6;
const HEAVY = 7;

const sfx = (
  group: SfxGroup,
  word: string,
  sfxStyle: number,
  fontSize: number,
  rotation: number,
  outline: number,
  more: Partial<PresetStyle> = {},
): LetteringPreset => ({
  id: `sfx-${word.toLowerCase()}`,
  group,
  label: word,
  text: word,
  type: 'sfx',
  style: { sfxStyle, fontSize, rotation, outline, outlineColor: 'white', ...more },
});

export const SFX_PRESETS: LetteringPreset[] = [
  sfx('impact', msg('BAM'), COMIC, 110, -8, 6),
  sfx('impact', msg('SMACK'), SLANT, 92, -12, 5),
  sfx('impact', msg('THUD'), BLOCK, 88, 4, 5),
  sfx('impact', msg('CRACK'), BOLD, 96, -10, 5, { skew: -0.15 }),
  sfx('impact', msg('BOOM'), HEAVY, 120, -4, 8),
  sfx('motion', msg('WHOOSH'), SLANT, 84, -10, 4, { skew: -0.35 }),
  sfx('motion', msg('DASH'), COMIC, 80, -6, 4, { skew: -0.3 }),
  sfx('motion', msg('ZOOM'), WIDE, 80, -3, 4),
  sfx('weather', msg('SPLASH'), COMIC, 96, 6, 6),
  sfx('weather', msg('DRIP'), HAND, 56, 0, 3),
  sfx('weather', msg('PLOP'), HAND, 64, -4, 3),
  sfx('weather', msg('RUMBLE'), SHAKE, 84, -2, 6),
  sfx('feeling', msg('GASP'), BOLD, 72, -6, 4),
  sfx('feeling', msg('SIGH'), HAND, 56, 5, 2),
  sfx('feeling', msg('THUMP-THUMP'), SHAKE, 64, -5, 4),
  sfx('feeling', msg('HAHA'), COMIC, 72, -8, 4),
  sfx('quiet', msg('SHHH'), HAND, 52, 0, 2),
  sfx('quiet', msg('TICK'), BLOCK, 44, 0, 2),
  sfx('quiet', msg('SILENCE'), HAND, 60, 0, 0),
];

export const SFX_GROUPS: { key: SfxGroup; label: string }[] = [
  { key: 'impact', label: msg('Impact') },
  { key: 'motion', label: msg('Motion') },
  { key: 'weather', label: msg('Water and weather') },
  { key: 'feeling', label: msg('Feeling') },
  { key: 'quiet', label: msg('Quiet') },
];

export const PRESETS: LetteringPreset[] = [...BUBBLE_PRESETS, ...SFX_PRESETS];

const PANEL_PAD = 24;
const TAIL_DROP = 50;
const CASCADE = 28;
const CASCADE_STEPS = 8;
/** A bubble shrinks to fit a small panel, but not so far that its text stops being readable. */
const MIN_SCALE = 0.6;
const SFX_MIN_W = 120;
/** Used only when nothing can measure: wide enough for the heaviest font, so a word never wraps. */
const WIDE_GLYPH = 1.05;
const LATIN_GLYPH = 0.68;

/** Where a preset lands: the panel of the selected bubble or effect, else the first panel, else the page. */
export function presetTarget(
  shapes: PanelShape[],
  size: Size,
  selected?: Pick<Bubble, 'x' | 'y' | 'w' | 'h'> | null,
  effectPanelId?: ID | null,
): { box: Rect; panelId: ID | null } {
  const picked = effectPanelId ?? (selected ? hitTestPanel(shapes, bubbleCenter(selected)) : null);
  const shape = shapes.find(item => item.id === picked) ?? shapes[0];
  if (!shape) {
    return {
      box: { x: PAGE_MARGIN, y: PAGE_MARGIN, w: size.w - PAGE_MARGIN * 2, h: size.h - PAGE_MARGIN * 2 },
      panelId: null,
    };
  }
  // A bleed panel runs past the page edge. Only the part on the page counts.
  const x = Math.max(0, shape.bbox.x);
  const y = Math.max(0, shape.bbox.y);
  return {
    box: { x, y, w: Math.min(size.w, shape.bbox.x + shape.bbox.w) - x, h: Math.min(size.h, shape.bbox.y + shape.bbox.h) - y },
    panelId: shape.id,
  };
}

function isWide(char: string): boolean {
  return (char.codePointAt(0) ?? 0) >= 0x2e80;
}

function roughWidth(text: string, fontSize: number, letterSpacing: number): number {
  const chars = [...text];
  const units = chars.reduce((sum, char) => sum + (isWide(char) ? WIDE_GLYPH : char === ' ' ? 0.3 : LATIN_GLYPH), 0);
  return units * fontSize + letterSpacing * chars.length;
}

type PresetOptions = {
  /** With it the box follows the real text. Without it the box comes from a rough guess. */
  measure?: TextMeasure | null;
  /** Bubbles already on the page: a second preset in the same panel steps aside and does not hide the first. */
  taken?: Pick<Bubble, 'x' | 'y' | 'w' | 'h'>[];
  id?: ID;
};

/**
 * A sound-effect style whose font has the script of the word. Katakana in a Latin display style would
 * be drawn by a fallback anyway: taking the Japanese style says so in the style row.
 */
function sfxStyleFor(index: number, text: string): number {
  const font = (SFX_STYLES[index] ?? SFX_STYLES[0]).font;
  const script = scriptOf(text);
  if (!script || FONT_SCRIPTS[font].includes(script)) {
    return index;
  }
  const wanted = script === 'vi' ? 'hand' : font === 'hand' ? 'marker' : 'heavy';
  const found = SFX_STYLES.findIndex(style => style.font === wanted);
  return found < 0 ? index : found;
}

function sfxBody(preset: LetteringPreset, text: string, maxW: number, measure?: TextMeasure | null) {
  const wanted = SFX_STYLES[preset.style.sfxStyle ?? 0] ?? SFX_STYLES[0];
  const sfxStyle = sfxStyleFor(preset.style.sfxStyle ?? 0, text);
  const style = SFX_STYLES[sfxStyle] ?? SFX_STYLES[0];
  const edge = (preset.style.outline ?? 0) * 2;
  // The slant belongs to the word, so it stays when the style moves to another font.
  const base: Partial<Bubble> = { ...preset.style, text, sfxStyle, font: style.font, skew: preset.style.skew ?? wanted.skew };
  let fontSize = preset.style.fontSize;
  let w: number;
  if (measure) {
    // A sound effect is laid out with a line height of about its font size, so the height counts lines.
    const lines = (size: number, width: number) =>
      measure(createBubble('sfx', { x: 0, y: 0 }, { ...base, fontSize: size, w: width, h: size }), size, width) / size;
    while (lines(fontSize, maxW) > 1.5 && fontSize > clampFontSize('sfx', 0)) {
      fontSize = clampFontSize('sfx', fontSize - 4);
    }
    // The narrowest box that still holds the word on one line, so the frame hugs it.
    let low = 0;
    let high = maxW;
    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2;
      if (lines(fontSize, mid) > 1.5) {
        low = mid;
      } else {
        high = mid;
      }
    }
    w = high + edge + fontSize * 0.1;
  } else {
    const rough = roughWidth(text, fontSize, style.letterSpacing) + edge;
    if (rough > maxW) {
      fontSize = clampFontSize('sfx', Math.floor((fontSize * maxW) / rough));
    }
    w = roughWidth(text, fontSize, style.letterSpacing) + edge;
  }
  w = Math.max(Math.min(SFX_MIN_W, maxW), Math.min(maxW, Math.ceil(w)));
  return { ...base, fontSize, w, h: Math.ceil(fontSize * 1.3 + edge) };
}

function speechBody(preset: LetteringPreset, text: string, maxW: number, maxH: number, measure?: TextMeasure | null) {
  const w0 = preset.w ?? 260;
  const h0 = preset.h ?? 170;
  const drop = preset.tail ? TAIL_DROP : 0;
  const scale = Math.max(MIN_SCALE, Math.min(1, maxW / w0, maxH / (h0 + drop)));
  const fontSize = Math.max(Math.min(MIN_FONT_SIZE, preset.style.fontSize), Math.round(preset.style.fontSize * scale));
  const font = fontForText(preset.style.font ?? 'hand', text);
  const base: Partial<Bubble> = { ...preset.style, font, text, fontSize, w: Math.round(w0 * scale), h: Math.round(h0 * scale) };
  const fitted = sized(createBubble(preset.type, { x: 0, y: 0 }, base), Math.max(base.h ?? 0, maxH - drop * scale), measure ?? null);
  return { ...base, h: Math.round(fitted.h), drop: drop * scale };
}

function freeCenter(start: Pt, taken: Pick<Bubble, 'x' | 'y' | 'w' | 'h'>[]): Pt {
  const centers = taken.map(bubbleCenter);
  let c = start;
  for (let i = 0; i < CASCADE_STEPS && centers.some(p => Math.abs(p.x - c.x) < 4 && Math.abs(p.y - c.y) < 4); i++) {
    c = { x: c.x + CASCADE, y: c.y + CASCADE };
  }
  return c;
}

/** The bubble a preset makes, centred in the target box and sized to stay inside it. */
export function presetBubble(preset: LetteringPreset, text: string, target: Rect, options: PresetOptions = {}): Bubble {
  const pad = Math.min(PANEL_PAD, target.w * 0.05);
  const maxW = Math.max(40, target.w - pad * 2);
  const maxH = Math.max(40, target.h - pad * 2);
  const taken = options.taken ?? [];
  const init: Partial<Bubble> = options.id ? { id: options.id } : {};
  if (preset.type === 'sfx') {
    const body = sfxBody(preset, text, maxW, options.measure);
    const center = freeCenter({ x: target.x + target.w / 2, y: target.y + target.h / 2 }, taken);
    return createBubble('sfx', center, { ...body, ...init });
  }
  const { drop, ...body } = speechBody(preset, text, maxW, maxH, options.measure);
  const center = freeCenter({ x: target.x + target.w / 2, y: target.y + target.h / 2 - drop / 2 }, taken);
  const w = body.w ?? 0;
  const h = body.h ?? 0;
  const tail = preset.tail ? { x: center.x - w * 0.15, y: center.y + h / 2 + drop } : null;
  return createBubble(preset.type, center, { ...body, tail, ...init });
}

/** Everything a bubble draws, tail and edges included: what a thumbnail has to show. */
export function bubbleExtent(item: Bubble): Rect {
  const box = bubbleBounds(item);
  // A shout's spikes reach past its box, and a narration box throws a shadow.
  const spikes = item.type === 'shout' ? 0.12 : 0;
  const edge = BUBBLE_STROKE * 2 + (item.outline ?? 0) + (item.type === 'narration' ? 6 : 0);
  const mx = box.w * spikes + edge;
  const my = box.h * spikes + edge;
  let x0 = box.x - mx;
  let y0 = box.y - my;
  let x1 = box.x + box.w + mx;
  let y1 = box.y + box.h + my;
  if (item.tail) {
    x0 = Math.min(x0, item.tail.x - edge);
    y0 = Math.min(y0, item.tail.y - edge);
    x1 = Math.max(x1, item.tail.x + edge);
    y1 = Math.max(y1, item.tail.y + edge);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
