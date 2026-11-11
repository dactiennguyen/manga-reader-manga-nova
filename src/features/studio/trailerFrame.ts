import {
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
  type SkImage,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { artImageUris } from '../../core/art/strokes';
import { t } from '../../core/i18n';
import type { Rect } from '../../core/layout/layout';
import { fontFamilies } from '../../core/lettering/fonts';
import type { ID } from '../../core/model/types';
import {
  KEN_BURNS_ZOOM,
  TRAILER_COLORS,
  containWindow,
  shotAt,
  visibilityAt,
  windowAt,
  type PanelShot,
  type TrailerPlan,
  type TrailerShot,
} from '../../core/studio/trailer';
import { renderDeps } from '../../render/config';
import { PANEL_BORDER, drawPage, pageContext, polyPath } from '../../render/drawPage';
import { loadFonts } from '../../render/fonts';
import { loadImage } from '../../render/images';
import { INK, PAPER } from '../../render/ink';

const { ink: TRAILER_INK, paper: TRAILER_PAPER, coralOnPaper: CORAL_ON_PAPER, coralOnInk: CORAL_ON_INK, mutedOnPaper: MUTED_ON_PAPER } =
  TRAILER_COLORS;

/** Each drawn panel, cut out once at the size it is shown at its closest, with the part of the page it covers. */
export type TrailerAssets = {
  panels: Map<ID, { image: SkImage; window: Rect }>;
  fonts: SkTypefaceFontProvider | null;
  /** Text is laid out once per string and size. */
  paragraphs: Map<string, SkParagraph>;
};

export class TrailerCancelled extends Error {}

/** The widest view a shot ever shows: its pan and zoom stay inside it. */
function shotWindow(plan: TrailerPlan, shot: PanelShot): Rect {
  return containWindow(shot.bbox, plan.stage.w / plan.stage.h);
}

async function cutPanel(plan: TrailerPlan, shot: PanelShot, fonts: SkTypefaceFontProvider | null): Promise<SkImage | null> {
  const ctx = pageContext(shot.pageId);
  if (!ctx) {
    return null;
  }
  const { loadArt } = renderDeps();
  await Promise.all(artImageUris(loadArt(shot.panelId)).map(loadImage));
  const window = shotWindow(plan, shot);
  const scale = (plan.stage.w * KEN_BURNS_ZOOM) / window.w;
  const surface = Skia.Surface.Make(Math.round(window.w * scale), Math.round(window.h * scale));
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(TRAILER_INK));
  canvas.scale(scale, scale);
  canvas.translate(-window.x, -window.y);
  const outline = polyPath(shot.poly);
  canvas.save();
  canvas.clipPath(outline, ClipOp.Intersect, true);
  // Lettering is left off: the trailer shows the line as a caption, and a cut-off bubble looks broken.
  drawPage(canvas, ctx, fonts, { bubbles: false, borders: false, background: PAPER });
  canvas.restore();
  const border = Skia.Paint();
  border.setAntiAlias(true);
  border.setStyle(PaintStyle.Stroke);
  border.setStrokeWidth(PANEL_BORDER);
  border.setStrokeJoin(StrokeJoin.Miter);
  border.setColor(Skia.Color(INK));
  canvas.drawPath(outline, border);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

export async function loadTrailerAssets(plan: TrailerPlan, isCancelled: () => boolean = () => false): Promise<TrailerAssets> {
  const fonts = await loadFonts();
  const assets: TrailerAssets = { panels: new Map(), fonts, paragraphs: new Map() };
  for (const shot of plan.shots) {
    if (isCancelled()) {
      disposeTrailerAssets(assets);
      throw new TrailerCancelled();
    }
    if (shot.kind === 'panel' && !assets.panels.has(shot.panelId)) {
      const image = await cutPanel(plan, shot, fonts);
      if (image) {
        assets.panels.set(shot.panelId, { image, window: shotWindow(plan, shot) });
      }
    }
  }
  return assets;
}

export function disposeTrailerAssets(assets: TrailerAssets): void {
  assets.panels.forEach(item => item.image.dispose());
  assets.panels.clear();
  assets.paragraphs.clear();
}

type TextLook = { font: 'display' | 'sans' | 'sansBold'; size: number; color: string; spacing?: number };

function paragraph(assets: TrailerAssets, text: string, look: TextLook, width: number): SkParagraph | null {
  if (!assets.fonts || !text) {
    return null;
  }
  const key = `${look.font}|${look.size}|${look.color}|${width}|${text}`;
  let built = assets.paragraphs.get(key);
  if (!built) {
    const builder = Skia.ParagraphBuilder.Make(
      {
        textAlign: TextAlign.Center,
        maxLines: 4,
        ellipsis: '…',
        textStyle: {
          color: Skia.Color(look.color),
          fontFamilies: fontFamilies(look.font, text),
          fontSize: look.size,
          heightMultiplier: 1.15,
          letterSpacing: look.spacing ?? 0,
        },
      },
      assets.fonts,
    );
    builder.addText(text);
    built = builder.build();
    built.layout(width);
    assets.paragraphs.set(key, built);
  }
  return built;
}

/** Draws text centred across the frame with its top at `y`. Returns where it ends. */
function centred(canvas: SkCanvas, plan: TrailerPlan, assets: TrailerAssets, text: string, look: TextLook, y: number): number {
  const width = Math.round(plan.size.w * 0.84);
  const built = paragraph(assets, text, look, width);
  if (!built) {
    return y;
  }
  built.paint(canvas, (plan.size.w - width) / 2, y);
  return y + built.getHeight();
}

function fill(canvas: SkCanvas, plan: TrailerPlan, color: string, alpha = 1): void {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  canvas.drawRect(Skia.XYWHRect(0, 0, plan.size.w, plan.size.h), paint);
}

function storyTitle(plan: TrailerPlan): string {
  return plan.title || t('Untitled');
}

function drawTitleCard(canvas: SkCanvas, plan: TrailerPlan, assets: TrailerAssets): void {
  fill(canvas, plan, TRAILER_PAPER);
  const kicker = plan.penName ? t('A manga by {name}', { name: plan.penName }) : t('A new manga');
  let y = centred(canvas, plan, assets, kicker, { font: 'sansBold', size: 28, color: CORAL_ON_PAPER, spacing: 1 }, plan.size.h * 0.36);
  y = centred(canvas, plan, assets, storyTitle(plan), { font: 'display', size: 84, color: TRAILER_INK }, y + 28);
  const rule = Skia.Paint();
  rule.setColor(Skia.Color(CORAL_ON_PAPER));
  canvas.drawRect(Skia.XYWHRect(plan.size.w / 2 - 36, y + 36, 72, 6), rule);
}

function drawEndCard(canvas: SkCanvas, plan: TrailerPlan, assets: TrailerAssets): void {
  fill(canvas, plan, TRAILER_PAPER);
  const y = centred(canvas, plan, assets, storyTitle(plan), { font: 'display', size: 64, color: TRAILER_INK }, plan.size.h * 0.4);
  centred(canvas, plan, assets, t('Made with Manganova'), { font: 'sans', size: 28, color: MUTED_ON_PAPER }, y + 40);
}

function drawPanelShot(canvas: SkCanvas, plan: TrailerPlan, assets: TrailerAssets, shot: PanelShot, local: number): void {
  fill(canvas, plan, TRAILER_INK);
  const { stage, size } = plan;
  centred(canvas, plan, assets, storyTitle(plan), { font: 'sansBold', size: 26, color: TRAILER_PAPER, spacing: 1 }, stage.y * 0.36);
  const cut = assets.panels.get(shot.panelId);
  if (cut) {
    const view = windowAt(shot, local);
    const scale = cut.image.width() / cut.window.w;
    const src = Skia.XYWHRect((view.x - cut.window.x) * scale, (view.y - cut.window.y) * scale, view.w * scale, view.h * scale);
    canvas.save();
    canvas.clipRect(Skia.XYWHRect(stage.x, stage.y, stage.w, stage.h), ClipOp.Intersect, true);
    canvas.drawImageRectOptions(cut.image, src, Skia.XYWHRect(stage.x, stage.y, stage.w, stage.h), FilterMode.Linear, MipmapMode.None, null);
    canvas.restore();
  }
  if (shot.line) {
    let y = stage.y + stage.h + size.h * 0.035;
    if (shot.line.speaker) {
      y = centred(canvas, plan, assets, shot.line.speaker.toUpperCase(), { font: 'sansBold', size: 24, color: CORAL_ON_INK, spacing: 2 }, y) + 10;
    }
    const look: TextLook = shot.line.shout
      ? { font: 'display', size: 44, color: TRAILER_PAPER }
      : { font: 'sans', size: 34, color: TRAILER_PAPER };
    centred(canvas, plan, assets, shot.line.text, look, y);
  }
}

function drawShot(canvas: SkCanvas, plan: TrailerPlan, assets: TrailerAssets, shot: TrailerShot, local: number): void {
  if (shot.kind === 'title') {
    drawTitleCard(canvas, plan, assets);
  } else if (shot.kind === 'end') {
    drawEndCard(canvas, plan, assets);
  } else {
    drawPanelShot(canvas, plan, assets, shot, local);
  }
}

/** Draws one frame of the trailer at its full size: scale the canvas first to draw it smaller. */
export function drawTrailerFrame(canvas: SkCanvas, plan: TrailerPlan, assets: TrailerAssets, frame: number): void {
  const { shot, index, local } = shotAt(plan, frame);
  drawShot(canvas, plan, assets, shot, local);
  const visible = visibilityAt(shot, local, index === plan.shots.length - 1);
  if (visible < 1) {
    fill(canvas, plan, TRAILER_INK, 1 - visible);
  }
}
