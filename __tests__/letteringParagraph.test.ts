import { LOCALES, setLocale, t } from '../src/core/i18n';
import { SFX_STYLES } from '../src/core/lettering/bubbles';
import { fitBubbleText } from '../src/core/lettering/fit';
import { BUBBLE_FONTS, FONT_FAMILY, fontFamilies } from '../src/core/lettering/fonts';
import { PRESETS, bubbleExtent, presetBubble } from '../src/core/lettering/presets';
import type { BubbleFont } from '../src/core/model/types';
import { bubbleThumb, fontSample } from '../src/features/lettering/previewImages';
import { bubbleMeasure, drawBubble } from '../src/render/drawBubble';

/**
 * The real Skia paragraph code, built for WebAssembly, with the real font files and no system fonts.
 * It answers what a unit test with a fake cannot: does the family list make Skia fall back.
 */
jest.mock('@shopify/react-native-skia', () => {
  const types = jest.requireActual('@shopify/react-native-skia/lib/commonjs/skia/types');
  return {
    ...types,
    get Skia() {
      return (globalThis as unknown as { mockSkia: unknown }).mockSkia;
    },
  };
});

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

type NodeFs = { readFileSync: (path: string) => Uint8Array; writeFileSync: (path: string, data: Uint8Array) => void };
const { process } = globalThis as unknown as {
  process: { getBuiltinModule: (name: string) => unknown; cwd: () => string; env: Record<string, string | undefined> };
};
const fs = process.getBuiltinModule('node:fs') as NodeFs;

let Skia: any;
let fonts: any;

beforeAll(async () => {
  const init = jest.requireActual('canvaskit-wasm/bin/full/canvaskit');
  const CanvasKit = await init({});
  Skia = jest.requireActual('@shopify/react-native-skia/lib/commonjs/skia/web').JsiSkApi(CanvasKit);
  (globalThis as unknown as { mockSkia: unknown }).mockSkia = Skia;
  fonts = Skia.TypefaceFontProvider.Make();
  for (const font of BUBBLE_FONTS) {
    const data = Skia.Data.fromBytes(fs.readFileSync(`${process.cwd()}/src/assets/fonts/${FILES[font]}`));
    fonts.registerFont(Skia.Typeface.MakeFreeTypeFaceFromData(data), FONT_FAMILY[font]);
  }
}, 60000);

const MIXED = 'Ối trời ơi, đừng mà! ạ ế ữ ợ đ Ầ Ỹ こんにちは！ドキドキ ゴゴゴ 漢字の台詞、三年後。';
// One line per script, each drawn as a bubble of its own: the family list follows the script of the text.
const LINES = {
  ko: '안녕, 하나야! 늦었잖아… ㅋㅋ 쾅! 두근두근',
  'zh-Hans': '你迟到了！我们快走吧，这里没有人。砰！轰隆',
  'zh-Hant': '你遲到了！我們快走吧，這裡沒有人。砰！轟隆',
  th: 'สวัสดีครับ! ไปกันเถอะ ปัง! ตึกตัก',
};

function unresolved(families: string[], text: string): string {
  const style = { color: Skia.Color('black'), fontFamilies: families, fontSize: 28 };
  const paragraph = Skia.ParagraphBuilder.Make({ textStyle: style }, fonts).pushStyle(style).addText(text).build();
  paragraph.layout(2000);
  return String.fromCodePoint(...(paragraph.ref.unresolvedCodepoints() as number[]));
}

describe('paragraph fallback in Skia', () => {
  it('leaves Japanese undrawn in a Latin font on its own, which is what the fallback list is for', () => {
    expect(unresolved([FONT_FAMILY.hand], MIXED)).toContain('こ');
    expect(unresolved([FONT_FAMILY.marker], MIXED)).toContain('ữ');
  });

  it('draws Vietnamese and Japanese in every font through its fallback list', () => {
    for (const font of BUBBLE_FONTS) {
      expect(`${font}:${unresolved(fontFamilies(font), MIXED)}`).toBe(`${font}:`);
    }
  });

  it('draws Korean, Chinese and Thai in every font, each line in one face after the chosen one', () => {
    for (const font of BUBBLE_FONTS) {
      for (const [script, text] of Object.entries(LINES)) {
        const families = fontFamilies(font, text);
        expect(`${font} ${script}:${unresolved(families, text)}`).toBe(`${font} ${script}:`);
        // Past the chosen font, the next face draws all of the rest, so a line never mixes three faces.
        const own = unresolved([families[0]], text);
        if (own) {
          expect(`${font} ${script}:${unresolved([families[1]], own.replace(/[\s!?,.…]/g, ''))}`).toBe(`${font} ${script}:`);
        }
      }
    }
  });

  it('draws every preset, in every interface language, in one font and with no missing letter', () => {
    const measure = bubbleMeasure(fonts);
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const preset of PRESETS) {
        const bubble = presetBubble(preset, t(preset.text), { x: 0, y: 0, w: 1000, h: 1000 }, { measure });
        // A word set half in one font and half in its fallback looks broken, so the first family has to do.
        // Jua has no ellipsis: that one mark comes from the rounded face, whose Latin is closest to it.
        const font = bubble.type === 'sfx' ? SFX_STYLES[bubble.sfxStyle as number].font : bubble.font;
        const missing = unresolved([FONT_FAMILY[font]], bubble.text).replace(font === 'bubbly' ? /…/g : /^$/, '');
        expect(`${locale} ${preset.id}:${missing}`).toBe(`${locale} ${preset.id}:`);
        if (bubble.type === 'sfx') {
          expect(`${locale} ${preset.id} one line: ${measure(bubble, bubble.fontSize, bubble.w) < bubble.fontSize * 1.5}`).toBe(
            `${locale} ${preset.id} one line: true`,
          );
        }
      }
    }
    setLocale('en');
  });

  it('fits the sample text of every bubble preset in its box at the size it asks for', () => {
    const measure = bubbleMeasure(fonts);
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const preset of PRESETS.filter(item => item.type !== 'sfx')) {
        const bubble = presetBubble(preset, t(preset.text), { x: 0, y: 0, w: 1000, h: 1000 }, { measure });
        const fit = fitBubbleText(bubble, measure);
        expect(`${locale} ${preset.id} ${fit.overflow} ${fit.fontSize}`).toBe(`${locale} ${preset.id} false ${preset.style.fontSize}`);
      }
    }
    setLocale('en');
  });

  it('makes a picture of every font name and of a preset for the sheets', () => {
    for (const font of BUBBLE_FONTS) {
      const sample = fontSample(font, fonts, 17, 2);
      expect(sample?.uri.startsWith('data:image/png;base64,iVBOR')).toBe(true);
      expect(sample?.width).toBeGreaterThan(30);
      expect(sample?.height).toBeGreaterThan(12);
    }
    for (const id of ['speech', 'reaction', 'sfx-boom']) {
      const preset = PRESETS.find(item => item.id === id) as (typeof PRESETS)[number];
      const bubble = presetBubble(preset, t(preset.text), { x: 0, y: 0, w: 1000, h: 1000 }, { id: `preset-${id}` });
      expect(bubbleThumb(bubble, fonts, 96, 56, 2)).toMatchObject({ width: 96, height: 56 });
    }
  });

  const out = process.env.LETTERING_SHEET_DIR;
  (out ? it : it.skip)('writes a contact sheet of the presets for a look by eye', () => {
    const measure = bubbleMeasure(fonts);
    // This build of CanvasKit has no path simplify. The thought cloud then shows its inner outlines, here only.
    Skia.Path.Simplify = () => null;
    const cell = { w: 300, h: 190 };
    const columns = 6;
    for (const locale of LOCALES) {
      setLocale(locale);
      const rows = Math.ceil(PRESETS.length / columns);
      const surface = Skia.Surface.Make(cell.w * columns, cell.h * rows);
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color('#C8C8C8'));
      PRESETS.forEach((preset, index) => {
        const bubble = presetBubble(preset, t(preset.text), { x: 0, y: 0, w: 1000, h: 1000 }, { id: `preset-${preset.id}`, measure });
        const box = bubbleExtent(bubble);
        const scale = Math.min((cell.w - 16) / box.w, (cell.h - 16) / box.h);
        canvas.save();
        canvas.translate((index % columns) * cell.w + (cell.w - box.w * scale) / 2 - box.x * scale, Math.floor(index / columns) * cell.h + (cell.h - box.h * scale) / 2 - box.y * scale);
        canvas.scale(scale, scale);
        drawBubble(canvas, bubble, fonts);
        canvas.restore();
      });
      surface.flush();
      fs.writeFileSync(`${out}/presets-${locale}.png`, surface.makeImageSnapshot().encodeToBytes());
    }
    setLocale('en');
  });
});
