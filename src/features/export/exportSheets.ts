import { Skia, TextAlign, type SkImage, type SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { Project } from '../../core/model/types';
import { dayKey } from '../../core/util/time';
import { FONT_FAMILY, loadFonts } from '../../render/fonts';
import { loadImage } from '../../render/images';
import { INK, PAPER } from '../../render/ink';

function paragraph(fonts: SkTypefaceFontProvider, text: string, family: string, fontSize: number, width: number) {
  const builder = Skia.ParagraphBuilder.Make(
    { textAlign: TextAlign.Center, textStyle: { color: Skia.Color(INK), fontFamilies: [family], fontSize } },
    fonts,
  );
  builder.addText(text);
  const built = builder.build();
  built.layout(width);
  return built;
}

/** Fonts and images are awaited here, so a cover never relies on something a screen loaded earlier. */
export async function renderCover(project: Project, penName: string, w: number, h: number): Promise<SkImage | null> {
  const surface = Skia.Surface.Make(w, h);
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(PAPER));
  const art = project.coverUri ? await loadImage(project.coverUri) : null;
  if (art) {
    const scale = Math.max(w / art.width(), h / art.height());
    const sw = w / scale;
    const sh = h / scale;
    const src = Skia.XYWHRect((art.width() - sw) / 2, (art.height() - sh) / 2, sw, sh);
    canvas.drawImageRect(art, src, Skia.XYWHRect(0, 0, w, h), Skia.Paint());
  } else {
    const fonts = await loadFonts();
    const inner = w * 0.84;
    const title = paragraph(fonts, project.title.toUpperCase(), FONT_FAMILY.display, w * 0.13, inner);
    const top = Math.max(h * 0.12, (h - title.getHeight()) / 2 - h * 0.06);
    title.paint(canvas, (w - inner) / 2, top);
    const rule = Skia.Paint();
    rule.setColor(Skia.Color(INK));
    canvas.drawRect(
      Skia.XYWHRect(w * 0.38, top + title.getHeight() + h * 0.03, w * 0.24, Math.max(4, w * 0.008)),
      rule,
    );
    if (penName.trim()) {
      const author = paragraph(fonts, penName.trim(), FONT_FAMILY.sansBold, w * 0.04, inner);
      author.paint(canvas, (w - inner) / 2, top + title.getHeight() + h * 0.07);
    }
  }
  surface.flush();
  return surface.makeImageSnapshot();
}

export async function renderInfo(project: Project, penName: string, w: number, h: number): Promise<SkImage | null> {
  const surface = Skia.Surface.Make(w, h);
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(PAPER));
  const fonts = await loadFonts();
  const inner = w * 0.8;
  const x = (w - inner) / 2;
  const title = paragraph(fonts, project.title.toUpperCase(), FONT_FAMILY.display, w * 0.07, inner);
  let y = h * 0.36;
  title.paint(canvas, x, y);
  y += title.getHeight() + h * 0.04;
  const lines = [penName.trim() ? `Author: ${penName.trim()}` : '', `Exported: ${dayKey()}`];
  for (const line of lines.filter(Boolean)) {
    const text = paragraph(fonts, line, FONT_FAMILY.sans, w * 0.032, inner);
    text.paint(canvas, x, y);
    y += text.getHeight() + h * 0.012;
  }
  surface.flush();
  return surface.makeImageSnapshot();
}
