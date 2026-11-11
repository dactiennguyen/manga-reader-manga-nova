/**
 * Panel pictures for playing together: one panel drawn to a small JPEG to send to the others, and the
 * pictures that come back placed on a page as image layers, so a relay page or a battle drawing can be
 * kept in a story like any other page.
 */
import { ClipOp, ImageFormat, Skia } from '@shopify/react-native-skia';

import type { ID } from '../../../core/model/types';
import { saveImageData } from '../../../native/files';
import { drawArt } from '../../../render/drawArt';
import { pageContext, polyPath } from '../../../render/drawPage';
import { loadImage } from '../../../render/images';
import { PAPER } from '../../../render/ink';
import { loadArt, newLayer, saveArt } from '../../../state/artStore';
import { useStory } from '../../../state/useStory';

/** Wide enough to judge a drawing on another phone, small enough to send in a couple of chunks. */
const PANEL_PX = 720;
const JPEG_QUALITY = 82;

/** The panel's art on white, cropped to the panel. Null when the page or panel is gone. */
export async function renderPanelJpeg(pageId: ID, panelId: ID): Promise<string | null> {
  const ctx = pageContext(pageId);
  const shape = ctx?.shapes.find(item => item.id === panelId);
  if (!ctx || !shape) {
    return null;
  }
  const art = loadArt(panelId);
  await Promise.all((art?.layers ?? []).flatMap(layer => (layer.image ? [loadImage(layer.image.uri)] : [])));
  const { x, y, w, h } = shape.bbox;
  const scale = PANEL_PX / Math.max(1, w);
  const surface = Skia.Surface.Make(Math.round(w * scale), Math.max(1, Math.round(h * scale)));
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  canvas.translate(-x, -y);
  const paper = Skia.Paint();
  paper.setColor(Skia.Color(PAPER));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), paper);
  canvas.clipPath(polyPath(shape.poly), ClipOp.Intersect, true);
  drawArt(canvas, art);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  const base64 = image.encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);
  image.dispose();
  return base64;
}

/** Puts a received picture into a panel as its only layer, named after who drew it. */
export async function placePanelImage(pageId: ID, panelIndex: number, base64: string, name: string): Promise<boolean> {
  const ctx = pageContext(pageId);
  const shape = ctx?.shapes.find(item => item.index === panelIndex);
  if (!shape) {
    return false;
  }
  const uri = await saveImageData(base64, 'jpg');
  const { x, y, w, h } = shape.bbox;
  saveArt(shape.id, { layers: [{ ...newLayer(name), image: { uri, x, y, w, h } }] });
  return true;
}

/** Thumbnails and page views follow the page's art revision. */
export function bumpPage(pageId: ID): void {
  if (useStory.getState().pages[pageId]) {
    useStory.getState().bumpArt(pageId);
  }
}

/** The panel at this place in reading order. */
export function panelAt(pageId: ID, panelIndex: number): ID | null {
  return pageContext(pageId)?.shapes.find(item => item.index === panelIndex)?.id ?? null;
}
