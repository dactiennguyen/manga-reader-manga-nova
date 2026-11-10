import { ImageFormat, Skia, TextAlign, type SkCanvas, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import { FONT_NAME, FONT_SCRIPTS, fontFamilies } from '../../core/lettering/fonts';
import { bubbleExtent } from '../../core/lettering/presets';
import type { Bubble, BubbleFont } from '../../core/model/types';
import { drawBubble } from '../../render/drawBubble';

/** A small picture as a data URI, with its size in dp. */
export type Preview = { uri: string; width: number; height: number };

const cache = new Map<string, Preview | null>();
const jobs: (() => void)[] = [];
let pumping = false;

/** One picture per frame, so a sheet full of tiles opens at once and then fills in. */
function pump(): void {
  const job = jobs.shift();
  if (!job) {
    pumping = false;
    return;
  }
  job();
  requestAnimationFrame(pump);
}

function enqueue(job: () => void): void {
  jobs.push(job);
  if (!pumping) {
    pumping = true;
    requestAnimationFrame(pump);
  }
}

function snapshot(width: number, height: number, ratio: number, draw: (canvas: SkCanvas) => void): Preview | null {
  try {
    const surface = Skia.Surface.Make(Math.ceil(width * ratio), Math.ceil(height * ratio));
    if (!surface) {
      return null;
    }
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    canvas.scale(ratio, ratio);
    draw(canvas);
    surface.flush();
    const image = surface.makeImageSnapshot();
    const data = image.encodeToBase64(ImageFormat.PNG, 100);
    image.dispose();
    surface.dispose();
    return { uri: `data:image/png;base64,${data}`, width, height };
  } catch {
    // The tile falls back to plain text.
    return null;
  }
}

/** The bubble as the page renderer draws it, scaled to fit the box. */
export function bubbleThumb(bubble: Bubble, fonts: SkTypefaceFontProvider, width: number, height: number, ratio: number): Preview | null {
  const box = bubbleExtent(bubble);
  const scale = Math.min(width / box.w, height / box.h);
  return snapshot(width, height, ratio, canvas => {
    canvas.translate((width - box.w * scale) / 2 - box.x * scale, (height - box.h * scale) / 2 - box.y * scale);
    canvas.scale(scale, scale);
    drawBubble(canvas, bubble, fonts);
  });
}

/** The font's own name set in the font, in black: the image is tinted to the text colour where it is shown. */
export function fontSample(font: BubbleFont, fonts: SkTypefaceFontProvider, fontSize: number, ratio: number): Preview | null {
  try {
    const style = { color: Skia.Color('black'), fontFamilies: fontFamilies(font), fontSize };
    const text = FONT_SCRIPTS[font].includes('ja') ? `${FONT_NAME[font]} あア` : FONT_NAME[font];
    const paragraph = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left, textStyle: style }, fonts)
      .pushStyle(style)
      .addText(text)
      .build();
    paragraph.layout(1000);
    const width = Math.ceil(paragraph.getLongestLine()) + 2;
    return snapshot(width, Math.ceil(paragraph.getHeight()), ratio, canvas => paragraph.paint(canvas, 1, 0));
  } catch {
    return null;
  }
}

/**
 * Draws once per key and keeps the result for the life of the app. The key must name everything the
 * picture depends on. Null until it is ready, and for good when it cannot be drawn.
 */
export function usePreview(key: string | null, make: () => Preview | null): Preview | null {
  const [held, setHeld] = useState<{ key: string; preview: Preview | null } | null>(() =>
    key && cache.has(key) ? { key, preview: cache.get(key) ?? null } : null,
  );
  useEffect(() => {
    if (!key) {
      return;
    }
    if (cache.has(key)) {
      setHeld(current => (current?.key === key ? current : { key, preview: cache.get(key) ?? null }));
      return;
    }
    let alive = true;
    enqueue(() => {
      if (!alive) {
        return;
      }
      if (!cache.has(key)) {
        cache.set(key, make());
      }
      setHeld({ key, preview: cache.get(key) ?? null });
    });
    return () => {
      alive = false;
    };
    // make is new on every render. The key is what says the picture changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key && held?.key === key ? held.preview : null;
}
