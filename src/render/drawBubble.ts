import {
  PaintStyle,
  PathOp,
  Skia,
  StrokeCap,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
  type SkParagraph,
  type SkPath,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import type { Pt } from '../core/layout/layout';
import {
  BUBBLE_STROKE,
  SFX_STYLES,
  bubbleCenter,
  burstPoints,
  chamferPoints,
  cloudShape,
  hasBodyTail,
  tailShape,
  textInset,
  thoughtTrail,
  toBubbleLocal,
} from '../core/lettering/bubbles';
import { fitBubbleText, fitTranslatedText, type TextMeasure } from '../core/lettering/fit';
import { fontFamilies } from '../core/lettering/fonts';
import { localizeBubble } from '../core/lettering/translation';
import type { Bubble } from '../core/model/types';
import { INK, PAPER } from './ink';

function polygon(points: Pt[]): SkPath {
  const builder = Skia.PathBuilder.Make().moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    builder.lineTo(points[i].x, points[i].y);
  }
  return builder.close().build();
}

function tailPath(bubble: Bubble, tip: Pt): SkPath {
  const shape = tailShape(bubble, tip);
  if (shape.kind === 'zigzag') {
    return polygon([shape.start, ...shape.points]);
  }
  if (shape.kind === 'spike') {
    return polygon([shape.start, shape.tip, shape.end]);
  }
  return Skia.PathBuilder.Make()
    .moveTo(shape.start.x, shape.start.y)
    .quadTo(shape.c1.x, shape.c1.y, shape.tip.x, shape.tip.y)
    .quadTo(shape.c2.x, shape.c2.y, shape.end.x, shape.end.y)
    .close()
    .build();
}

function cloudPath(bubble: Bubble): SkPath {
  const { body, bumps, radius } = cloudShape(bubble);
  const builder = Skia.PathBuilder.Make();
  builder.addOval(Skia.XYWHRect(body.x, body.y, body.w, body.h));
  bumps.forEach(p => builder.addCircle(p.x, p.y, radius));
  const path = builder.build();
  return Skia.Path.Simplify(path) ?? path;
}

export function bubbleBodyPath(bubble: Bubble): SkPath | null {
  const rect = Skia.XYWHRect(bubble.x, bubble.y, bubble.w, bubble.h);
  switch (bubble.type) {
    case 'sfx':
      return null;
    case 'narration':
      return bubble.narrationStyle === 'plain' ? null : Skia.Path.Rect(rect);
    case 'machine':
      return polygon(chamferPoints(bubble));
    case 'think':
      return cloudPath(bubble);
    case 'shout':
      return polygon(burstPoints(bubble));
    default:
      return Skia.Path.Oval(rect);
  }
}

function withTail(bubble: Bubble, body: SkPath): SkPath {
  if (!hasBodyTail(bubble) || !bubble.tail) {
    return body;
  }
  const tip = toBubbleLocal(bubble, bubble.tail);
  return Skia.Path.MakeFromOp(body, tailPath(bubble, tip), PathOp.Union) ?? body;
}

function buildParagraph(
  bubble: Bubble,
  fonts: SkTypefaceFontProvider,
  fontSize: number,
  color: string,
  stroke?: { width: number; color: string },
): SkParagraph {
  const sfxStyle = bubble.type === 'sfx' ? SFX_STYLES[bubble.sfxStyle ?? 0] ?? SFX_STYLES[0] : null;
  const font = sfxStyle ? sfxStyle.font : bubble.bold && bubble.font === 'sans' ? 'sansBold' : bubble.font;
  const textStyle = {
    color: Skia.Color(color),
    fontFamilies: fontFamilies(font),
    fontSize,
    heightMultiplier: sfxStyle ? 1 : 1.15,
    letterSpacing: sfxStyle ? sfxStyle.letterSpacing : 0,
  };
  const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center, textStyle }, fonts);
  if (stroke) {
    const paint = Skia.Paint();
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(stroke.width);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(stroke.color));
    builder.pushStyle(textStyle, paint);
  } else {
    builder.pushStyle(textStyle);
  }
  builder.addText(bubble.text || ' ');
  return builder.build();
}

/** The measuring function core/lettering expects, backed by Skia's paragraph layout. */
export function bubbleMeasure(fonts: SkTypefaceFontProvider): TextMeasure {
  return (bubble, fontSize, width) => {
    const paragraph = buildParagraph(bubble, fonts, fontSize, INK);
    paragraph.layout(width);
    return paragraph.getHeight();
  };
}

function drawThoughtTrail(canvas: SkCanvas, bubble: Bubble): void {
  if (!bubble.tail) {
    return;
  }
  const tip = toBubbleLocal(bubble, bubble.tail);
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(PAPER));
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeWidth(BUBBLE_STROKE);
  line.setColor(Skia.Color(INK));
  thoughtTrail(bubble, tip).forEach(({ x, y, r }) => {
    canvas.drawCircle(x, y, r, fill);
    canvas.drawCircle(x, y, r, line);
  });
}

export function drawBubble(
  canvas: SkCanvas,
  source: Bubble,
  fonts: SkTypefaceFontProvider | null,
  lang?: string | null,
): void {
  const bubble = localizeBubble(source, lang);
  const c = bubbleCenter(bubble);
  canvas.save();
  if (bubble.rotation) {
    canvas.rotate(bubble.rotation, c.x, c.y);
  }
  const inverse = bubble.type === 'narration' && bubble.narrationStyle === 'inverse';
  const body = bubbleBodyPath(bubble);
  if (body) {
    const path = withTail(bubble, body);
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    fill.setColor(Skia.Color(inverse ? INK : PAPER));
    canvas.drawPath(path, fill);
    const line = Skia.Paint();
    line.setAntiAlias(true);
    line.setStyle(PaintStyle.Stroke);
    line.setStrokeWidth(bubble.type === 'shout' ? BUBBLE_STROKE * 1.4 : BUBBLE_STROKE);
    line.setStrokeJoin(bubble.type === 'machine' || bubble.type === 'shout' ? StrokeJoin.Miter : StrokeJoin.Round);
    line.setColor(Skia.Color(INK));
    if (bubble.type === 'whisper') {
      line.setStrokeWidth(BUBBLE_STROKE * 0.8);
      line.setStrokeCap(StrokeCap.Round);
      line.setPathEffect(Skia.PathEffect.MakeDash([10, 9], 0));
    }
    if (bubble.type === 'narration' && bubble.narrationStyle !== 'inverse') {
      const shadow = Skia.Paint();
      shadow.setColor(Skia.Color(INK));
      canvas.drawRect(Skia.XYWHRect(bubble.x + 6, bubble.y + 6, bubble.w, bubble.h), shadow);
      canvas.drawPath(path, fill);
    }
    canvas.drawPath(path, line);
    if (bubble.type === 'think') {
      drawThoughtTrail(canvas, bubble);
    }
  }
  if (fonts && bubble.text.trim()) {
    const measure = bubbleMeasure(fonts);
    const fit = bubble === source ? fitBubbleText(bubble, measure) : fitTranslatedText(source, bubble, measure);
    const inset = textInset(bubble);
    const x = bubble.x + inset.x;
    const y = c.y - fit.height / 2;
    const color = bubble.color ?? (inverse ? PAPER : INK);
    if (bubble.type === 'sfx') {
      const style = SFX_STYLES[bubble.sfxStyle ?? 0] ?? SFX_STYLES[0];
      const skew = bubble.skew ?? style.skew;
      if (skew) {
        canvas.translate(c.x, c.y);
        canvas.skew(skew, 0);
        canvas.translate(-c.x, -c.y);
      }
      if (bubble.outline) {
        const outlineColor = bubble.outlineColor === 'black' ? INK : PAPER;
        const outlined = buildParagraph(bubble, fonts, fit.fontSize, outlineColor, {
          width: bubble.outline * 2,
          color: outlineColor,
        });
        outlined.layout(fit.width);
        outlined.paint(canvas, x, y);
      }
    }
    if (bubble.bold && bubble.type !== 'sfx' && bubble.font !== 'sansBold') {
      const heavy = buildParagraph(bubble, fonts, fit.fontSize, color, { width: fit.fontSize * 0.05, color });
      heavy.layout(fit.width);
      heavy.paint(canvas, x, y);
    }
    const paragraph = buildParagraph(bubble, fonts, fit.fontSize, color);
    paragraph.layout(fit.width);
    paragraph.paint(canvas, x, y);
  }
  canvas.restore();
}
