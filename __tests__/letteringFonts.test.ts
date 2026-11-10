import { parseProjectBundle } from '../src/core/archive/parse';
import { SFX_STYLES, createBubble } from '../src/core/lettering/bubbles';
import {
  BUBBLE_FONTS,
  DEFAULT_FONT,
  FONT_FAMILY,
  FONT_LABEL,
  FONT_NAME,
  FONT_SCRIPTS,
  fontChain,
  fontFamilies,
  fontForText,
  fontsFor,
  isBubbleFont,
  knownFont,
  scriptOf,
  type FontScript,
} from '../src/core/lettering/fonts';
import type { Bubble, BubbleFont } from '../src/core/model/types';
import { bubbleMeasure } from '../src/render/drawBubble';
import { readFileSync } from './helpers/fs';

const mockFamilies: unknown[][] = [];

jest.mock('@shopify/react-native-skia', () => ({
  PaintStyle: {},
  PathOp: {},
  StrokeCap: {},
  StrokeJoin: {},
  TextAlign: {},
  Skia: {
    Color: (value: string) => value,
    ParagraphBuilder: {
      Make: (style: { textStyle: { fontFamilies: unknown[] } }) => {
        mockFamilies.push(style.textStyle.fontFamilies);
        const builder = {
          pushStyle: () => builder,
          addText: () => builder,
          build: () => ({ layout: () => {}, getHeight: () => 10 }),
        };
        return builder;
      },
    },
  },
}));

const FILES: Record<BubbleFont, string> = {
  hand: 'PatrickHand-Regular.ttf',
  sans: 'BeVietnamPro-Regular.ttf',
  sansBold: 'BeVietnamPro-Bold.ttf',
  display: 'Anton-Regular.ttf',
  comic: 'Bangers-Regular.ttf',
  casual: 'Mali-Medium.ttf',
  rounded: 'MPLUSRounded1c-Medium.ttf',
  marker: 'YuseiMagic-Regular.ttf',
  heavy: 'DelaGothicOne-Regular.ttf',
};

type NodeFs = { readFileSync: (path: string) => Uint8Array; statSync: (path: string) => { size: number } };
const { process } = globalThis as unknown as { process: { getBuiltinModule: (name: string) => unknown; cwd: () => string } };
const fs = process.getBuiltinModule('node:fs') as NodeFs;
const fontPath = (font: BubbleFont) => `${process.cwd()}/src/assets/fonts/${FILES[font]}`;

/** The characters a TrueType file maps to a glyph, read from its cmap table (formats 4 and 12). */
function charactersOf(bytes: Uint8Array): Set<number> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Set<number>();
  const tables = view.getUint16(4);
  let cmap = 0;
  for (let i = 0; i < tables; i++) {
    const record = 12 + i * 16;
    if (view.getUint32(record) === 0x636d6170) {
      cmap = view.getUint32(record + 8);
    }
  }
  const count = view.getUint16(cmap + 2);
  for (let i = 0; i < count; i++) {
    const at = cmap + view.getUint32(cmap + 4 + i * 8 + 4);
    const format = view.getUint16(at);
    if (format === 12) {
      const groups = view.getUint32(at + 12);
      for (let g = 0; g < groups; g++) {
        const start = view.getUint32(at + 16 + g * 12);
        const end = view.getUint32(at + 20 + g * 12);
        for (let code = start; code <= end; code++) {
          found.add(code);
        }
      }
    } else if (format === 4) {
      const segments = view.getUint16(at + 6) / 2;
      const ends = at + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const offsets = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const start = view.getUint16(starts + s * 2);
        const end = view.getUint16(ends + s * 2);
        const delta = view.getUint16(deltas + s * 2);
        const offset = view.getUint16(offsets + s * 2);
        for (let code = start; code <= end && code < 0xffff; code++) {
          const glyph = offset ? view.getUint16(offsets + s * 2 + offset + (code - start) * 2) : (code + delta) % 0x10000;
          if (glyph) {
            found.add(code);
          }
        }
      }
    }
  }
  return found;
}

/** Every precomposed Vietnamese letter, both cases. */
const VIETNAMESE = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y']
  .flatMap(base => ['', '̀', '́', '̉', '̃', '̣'].map(tone => (base + tone).normalize('NFC')))
  .concat('đ')
  .flatMap(letter => [letter, letter.toUpperCase()]);

// Hiragana ぁ to ゔ, katakana ァ to ヶ and the long mark, with a line of everyday kanji and punctuation.
const KANA = [...Array(0x3094 - 0x3041 + 1).keys()].map(i => 0x3041 + i).concat([...Array(0x30f6 - 0x30a1 + 1).keys()].map(i => 0x30a1 + i), 0x30fc);
const JAPANESE = KANA.map(code => String.fromCodePoint(code)).concat([...'日本語漢字台詞俺私僕君誰何時間今明暗強弱愛恋戦闘勝負夢心声音光闇空海山川風雨雪花火水木金土、。「」！？…']);

const SAMPLE: Record<FontScript, string[]> = { vi: VIETNAMESE, ja: JAPANESE };
const SCRIPTS: FontScript[] = ['vi', 'ja'];

describe('lettering fonts', () => {
  const coverage = new Map<BubbleFont, Set<number>>();
  beforeAll(() => {
    BUBBLE_FONTS.forEach(font => coverage.set(font, charactersOf(fs.readFileSync(fontPath(font)))));
  });
  const draws = (font: BubbleFont, script: FontScript) =>
    SAMPLE[script].every(letter => coverage.get(font)?.has(letter.codePointAt(0) as number));

  it('keeps the four names old stories use, with the same Skia families', () => {
    expect(BUBBLE_FONTS.slice(0, 4)).toEqual(['hand', 'sans', 'sansBold', 'display']);
    expect(FONT_FAMILY).toMatchObject({ hand: 'PatrickHand', sans: 'BeVietnamPro', sansBold: 'BeVietnamProBold', display: 'Anton' });
  });

  it('describes every font and gives each its own family', () => {
    expect(VIETNAMESE.filter(letter => letter > '\u007f')).toHaveLength(134);
    for (const font of BUBBLE_FONTS) {
      expect(FONT_LABEL[font]).toBeTruthy();
      expect(FONT_NAME[font]).toBeTruthy();
      expect(FONT_SCRIPTS[font]).toBeDefined();
    }
    expect(new Set(Object.values(FONT_FAMILY)).size).toBe(BUBBLE_FONTS.length);
  });

  it('loads a file for every font, and the loader names the same files', () => {
    const loader = readFileSync('src/render/fonts.ts');
    for (const font of BUBBLE_FONTS) {
      expect(loader).toContain(`${font}: require('../assets/fonts/${FILES[font]}')`);
      expect(coverage.get(font)?.has(0x41)).toBe(true);
    }
  });

  it('tags a font Vietnamese or Japanese exactly when its file has those letters', () => {
    for (const font of BUBBLE_FONTS) {
      for (const script of SCRIPTS) {
        expect(`${font} ${script} ${draws(font, script)}`).toBe(`${font} ${script} ${FONT_SCRIPTS[font].includes(script)}`);
      }
    }
  });

  it('keeps the new font files inside the 12 MB budget', () => {
    const added = BUBBLE_FONTS.slice(4).reduce((sum, font) => sum + fs.statSync(fontPath(font)).size, 0);
    expect(added).toBeLessThan(12 * 1024 * 1024);
  });

  it('falls back to fonts that between them draw Vietnamese and Japanese, whatever font is chosen', () => {
    for (const font of BUBBLE_FONTS) {
      const chain = fontChain(font);
      expect(chain[0]).toBe(font);
      expect(new Set(chain).size).toBe(chain.length);
      for (const script of SCRIPTS) {
        expect(chain.some(item => draws(item, script))).toBe(true);
      }
    }
  });

  it('gives heavy faces a heavy Japanese fallback and text faces a text one', () => {
    expect(fontChain('display')[1]).toBe('heavy');
    expect(fontChain('comic')[1]).toBe('heavy');
    expect(fontChain('sansBold')[1]).toBe('heavy');
    expect(fontChain('sans')[1]).toBe('rounded');
    expect(fontChain('hand')[1]).toBe('rounded');
    // Yusei Magic has no Vietnamese: a handwritten face with it comes next.
    expect(fontChain('marker')[1]).toBe('hand');
  });

  it('tells Japanese and Vietnamese text from plain Latin', () => {
    expect(scriptOf('Hello! café (phù…)')).toBeNull();
    expect(scriptOf('ドン')).toBe('ja');
    expect(scriptOf('三年後')).toBe('ja');
    expect(scriptOf('Xin chào ạ')).toBe('vi');
    expect(scriptOf('THI\u0300NH THI\u0323CH')).toBe('vi');
  });

  it('starts a bubble in a font that has the script of its text', () => {
    expect(fontForText('hand', 'Hello!')).toBe('hand');
    expect(fontForText('hand', 'こんにちは！')).toBe('rounded');
    expect(fontForText('comic', '危ない！')).toBe('heavy');
    expect(fontForText('marker', '（ふう…）')).toBe('marker');
    expect(fontForText('marker', 'Trời ạ')).toBe('hand');
    expect(fontForText('heavy', 'Trời ạ')).toBe('heavy');
  });

  it('lists the fonts that have the interface language first', () => {
    expect(fontsFor('en')).toEqual(BUBBLE_FONTS);
    expect(fontsFor('ja').slice(0, 3)).toEqual(['rounded', 'marker', 'heavy']);
    expect(fontsFor('vi').at(-1)).toBe('marker');
    expect([...fontsFor('ja')].sort()).toEqual([...BUBBLE_FONTS].sort());
  });

  it('uses the default for a font name it does not know', () => {
    expect(isBubbleFont('hand')).toBe(true);
    for (const value of ['comicSans', '', 'toString', '__proto__', undefined, null, 3]) {
      expect(isBubbleFont(value)).toBe(false);
      expect(knownFont(value)).toBe(DEFAULT_FONT);
      expect(fontFamilies(value)).toEqual(fontFamilies(DEFAULT_FONT));
    }
  });

  it('only adds sound-effect styles after the six that stored bubbles point at', () => {
    expect(SFX_STYLES.slice(0, 6).map(style => [style.label, style.font, style.letterSpacing, style.skew])).toEqual([
      ['Bold', 'display', 1, 0],
      ['Slant', 'display', 2, -0.25],
      ['Wide', 'display', 10, 0],
      ['Hand', 'hand', 2, -0.12],
      ['Block', 'sansBold', 1, 0],
      ['Shake', 'sansBold', 6, 0.2],
    ]);
    expect(SFX_STYLES.every(style => isBubbleFont(style.font))).toBe(true);
  });
});

describe('paragraph fonts', () => {
  const measure = bubbleMeasure({} as never);
  const families = (bubble: Bubble): unknown[] => {
    mockFamilies.length = 0;
    measure(bubble, bubble.fontSize, 200);
    return mockFamilies[0];
  };
  const speech = (patch: Partial<Bubble>) => createBubble('speak', { x: 0, y: 0 }, { text: 'こんにちは', ...patch });

  it('hands Skia the chosen family first and the fallbacks after it', () => {
    expect(families(speech({ font: 'hand' }))).toEqual(['PatrickHand', 'MPLUSRounded1c', 'YuseiMagic']);
    expect(families(speech({ font: 'marker', text: 'Ối trời ơi' }))).toEqual(['YuseiMagic', 'PatrickHand', 'MPLUSRounded1c']);
  });

  it('still swaps Sans for Sans bold on a bold bubble', () => {
    expect(families(speech({ font: 'sans', bold: true }))[0]).toBe('BeVietnamProBold');
    expect(families(speech({ font: 'sans', bold: false }))[0]).toBe('BeVietnamPro');
  });

  it('takes the font of a sound effect from its style, also for a style index it does not have', () => {
    const sfx = (sfxStyle: number) => createBubble('sfx', { x: 0, y: 0 }, { text: 'ドン', sfxStyle });
    expect(families(sfx(7))).toEqual(['DelaGothicOne', 'MPLUSRounded1c', 'YuseiMagic']);
    expect(families(sfx(0))).toEqual(['Anton', 'DelaGothicOne', 'MPLUSRounded1c']);
    expect(families(sfx(99))).toEqual(families(sfx(0)));
  });

  it('draws a bubble whose font name is unknown in the default font, and never passes Skia a missing name', () => {
    const odd = speech({ font: 'papyrus' as BubbleFont });
    expect(families(odd)).toEqual(fontFamilies(DEFAULT_FONT));
    expect(families({ ...odd, font: undefined as unknown as BubbleFont }).every(name => typeof name === 'string')).toBe(true);
  });
});

describe('fonts in a story file', () => {
  const bundle = (fonts: unknown[]) =>
    JSON.stringify({
      version: 1,
      project: { id: 'p', title: 'Story', acts: [] },
      chapters: [{ id: 'c' }],
      scenes: [],
      characters: [],
      relations: [],
      world: [],
      pages: [{ id: 'page', chapterId: 'c', bubbles: fonts.map((font, index) => ({ id: `b${index}`, type: 'speak', text: 'Hi', font })) }],
    });
  const fontsOf = (json: string) => parseProjectBundle(json).pages[0].bubbles.map(item => item.font as unknown);

  it('reads the four old names and the new ones unchanged', () => {
    expect(fontsOf(bundle(['hand', 'sans', 'sansBold', 'display']))).toEqual(['hand', 'sans', 'sansBold', 'display']);
    expect(fontsOf(bundle(BUBBLE_FONTS))).toEqual(BUBBLE_FONTS);
  });

  it('opens a file with an unknown or missing font, and draws that bubble in the default font', () => {
    const fonts = fontsOf(bundle(['papyrus', undefined]));
    expect(fonts).toEqual(['papyrus', undefined]);
    expect(fonts.map(knownFont)).toEqual([DEFAULT_FONT, DEFAULT_FONT]);
  });
});
