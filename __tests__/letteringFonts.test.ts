import { parseProjectBundle } from '../src/core/archive/parse';
import { LOCALES, setLocale } from '../src/core/i18n';
import { SFX_STYLES, createBubble } from '../src/core/lettering/bubbles';
import {
  BUBBLE_FONTS,
  DEFAULT_FONT,
  FONT_FAMILY,
  FONT_LABEL,
  FONT_NAME,
  FONT_SCRIPTS,
  NO_ACCENTS,
  fontChain,
  fontFamilies,
  fontForText,
  fontsFor,
  isBubbleFont,
  knownFont,
  scriptOf,
  type FontScript,
} from '../src/core/lettering/fonts';
import { JAPANESE_KANJI, SIMPLIFIED_FORMS, TRADITIONAL_FORMS } from '../src/core/lettering/hanVariants';
import { hasAccentedLatin } from '../src/core/lettering/textScript';
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
  bubbly: 'Jua-Regular.ttf',
  playful: 'ZCOOLKuaiLe-Regular.ttf',
  soft: 'Huninn-Regular.ttf',
};

type NodeFs = { readFileSync: (path: string) => Uint8Array; statSync: (path: string) => { size: number } };
type Decoder = new (label: string) => { decode: (bytes: Uint8Array) => string };
const { process } = globalThis as unknown as { process: { getBuiltinModule: (name: string) => unknown; cwd: () => string } };
const fs = process.getBuiltinModule('node:fs') as NodeFs;
const { TextDecoder } = process.getBuiltinModule('node:util') as { TextDecoder: Decoder };
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

/**
 * Every two-byte code from `first` to `last` in a legacy encoding, decoded: the character set it was made for.
 * Second bytes below 0xA1 belong to later extensions of the encoding, except in Big5.
 */
function charset(encoding: string, first: number, last: number, lowTrail = false): string[] {
  const decoder = new TextDecoder(encoding);
  const found: string[] = [];
  for (let code = first; code <= last; code++) {
    const trail = code % 0x100;
    if (trail === 0xff || (trail < 0xa1 && !(lowTrail && trail >= 0x40 && trail <= 0x7e))) {
      continue;
    }
    const text = decoder.decode(Uint8Array.of(Math.floor(code / 0x100), trail));
    if ([...text].length === 1 && text !== '\ufffd') {
      found.push(text);
    }
  }
  return found;
}

// The 2,350 Hangul syllables of KS X 1001, which everyday Korean is written in, and the jamo of ㅋㅋ and ㅠㅠ.
const KOREAN = charset('euc-kr', 0xb0a1, 0xc8fe).concat([...Array(0x3163 - 0x3131 + 1).keys()].map(i => String.fromCodePoint(0x3131 + i)));
// The 3,755 everyday characters of GB 2312 (level 1) and the 5,401 of Big5 (level 1).
const SIMPLIFIED = charset('gbk', 0xb0a1, 0xd7f9);
const TRADITIONAL = charset('big5', 0xa440, 0xc67e, true);
// JIS X 0208, levels 1 and 2 (rows 1 to 84): every kanji everyday Japanese writes.
const JIS_X_0208 = new Set(charset('euc-jp', 0xa1a1, 0xf4fe));
const GB_2312 = new Set(charset('gbk', 0xa1a1, 0xf7fe));
const BIG5 = new Set(charset('big5', 0xa140, 0xf9fe, true));
// The accented letters of Spanish, Portuguese and French, both cases, and the Spanish marks.
const ACCENTED = [...'áéíóúñüçãõâêôàèìòùÁÉÍÓÚÑÜÇÃÕÂÊÔÀ¿¡'];
// Every Thai letter, vowel, tone mark and digit.
const THAI = [...Array(0x0e5b - 0x0e01 + 1).keys()].map(i => 0x0e01 + i).filter(code => code < 0x0e3b || code > 0x0e3e).map(code => String.fromCodePoint(code));

const SAMPLE: Record<FontScript, string[]> = { vi: VIETNAMESE, ja: JAPANESE, ko: KOREAN, 'zh-Hans': SIMPLIFIED, 'zh-Hant': TRADITIONAL, th: THAI };
// A Chinese face misses a few rare characters of the everyday sets; the Japanese faces miss a third of them.
const SHARE: Record<FontScript, number> = { vi: 1, ja: 1, ko: 1, 'zh-Hans': 0.99, 'zh-Hant': 0.99, th: 1 };
const SCRIPTS = Object.keys(SAMPLE) as FontScript[];

describe('lettering fonts', () => {
  const coverage = new Map<BubbleFont, Set<number>>();
  beforeAll(() => {
    BUBBLE_FONTS.forEach(font => coverage.set(font, charactersOf(fs.readFileSync(fontPath(font)))));
  });
  const draws = (font: BubbleFont, script: FontScript) =>
    SAMPLE[script].filter(letter => coverage.get(font)?.has(letter.codePointAt(0) as number)).length >= SAMPLE[script].length * SHARE[script];

  it('keeps the four names old stories use, with the same Skia families', () => {
    expect(BUBBLE_FONTS.slice(0, 4)).toEqual(['hand', 'sans', 'sansBold', 'display']);
    expect(FONT_FAMILY).toMatchObject({ hand: 'PatrickHand', sans: 'BeVietnamPro', sansBold: 'BeVietnamProBold', display: 'Anton' });
  });

  it('describes every font and gives each its own family', () => {
    expect(VIETNAMESE.filter(letter => letter > '\u007f')).toHaveLength(134);
    expect([KOREAN.length, SIMPLIFIED.length, TRADITIONAL.length, THAI.length]).toEqual([2350 + 51, 3755, 5401, 87]);
    for (const font of BUBBLE_FONTS) {
      expect(FONT_LABEL[font]).toBeTruthy();
      expect(FONT_NAME[font]).toBeTruthy();
      expect(FONT_SCRIPTS[font]).toBeDefined();
    }
    expect(new Set(Object.values(FONT_FAMILY)).size).toBe(BUBBLE_FONTS.length);
    expect(new Set(Object.values(FONT_LABEL)).size).toBe(BUBBLE_FONTS.length);
  });

  it('loads a file for every font, and the loader names the same files', () => {
    const loader = readFileSync('src/render/fonts.ts');
    for (const font of BUBBLE_FONTS) {
      expect(loader).toContain(`${font}: require('../assets/fonts/${FILES[font]}')`);
      expect(coverage.get(font)?.has(0x41)).toBe(true);
    }
  });

  it('tags a font with a script exactly when its file has those letters', () => {
    for (const font of BUBBLE_FONTS) {
      for (const script of SCRIPTS) {
        expect(`${font} ${script} ${draws(font, script)}`).toBe(`${font} ${script} ${FONT_SCRIPTS[font].includes(script)}`);
      }
    }
  });

  it('knows which faces have no accented Latin letters', () => {
    for (const font of BUBBLE_FONTS) {
      const all = ACCENTED.every(letter => coverage.get(font)?.has(letter.codePointAt(0) as number));
      expect(`${font} ${all}`).toBe(`${font} ${!NO_ACCENTS.includes(font)}`);
    }
  });

  it('keeps the added font files inside their budgets', () => {
    const size = (fonts: BubbleFont[]) => fonts.reduce((sum, font) => sum + fs.statSync(fontPath(font)).size, 0);
    // The Latin display faces and the Japanese ones.
    expect(size(['comic', 'casual', 'rounded', 'marker', 'heavy'])).toBeLessThan(12 * 1024 * 1024);
    // One face each for Korean, Simplified and Traditional Chinese (Thai is in Mali).
    expect(size(['bubbly', 'playful', 'soft'])).toBeLessThan(9 * 1024 * 1024);
  });

  it('has a bundled font for every script', () => {
    for (const script of SCRIPTS) {
      expect(`${script} ${BUBBLE_FONTS.some(font => FONT_SCRIPTS[font].includes(script))}`).toBe(`${script} true`);
    }
  });

  it('falls back to fonts that between them draw every script, whatever font is chosen', () => {
    for (const font of BUBBLE_FONTS) {
      for (const hint of [null, ...SCRIPTS]) {
        const chain = fontChain(font, hint);
        expect(chain[0]).toBe(font);
        expect(new Set(chain).size).toBe(chain.length);
        for (const script of SCRIPTS) {
          expect(`${font} ${hint} ${script} ${chain.some(item => draws(item, script))}`).toBe(`${font} ${hint} ${script} true`);
        }
      }
    }
  });

  it('puts the face for Korean, Chinese or Thai text right after the chosen font, ahead of the Japanese ones', () => {
    expect(fontChain('hand', 'ko').slice(0, 2)).toEqual(['hand', 'bubbly']);
    expect(fontChain('hand', 'zh-Hans').slice(0, 3)).toEqual(['hand', 'playful', 'soft']);
    expect(fontChain('display', 'zh-Hant').slice(0, 3)).toEqual(['display', 'soft', 'playful']);
    expect(fontChain('comic', 'th').slice(0, 2)).toEqual(['comic', 'casual']);
    // A font that has the script keeps its own order, and Japanese keeps the weight-matched faces.
    expect(fontChain('casual', 'th')).toEqual(fontChain('casual'));
    expect(fontChain('display', 'ja')).toEqual(fontChain('display'));
    expect(fontChain('display', 'ja')[1]).toBe('heavy');
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

  it('tells the scripts apart from plain Latin', () => {
    expect(scriptOf('Hello! café (phù…) ¿Qué? ação', 'en')).toBeNull();
    expect(scriptOf('¿Qué pasó?', 'es')).toBeNull();
    expect(scriptOf('Não, você está atrasado', 'pt')).toBeNull();
    expect(scriptOf('ドン')).toBe('ja');
    expect(scriptOf('ｷﾀ━', 'en')).toBe('ja');
    expect(scriptOf('漢字の台詞、三年後。', 'zh-Hans')).toBe('ja');
    expect(scriptOf('Xin chào ạ')).toBe('vi');
    expect(scriptOf('Rất vui được gặp bạn')).toBe('vi');
    expect(scriptOf('THI\u0300NH THI\u0323CH')).toBe('vi');
    expect(scriptOf('안녕, 하나야! ㅋㅋ')).toBe('ko');
    expect(scriptOf('ㅠㅠ')).toBe('ko');
    expect(scriptOf('\ua960')).toBe('ko');
    expect(scriptOf('สวัสดีครับ')).toBe('th');
    expect(scriptOf('你迟到了。我们走吧！')).toBe('zh-Hans');
    expect(scriptOf('你遲到了嗎？我們走吧！')).toBe('zh-Hant');
    expect(scriptOf('他说：“没关系。”', 'zh-Hant')).toBe('zh-Hans');
    expect(scriptOf('他說這裡沒有人', 'zh-Hans')).toBe('zh-Hant');
  });

  it('never takes a character Japanese writes for proof of Chinese', () => {
    const kanji = [...JIS_X_0208].filter(char => /[\u3400-\u9fff\uf900-\ufaff]/.test(char));
    expect([...JAPANESE_KANJI].sort()).toEqual(kanji.sort());
    // The Simplified forms are in GB 2312 and the Traditional ones in Big5, and no character is both.
    expect([...SIMPLIFIED_FORMS].filter(char => !GB_2312.has(char))).toEqual([]);
    expect([...TRADITIONAL_FORMS].filter(char => !BIG5.has(char))).toEqual([]);
    expect([...TRADITIONAL_FORMS].filter(char => SIMPLIFIED_FORMS.includes(char))).toEqual([]);
    expect(scriptOf('你遲到了！我們快走吧，這裡沒有人。噠噠')).toBe('zh-Hant');
    expect(scriptOf('你听！')).toBe('zh-Hans');
    // Everyday Japanese words in kanji of JIS level 2.
    for (const text of ['贅沢！', '躊躇', '櫻井', '威嚇', '饅頭', '籠城', '東京。', '三年後。']) {
      expect(`${text} ${scriptOf(text, 'ja')}`).toBe(`${text} ja`);
      expect(`${text} ${scriptOf(text)}`).toBe(`${text} ja`);
      expect(`${text} ${scriptOf(text, 'zh-Hant')}`).toBe(`${text} zh-Hant`);
    }
  });

  it('reads Han text that could be any of them by the language it is given, and by a fixed rule without one', () => {
    expect(scriptOf('三年後', 'ja')).toBe('ja');
    expect(scriptOf('三年後', 'zh-Hant')).toBe('zh-Hant');
    expect(scriptOf('三年後', 'zh-Hans')).toBe('zh-Hans');
    expect(scriptOf('三年後', 'en')).toBe('zh-Hans');
    expect(scriptOf('三年後')).toBe('ja');
    expect(scriptOf('！？', 'ja')).toBe('ja');
    expect(scriptOf('！？')).toBe('ja');
    // A character Japanese does not write makes it Chinese: of the form the language says, Simplified in
    // the other languages, and Traditional without one, whose face has the rarer characters.
    expect(scriptOf('你好', 'ja')).toBe('zh-Hans');
    expect(scriptOf('你好', 'en')).toBe('zh-Hans');
    expect(scriptOf('你好', 'zh-Hant')).toBe('zh-Hant');
    expect(scriptOf('你好')).toBe('zh-Hant');
    expect(scriptOf('噠')).toBe('zh-Hant');
  });

  it('starts a bubble in a font that has the script of its text', () => {
    expect(fontForText('hand', 'Hello!')).toBe('hand');
    expect(fontForText('hand', 'こんにちは！')).toBe('rounded');
    expect(fontForText('comic', '危ない！')).toBe('heavy');
    expect(fontForText('marker', '（ふう…）')).toBe('marker');
    expect(fontForText('marker', 'Trời ạ')).toBe('hand');
    expect(fontForText('heavy', 'Trời ạ')).toBe('heavy');
    expect(fontForText('hand', '안녕!')).toBe('bubbly');
    expect(fontForText('display', '你迟到了！')).toBe('playful');
    expect(fontForText('hand', '你遲到了嗎！')).toBe('soft');
    expect(fontForText('sans', 'สวัสดี')).toBe('casual');
    expect(fontForText('casual', 'สวัสดี')).toBe('casual');
  });

  it('starts accented Latin in a face that has the accents', () => {
    expect(hasAccentedLatin('¿Qué pasó?')).toBe(true);
    expect(hasAccentedLatin('Na\u0303o')).toBe(true);
    expect(hasAccentedLatin('Hello!')).toBe(false);
    expect(fontForText('bubbly', '¿Qué pasó?')).toBe('rounded');
    expect(fontForText('playful', 'Não, você está atrasado')).toBe('soft');
    expect(fontForText('bubbly', 'Trời ạ')).toBe('rounded');
    expect(fontForText('bubbly', 'Hello!')).toBe('bubbly');
    expect(fontForText('playful', 'Hello!')).toBe('playful');
    expect(fontForText('bubbly', '안녕, José!')).toBe('bubbly');
  });

  it('letters a story the same whatever the interface language', () => {
    const texts = ['三年後', '贅沢！', '你好', '你迟到了', '你遲到了嗎', '¿Qué?', 'Hello', 'こんにちは', '안녕'];
    const read = () => texts.map(text => [scriptOf(text), fontForText('hand', text), fontFamilies('display', text).join()]);
    const english = read();
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(read()).toEqual(english);
    }
    setLocale('en');
  });

  it('lists the fonts that have the interface language first, and those without accents last where they are needed', () => {
    expect(fontsFor('en')).toEqual(BUBBLE_FONTS);
    expect(fontsFor('ja').slice(0, 3)).toEqual(['rounded', 'marker', 'heavy']);
    expect(fontsFor('vi').slice(-2)).toEqual(['bubbly', 'playful']);
    expect([...fontsFor('ja')].sort()).toEqual([...BUBBLE_FONTS].sort());
    expect(fontsFor('ko')[0]).toBe('bubbly');
    expect(fontsFor('zh-Hans')[0]).toBe('playful');
    expect(fontsFor('zh-Hant')[0]).toBe('soft');
    expect(fontsFor('th')[0]).toBe('casual');
    const accentless = BUBBLE_FONTS.filter(font => !NO_ACCENTS.includes(font));
    for (const locale of LOCALES) {
      expect([...fontsFor(locale)].sort()).toEqual([...BUBBLE_FONTS].sort());
      const script = SCRIPTS.find(item => item === locale);
      if (script) {
        expect(`${locale} ${FONT_SCRIPTS[fontsFor(locale)[0]].includes(script)}`).toBe(`${locale} true`);
      } else if (locale === 'en') {
        expect(fontsFor(locale)).toEqual(BUBBLE_FONTS);
      } else {
        expect(fontsFor(locale)).toEqual([...accentless, ...NO_ACCENTS]);
      }
    }
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
    expect(families(speech({ font: 'hand' }))).toEqual(['PatrickHand', 'MPLUSRounded1c', 'YuseiMagic', 'Jua', 'ZCOOLKuaiLe', 'Huninn', 'Mali']);
    expect(families(speech({ font: 'marker', text: 'Ối trời ơi' }))).toEqual(['YuseiMagic', 'PatrickHand', 'MPLUSRounded1c', 'Jua', 'ZCOOLKuaiLe', 'Huninn', 'Mali']);
  });

  it('hands Skia the face for the script of the text right after the chosen family', () => {
    expect(families(speech({ font: 'hand', text: '안녕!' })).slice(0, 2)).toEqual(['PatrickHand', 'Jua']);
    expect(families(speech({ font: 'hand', text: '我们走吧' })).slice(0, 3)).toEqual(['PatrickHand', 'ZCOOLKuaiLe', 'Huninn']);
    expect(families(speech({ font: 'hand', text: '他說我們走吧' })).slice(0, 3)).toEqual(['PatrickHand', 'Huninn', 'ZCOOLKuaiLe']);
    // Kanji Japanese also writes, with nothing else to go by: the Japanese faces, in every interface language.
    expect(families(speech({ font: 'hand', text: '三年後' })).slice(0, 3)).toEqual(['PatrickHand', 'MPLUSRounded1c', 'YuseiMagic']);
    expect(families(speech({ font: 'sans', text: 'สวัสดี' })).slice(0, 2)).toEqual(['BeVietnamPro', 'Mali']);
  });

  it('still swaps Sans for Sans bold on a bold bubble', () => {
    expect(families(speech({ font: 'sans', bold: true }))[0]).toBe('BeVietnamProBold');
    expect(families(speech({ font: 'sans', bold: false }))[0]).toBe('BeVietnamPro');
  });

  it('takes the font of a sound effect from its style, also for a style index it does not have', () => {
    const sfx = (sfxStyle: number) => createBubble('sfx', { x: 0, y: 0 }, { text: 'ドン', sfxStyle });
    expect(families(sfx(7))).toEqual(['DelaGothicOne', 'MPLUSRounded1c', 'YuseiMagic', 'Jua', 'ZCOOLKuaiLe', 'Huninn', 'Mali']);
    expect(families(sfx(0))).toEqual(['Anton', 'DelaGothicOne', 'MPLUSRounded1c', 'Jua', 'ZCOOLKuaiLe', 'Huninn', 'Mali']);
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
