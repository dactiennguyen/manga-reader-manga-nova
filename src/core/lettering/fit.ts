import type { Bubble } from '../model/types';
import { MIN_FONT_SIZE, textInset } from './bubbles';
import { TRANSLATED_MIN_FONT_SIZE } from './translation';

/** Height of the bubble text laid out at this size and width. Render supplies it, core never sees Skia. */
export type TextMeasure = (bubble: Bubble, fontSize: number, width: number) => number;

export type TextFit = { fontSize: number; width: number; height: number; overflow: boolean };

export function fitBubbleText(bubble: Bubble, measure: TextMeasure, minFontSize: number = MIN_FONT_SIZE): TextFit {
  const inset = textInset(bubble);
  const width = Math.max(20, bubble.w - inset.x * 2);
  const maxHeight = Math.max(20, bubble.h - inset.y * 2);
  const floor = Math.min(minFontSize, bubble.fontSize);
  let fontSize = bubble.fontSize;
  let height = 0;
  for (;;) {
    height = measure(bubble, fontSize, width);
    if (bubble.type === 'sfx' || height <= maxHeight || fontSize <= floor) {
      break;
    }
    fontSize = Math.max(floor, fontSize - 2);
  }
  return { fontSize, width, height, overflow: bubble.type !== 'sfx' && height > maxHeight };
}

export function fitTranslatedText(original: Bubble, translated: Bubble, measure: TextMeasure): TextFit {
  if (translated.type !== 'sfx') {
    return fitBubbleText(translated, measure, TRANSLATED_MIN_FONT_SIZE);
  }
  const source = fitBubbleText(original, measure);
  const maxHeight = Math.max(source.height, original.h);
  const floor = Math.min(TRANSLATED_MIN_FONT_SIZE * 2, translated.fontSize);
  let fontSize = translated.fontSize;
  let height = 0;
  for (;;) {
    height = measure(translated, fontSize, source.width);
    if (height <= maxHeight || fontSize <= floor) {
      break;
    }
    fontSize = Math.max(floor, fontSize - 4);
  }
  return { fontSize, width: source.width, height, overflow: height > maxHeight };
}
