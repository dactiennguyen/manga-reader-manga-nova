import {
  ClipOp,
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
  type SkImage,
  type SkPath,
  type SkPicture,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { artHasVisibleContent, artImageUris } from '../core/art/strokes';
import { computePanels, isRtl, pageSize, type PanelShape, type Poly, type Size } from '../core/layout/layout';
import { SHOT_LABEL } from '../core/model/constants';
import type { ID, Page, Project } from '../core/model/types';
import { renderDeps } from './config';
import { drawArt } from './drawArt';
import { drawBubble } from './drawBubble';
import { drawEffect } from './drawEffect';
import { FONT_FAMILY, loadFonts } from './fonts';
import { loadImage } from './images';
import { INK, PAPER } from './ink';

export const PANEL_BORDER = 5;

const PLACEHOLDER_INK = '#9A958E';

export type PageDrawOptions = {
  art?: boolean;
  effects?: boolean;
  bubbles?: boolean;
  borders?: boolean;
  placeholders?: boolean;
  background?: string | null;
  dimExceptPanelId?: ID;
  skipArtPanelId?: ID;
  skipBubbleId?: ID;
  lang?: string;
};

export type PageContext = { page: Page; project: Project; size: Size; shapes: PanelShape[]; rtl: boolean };

export function buildPageContext(page: Page, project: Project): PageContext {
  const size = pageSize(project, page);
  const rtl = isRtl(project);
  return { page, project, size, rtl, shapes: computePanels(page, size, { rtl }) };
}

export function pageContext(pageId: ID): PageContext | null {
  const source = renderDeps().pageSource(pageId);
  return source ? buildPageContext(source.page, source.project) : null;
}

export function polyPath(poly: Poly): SkPath {
  return Skia.Path.Polygon(
    poly.map(p => Skia.Point(p.x, p.y)),
    true,
  );
}

function drawPlaceholder(
  canvas: SkCanvas,
  shape: PanelShape,
  text: string,
  fonts: SkTypefaceFontProvider | null,
): void {
  if (!fonts || !text) {
    return;
  }
  const builder = Skia.ParagraphBuilder.Make(
    {
      textAlign: TextAlign.Center,
      textStyle: {
        color: Skia.Color(PLACEHOLDER_INK),
        fontFamilies: [FONT_FAMILY.sans],
        fontSize: 24,
        heightMultiplier: 1.2,
      },
    },
    fonts,
  );
  builder.addText(text);
  const paragraph = builder.build();
  const width = Math.max(40, shape.bbox.w - 48);
  paragraph.layout(width);
  paragraph.paint(canvas, shape.bbox.x + 24, shape.bbox.y + shape.bbox.h / 2 - paragraph.getHeight() / 2);
}

export function drawPage(
  canvas: SkCanvas,
  ctx: PageContext,
  fonts: SkTypefaceFontProvider | null,
  options: PageDrawOptions = {},
): void {
  const { page, size, shapes } = ctx;
  const { loadArt } = renderDeps();
  const background = options.background === undefined ? PAPER : options.background;
  if (background) {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(background));
    canvas.drawRect(Skia.XYWHRect(0, 0, size.w, size.h), paint);
  }
  const white = Skia.Paint();
  white.setColor(Skia.Color(PAPER));
  white.setAntiAlias(true);
  const border = Skia.Paint();
  border.setAntiAlias(true);
  border.setStyle(PaintStyle.Stroke);
  border.setStrokeWidth(PANEL_BORDER);
  border.setStrokeJoin(StrokeJoin.Miter);
  border.setColor(Skia.Color(INK));

  for (const shape of shapes) {
    const panel = page.panels[shape.id];
    const path = polyPath(shape.poly);
    canvas.save();
    canvas.clipPath(path, ClipOp.Intersect, true);
    canvas.drawPath(path, white);
    const art = options.art === false || shape.id === options.skipArtPanelId ? null : loadArt(shape.id);
    if (art) {
      drawArt(canvas, art);
    }
    if (options.placeholders && !artHasVisibleContent(art) && panel) {
      const label = [panel.shot ? SHOT_LABEL[panel.shot] : '', panel.description].filter(Boolean).join(' · ');
      drawPlaceholder(canvas, shape, label, fonts);
    }
    if (options.effects !== false) {
      for (const effect of page.effects) {
        if (effect.panelId === shape.id) {
          drawEffect(canvas, effect, shape);
        }
      }
    }
    canvas.restore();
    if (options.borders !== false && !panel?.borderless) {
      canvas.drawPath(path, border);
    }
  }

  if (options.dimExceptPanelId) {
    const active = shapes.find(shape => shape.id === options.dimExceptPanelId);
    canvas.save();
    if (active) {
      canvas.clipPath(polyPath(active.poly), ClipOp.Difference, true);
    }
    const veil = Skia.Paint();
    veil.setColor(Skia.Color('rgba(255,255,255,0.72)'));
    canvas.drawRect(Skia.XYWHRect(0, 0, size.w, size.h), veil);
    canvas.restore();
  }

  if (options.bubbles !== false) {
    for (const bubble of page.bubbles) {
      if (bubble.id !== options.skipBubbleId) {
        drawBubble(canvas, bubble, fonts, options.lang);
      }
    }
  }
}

export function recordPage(
  ctx: PageContext,
  fonts: SkTypefaceFontProvider | null,
  options: PageDrawOptions = {},
): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, ctx.size.w, ctx.size.h));
  drawPage(canvas, ctx, fonts, options);
  return recorder.finishRecordingAsPicture();
}

async function preloadPageImages(ctx: PageContext): Promise<void> {
  const { loadArt } = renderDeps();
  const uris = ctx.shapes.flatMap(shape => artImageUris(loadArt(shape.id)));
  await Promise.all(uris.map(loadImage));
}

export async function renderPageImage(
  pageId: ID,
  widthPx: number,
  options: PageDrawOptions = {},
): Promise<SkImage | null> {
  const ctx = pageContext(pageId);
  if (!ctx) {
    return null;
  }
  const fonts = await loadFonts();
  await preloadPageImages(ctx);
  const scale = widthPx / ctx.size.w;
  const surface = Skia.Surface.Make(Math.round(widthPx), Math.round(ctx.size.h * scale));
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  drawPage(canvas, ctx, fonts, options);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

export async function renderPageToFile(
  pageId: ID,
  widthPx: number,
  absolutePath: string,
  format: 'png' | 'jpg' = 'png',
  options: PageDrawOptions = {},
): Promise<boolean> {
  const image = await renderPageImage(pageId, widthPx, options);
  if (!image) {
    return false;
  }
  const base64 =
    format === 'jpg' ? image.encodeToBase64(ImageFormat.JPEG, 92) : image.encodeToBase64(ImageFormat.PNG, 100);
  image.dispose();
  await renderDeps().files.writeBase64(absolutePath, base64);
  return true;
}
