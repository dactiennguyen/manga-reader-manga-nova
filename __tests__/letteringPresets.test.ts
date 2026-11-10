import { CATALOG } from '../src/core/i18n/catalog';
import { computePanels, type Rect } from '../src/core/layout/layout';
import { clampFontSize } from '../src/core/lettering/bubbleEdit';
import { MIN_FONT_SIZE, SFX_STYLES, bubbleCenter } from '../src/core/lettering/bubbles';
import type { TextMeasure } from '../src/core/lettering/fit';
import { isBubbleFont } from '../src/core/lettering/fonts';
import { INITIAL_LETTERING, letteringReducer } from '../src/core/lettering/letteringState';
import {
  BUBBLE_PRESETS,
  PRESETS,
  SFX_GROUPS,
  SFX_PRESETS,
  bubbleExtent,
  presetBubble,
  presetTarget,
  type LetteringPreset,
} from '../src/core/lettering/presets';
import type { Page } from '../src/core/model/types';

const PANEL: Rect = { x: 100, y: 200, w: 600, h: 500 };
const SIZE = { w: 1000, h: 1412 };

const preset = (id: string): LetteringPreset => PRESETS.find(item => item.id === id) as LetteringPreset;

/** Every character as wide as the font size: a word wraps as soon as the box is narrower than it. */
const measure: TextMeasure = (bubble, fontSize, width) =>
  Math.max(1, Math.ceil((bubble.text.length * fontSize) / width)) * fontSize * (bubble.type === 'sfx' ? 1 : 1.15);

function twoPanels() {
  const page = {
    layout: { kind: 'split', id: 's', dir: 'h', t0: 0.5, t1: 0.5, a: { kind: 'panel', id: 'top' }, b: { kind: 'panel', id: 'bottom' } },
    panels: {},
    gutterH: 20,
    gutterV: 20,
  } as unknown as Page;
  return computePanels(page, SIZE, { rtl: true });
}

describe('preset list', () => {
  it('offers at least 8 bubbles and 16 sound effects, each with its own id', () => {
    expect(BUBBLE_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(SFX_PRESETS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(PRESETS.map(item => item.id)).size).toBe(PRESETS.length);
  });

  it('only uses bubble kinds, fonts and sound-effect styles the renderer has', () => {
    for (const item of BUBBLE_PRESETS) {
      expect(item.type).not.toBe('sfx');
      expect(isBubbleFont(item.style.font)).toBe(true);
      expect(item.w).toBeGreaterThan(0);
      expect(item.h).toBeGreaterThan(0);
    }
    for (const item of SFX_PRESETS) {
      expect(item.type).toBe('sfx');
      expect(SFX_STYLES[item.style.sfxStyle as number]).toBeDefined();
      expect(item.style.fontSize).toBe(clampFontSize('sfx', item.style.fontSize));
    }
  });

  it('covers the narration styles, the speech kinds and a frameless caption', () => {
    const kinds = new Set(BUBBLE_PRESETS.map(item => item.type));
    expect([...kinds].sort()).toEqual(['machine', 'narration', 'shout', 'speak', 'think', 'whisper']);
    const boxes = new Set(BUBBLE_PRESETS.map(item => item.style.narrationStyle).filter(Boolean));
    expect([...boxes].sort()).toEqual(['box', 'inverse', 'plain']);
  });

  it('puts every sound effect in a listed group, and leaves no group empty', () => {
    for (const group of SFX_GROUPS) {
      expect(SFX_PRESETS.some(item => item.group === group.key)).toBe(true);
    }
    const keys = SFX_GROUPS.map(group => group.key as string);
    expect(SFX_PRESETS.every(item => keys.includes(item.group))).toBe(true);
  });

  it('has a Vietnamese and a Japanese word for every sound effect, in the right script', () => {
    for (const item of SFX_PRESETS) {
      const entry = CATALOG[item.text];
      expect(entry).toBeDefined();
      expect(entry.vi).not.toBe(item.text);
      expect(entry.ja).toMatch(/^[぀-ヿ…]+$/);
    }
  });
});

describe('preset target', () => {
  const shapes = twoPanels();

  it('is the first panel in reading order when nothing is selected', () => {
    const target = presetTarget(shapes, SIZE);
    expect(target.panelId).toBe(shapes[0].id);
    expect(target.box).toEqual(shapes[0].bbox);
  });

  it('is the panel under the selected bubble', () => {
    const inSecond = presetBubble(preset('speech'), 'Hi', shapes[1].bbox);
    expect(presetTarget(shapes, SIZE, inSecond).panelId).toBe(shapes[1].id);
  });

  it('is the panel of the selected effect', () => {
    expect(presetTarget(shapes, SIZE, null, shapes[1].id).panelId).toBe(shapes[1].id);
  });

  it('falls back to the first panel when the selected bubble sits outside every panel', () => {
    expect(presetTarget(shapes, SIZE, { x: -500, y: -500, w: 10, h: 10 }).panelId).toBe(shapes[0].id);
  });

  it('is the page inside its margins when there are no panels', () => {
    const target = presetTarget([], SIZE);
    expect(target.panelId).toBeNull();
    expect(target.box.x).toBeGreaterThan(0);
    expect(target.box.x + target.box.w).toBeLessThan(SIZE.w);
    expect(target.box.y + target.box.h).toBeLessThan(SIZE.h);
  });

  it('keeps only the part of a bleed panel that is on the page', () => {
    const bleed = [{ ...shapes[0], bbox: { x: -20, y: -20, w: SIZE.w + 40, h: 400 } }];
    expect(presetTarget(bleed, SIZE).box).toEqual({ x: 0, y: 0, w: SIZE.w, h: 380 });
  });
});

describe('preset bubble', () => {
  it('centres the bubble and its tail in the panel at full size when there is room', () => {
    const made = presetBubble(preset('speech'), 'Hello!', PANEL);
    expect(made).toMatchObject({ type: 'speak', text: 'Hello!', w: 270, h: 160, font: 'hand', fontSize: 30, rotation: 0 });
    expect(bubbleCenter(made).x).toBe(PANEL.x + PANEL.w / 2);
    const tail = made.tail as { x: number; y: number };
    expect((made.y + tail.y) / 2).toBeCloseTo(PANEL.y + PANEL.h / 2, 5);
    expect(tail.y).toBeGreaterThan(made.y + made.h);
  });

  it('carries the recipe: burst with display text, black narration, frameless caption', () => {
    expect(presetBubble(preset('reaction'), 'WHAT?!', PANEL)).toMatchObject({ type: 'shout', font: 'display', bold: false, tail: null });
    expect(presetBubble(preset('inverse'), 'x', PANEL)).toMatchObject({ type: 'narration', narrationStyle: 'inverse', tail: null });
    expect(presetBubble(preset('caption'), 'x', PANEL)).toMatchObject({ type: 'narration', narrationStyle: 'plain' });
    expect(presetBubble(preset('whisper'), 'x', PANEL).type).toBe('whisper');
    expect(presetBubble(preset('thought'), 'x', PANEL).tail).not.toBeNull();
  });

  it('shrinks to fit a small panel and stays inside it', () => {
    const small: Rect = { x: 50, y: 50, w: 240, h: 220 };
    const made = presetBubble(preset('shout'), 'Watch out!', small);
    expect(made.w).toBeLessThan(320);
    expect(made.x).toBeGreaterThanOrEqual(small.x);
    expect(made.x + made.w).toBeLessThanOrEqual(small.x + small.w);
    expect(made.fontSize).toBeLessThan(44);
  });

  it('never shrinks the text below the readable size', () => {
    const made = presetBubble(preset('whisper'), 'Psst', { x: 0, y: 0, w: 60, h: 60 });
    expect(made.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
    expect(made.w).toBeGreaterThanOrEqual(250 * 0.6 - 1);
  });

  it('grows a bubble whose text does not fit, when it can measure', () => {
    const long = 'A translated line that is a good deal longer than the sample was';
    const plain = presetBubble(preset('speech'), long, PANEL);
    const fitted = presetBubble(preset('speech'), long, PANEL, { measure });
    expect(fitted.h).toBeGreaterThan(plain.h);
    expect(fitted.y + fitted.h).toBeLessThanOrEqual(PANEL.y + PANEL.h);
  });

  it('makes a sound effect with its style, edge and tilt, and no tail', () => {
    const made = presetBubble(preset('sfx-boom'), 'BOOM', PANEL);
    const recipe = preset('sfx-boom').style;
    expect(made).toMatchObject({ type: 'sfx', text: 'BOOM', tail: null, sfxStyle: recipe.sfxStyle, outline: recipe.outline });
    expect(made.rotation).toBe(recipe.rotation);
    expect(made.font).toBe(SFX_STYLES[recipe.sfxStyle as number].font);
    expect(made.skew).toBe(SFX_STYLES[recipe.sfxStyle as number].skew);
    expect(bubbleCenter(made)).toEqual({ x: PANEL.x + PANEL.w / 2, y: PANEL.y + PANEL.h / 2 });
  });

  it('moves a sound effect to a style whose font has the script of the word, and keeps its slant', () => {
    const style = (id: string, text: string) => presetBubble(preset(id), text, PANEL);
    const whoosh = preset('sfx-whoosh').style;
    expect(style('sfx-whoosh', 'WHOOSH').sfxStyle).toBe(whoosh.sfxStyle);
    expect(style('sfx-whoosh', 'VÙ').sfxStyle).toBe(whoosh.sfxStyle);
    expect(style('sfx-whoosh', 'ビュン')).toMatchObject({ font: 'heavy', skew: whoosh.skew, rotation: whoosh.rotation });
    expect(SFX_STYLES[style('sfx-whoosh', 'ビュン').sfxStyle as number].font).toBe('heavy');
    expect(SFX_STYLES[style('sfx-shhh', 'シーッ').sfxStyle as number].font).toBe('marker');
    expect(SFX_STYLES[style('sfx-shhh', 'SUỴT').sfxStyle as number].font).toBe('hand');
  });

  it('starts a bubble in a font that has the script of its text', () => {
    expect(presetBubble(preset('speech'), 'こんにちは！', PANEL).font).toBe('rounded');
    expect(presetBubble(preset('shout'), '危ない！', PANEL).font).toBe('heavy');
    expect(presetBubble(preset('shout'), 'Coi chừng!', PANEL).font).toBe('comic');
    expect(presetBubble(preset('aside'), '（ふう…）', PANEL).font).toBe('marker');
  });

  it('keeps a sound effect on one line: wider first, then smaller', () => {
    for (const text of ['THUMP-THUMP', 'ドキドキ', 'THÌNH THỊCH']) {
      const made = presetBubble(preset('sfx-thump-thump'), text, PANEL, { measure });
      expect(measure(made, made.fontSize, made.w)).toBe(made.fontSize);
      expect(made.w).toBeLessThanOrEqual(PANEL.w);
    }
    const narrow = presetBubble(preset('sfx-boom'), 'ドカーン', { x: 0, y: 0, w: 220, h: 400 }, { measure });
    expect(narrow.fontSize).toBeLessThan(120);
    expect(measure(narrow, narrow.fontSize, narrow.w)).toBe(narrow.fontSize);
  });

  it('gives full-width kana more room than Latin letters when it cannot measure', () => {
    const latin = presetBubble(preset('sfx-tick'), 'TICK', PANEL);
    const kana = presetBubble(preset('sfx-tick'), 'カチッカ', PANEL);
    expect(kana.w).toBeGreaterThan(latin.w);
  });

  it('steps aside when a bubble already sits at the centre', () => {
    const first = presetBubble(preset('sfx-bam'), 'BAM', PANEL);
    const second = presetBubble(preset('sfx-bam'), 'BAM', PANEL, { taken: [first] });
    const third = presetBubble(preset('sfx-bam'), 'BAM', PANEL, { taken: [first, second] });
    expect(bubbleCenter(second)).not.toEqual(bubbleCenter(first));
    expect(bubbleCenter(third)).not.toEqual(bubbleCenter(second));
    expect(first.id).not.toBe(second.id);
  });

  it('takes a fixed id for a thumbnail, so a burst looks the same on every draw', () => {
    expect(presetBubble(preset('shout'), 'x', PANEL, { id: 'preset-shout' }).id).toBe('preset-shout');
  });

  it('measures everything a bubble draws, tail included', () => {
    const made = presetBubble(preset('speech'), 'Hello!', PANEL);
    const extent = bubbleExtent(made);
    const tail = made.tail as { x: number; y: number };
    expect(extent.x).toBeLessThan(made.x);
    expect(extent.y + extent.h).toBeGreaterThan(tail.y);
    const burst = presetBubble(preset('reaction'), 'x', PANEL);
    expect(bubbleExtent(burst).w).toBeGreaterThan(burst.w * 1.2);
  });
});

describe('placing a preset', () => {
  it('selects it, shows hidden bubbles, closes the sheet and opens no editor', () => {
    const state = [
      { type: 'toggleBubbles' } as const,
      { type: 'openSheet', sheet: 'presets' } as const,
      { type: 'placedPreset', id: 'b1' } as const,
    ].reduce(letteringReducer, INITIAL_LETTERING);
    expect(state).toMatchObject({ sheet: null, hideBubbles: false, pending: null, selection: { kind: 'bubble', id: 'b1' } });
  });
});
