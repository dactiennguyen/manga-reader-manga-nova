/**
 * Keeping a version of Fill the bubbles: the panel and its lines become a new page in the "Fill the
 * bubbles" story. The strokes become pencil strokes and the bubbles real bubbles, so the page can be
 * drawn on and lettered further like any other.
 */
import { asPageBubble, inkToStrokes, type FillBubble } from '../../../core/nearby/fill';
import type { InkStroke } from '../../../core/nearby/guess';
import { uid } from '../../../core/util/id';
import { pageContext } from '../../../render/drawPage';
import { newLayer, saveArt } from '../../../state/artStore';
import { useStory } from '../../../state/useStory';
import { FILL_BUBBLES, addStoryPage, ensureStory } from '../draw/drawStories';
import { bumpPage } from '../draw/panelImage';

/** The page's id, or null when it could not be made. `credit` names the layer: who drew it. */
export function saveFilledPanel(strokes: readonly InkStroke[], bubbles: readonly FillBubble[], lines: readonly string[], credit: string): string | null {
  const pageId = addStoryPage(ensureStory(FILL_BUBBLES), 'g1');
  const shape = pageId ? pageContext(pageId)?.shapes.find(item => item.index === 0) : undefined;
  if (!pageId || !shape) {
    return null;
  }
  // The square board, as large as the panel allows and centred in it.
  const { x, y, w, h } = shape.bbox;
  const size = Math.min(w, h);
  const box = { x: x + (w - size) / 2, y: y + (h - size) / 2, size };
  saveArt(shape.id, { layers: [{ ...newLayer(credit), strokes: inkToStrokes(strokes, box) }] });
  useStory.getState().updatePage(pageId, { bubbles: bubbles.map((bubble, index) => asPageBubble(bubble, lines[index] ?? '', uid(), box)) });
  bumpPage(pageId);
  return pageId;
}
