/**
 * Choosing what goes in a story trailer: the best drawn panels, varied, and the best line for each.
 * trailer.ts turns the picks into timed shots.
 */
import { collectPanelIds, computePanels, isRtl, pageSize, polyArea, type Poly, type Rect } from '../layout/layout';
import { chapterIdsOf } from '../model/selectors';
import type { Block, ID, Page, Shot, StoryData } from '../model/types';
import { speakableText } from './tableRead';

export const TRAILER_MAX_PANELS = 6;
/** Captions longer than this would not be read in time. Japanese counts double: it packs more per letter. */
export const CAPTION_MAX = 90;

export type TrailerLine = { text: string; speaker: string | null; shout: boolean };

export type PanelPick = {
  pageId: ID;
  panelId: ID;
  chapterId: ID;
  shot?: Shot;
  strokes: number;
  poly: Poly;
  bbox: Rect;
  /** Position in the story, so the trailer keeps the story's order. */
  order: number;
  score: number;
};

/** Ink in a panel: strokes, with an imported image worth a good many of them. */
export type StrokeCounter = (panelId: ID) => number;

function storyPages(state: StoryData, projectId: ID): { page: Page; chapterId: ID }[] {
  const project = state.projects[projectId];
  return chapterIdsOf(project).flatMap(chapterId =>
    (state.chapters[chapterId]?.pageIds ?? [])
      .map(pageId => state.pages[pageId])
      .filter((page): page is Page => !!page)
      .map(page => ({ page, chapterId })),
  );
}

/** Every panel with art in it, in story order, scored by how much was drawn, page done and size. */
export function drawnPanels(state: StoryData, projectId: ID, strokesOf: StrokeCounter): PanelPick[] {
  const project = state.projects[projectId];
  if (!project) {
    return [];
  }
  const picks: PanelPick[] = [];
  for (const { page, chapterId } of storyPages(state, projectId)) {
    const size = pageSize(project, page);
    for (const shape of computePanels(page, size, { rtl: isRtl(project) })) {
      const strokes = strokesOf(shape.id);
      if (strokes <= 0) {
        continue;
      }
      const area = polyArea(shape.poly) / (size.w * size.h);
      const score = Math.log2(1 + strokes) * 2 + (page.done ? 3 : 0) + Math.min(1, area * 3) * 2;
      picks.push({
        pageId: page.id,
        panelId: shape.id,
        chapterId,
        shot: page.panels[shape.id]?.shot,
        strokes,
        poly: shape.poly,
        bbox: shape.bbox,
        order: picks.length,
        score,
      });
    }
  }
  return picks;
}

/**
 * The best panels, varied: each pick makes others of the same shot type, and from the same page, count
 * for less. Returned in story order.
 */
export function pickPanels(candidates: PanelPick[], max = TRAILER_MAX_PANELS): PanelPick[] {
  const chosen: PanelPick[] = [];
  const left = [...candidates];
  while (chosen.length < max && left.length > 0) {
    let best = 0;
    let bestValue = -Infinity;
    left.forEach((pick, index) => {
      const sameShot = pick.shot ? chosen.filter(other => other.shot === pick.shot).length : 0;
      const samePage = chosen.filter(other => other.pageId === pick.pageId).length;
      const value = pick.score - sameShot * 2.5 - samePage * 2;
      if (value > bestValue) {
        bestValue = value;
        best = index;
      }
    });
    chosen.push(left.splice(best, 1)[0]);
  }
  return chosen.sort((a, b) => a.order - b.order);
}

function captionLength(text: string): number {
  return [...text].reduce((sum, char) => sum + (/[぀-ヿ㐀-鿿]/.test(char) ? 2 : 1), 0);
}

/** How well a line works on screen: shouts and short punchy lines first. Null when it cannot be a caption. */
export function lineScore(block: Block): number | null {
  if (block.type !== 'dialogue' && block.type !== 'narration') {
    return null;
  }
  const text = speakableText(block.text);
  const length = captionLength(text);
  if (!text || length > CAPTION_MAX) {
    return null;
  }
  let score = 0;
  if (block.kind === 'shout') {
    score += 3;
  } else if (block.kind === 'whisper') {
    score += 1;
  } else if (block.kind === 'think') {
    score -= 0.5;
  }
  if (/[!！]/.test(text)) {
    score += 2;
  } else if (/[?？]/.test(text)) {
    score += 1;
  }
  score += length <= 40 ? 2 : length <= 70 ? 1 : 0;
  if (block.type === 'narration') {
    score += 0.5;
  }
  return score;
}

/** A chapter line that is not tied to a panel needs to be this good to be used. */
const LOOSE_LINE_MIN = 2.5;

/** One caption per picked panel: from the lines tied to that panel, or else a strong line of its chapter. */
export function pickLines(state: StoryData, picks: PanelPick[]): (TrailerLine | null)[] {
  const used = new Set<ID>();
  const blocksOf = (chapterId: ID) =>
    (state.chapters[chapterId]?.sceneIds ?? []).flatMap(sceneId => state.scenes[sceneId]?.blocks ?? []);
  const toLine = (block: Block): TrailerLine => ({
    text: speakableText(block.text),
    speaker: block.type === 'dialogue' && block.characterId ? state.characters[block.characterId]?.name.trim() || null : null,
    shout: block.kind === 'shout',
  });
  const best = (blocks: Block[], min: number): Block | null => {
    let found: Block | null = null;
    let top = -Infinity;
    for (const block of blocks) {
      const score = used.has(block.id) ? null : lineScore(block);
      if (score !== null && score >= min && score > top) {
        top = score;
        found = block;
      }
    }
    return found;
  };
  return picks.map(pick => {
    const blocks = blocksOf(pick.chapterId);
    const panel = state.pages[pick.pageId]?.panels[pick.panelId];
    const tied = blocks.filter(block => panel?.blockIds.includes(block.id));
    const block = best(tied, -Infinity) ?? best(blocks, LOOSE_LINE_MIN);
    if (!block) {
      return null;
    }
    used.add(block.id);
    return toLine(block);
  });
}

/** Ink in a panel's layers, for drawnPanels: strokes, plus 20 for an imported image. */
export function inkOf(art: { layers: { visible: boolean; strokes: unknown[]; image?: unknown }[] } | null): number {
  return art ? art.layers.reduce((sum, layer) => sum + (layer.visible ? layer.strokes.length + (layer.image ? 20 : 0) : 0), 0) : 0;
}

/** The newest page with a drawn panel, for the hero on Home. */
export function latestDrawnPage(state: StoryData, projectId: ID, hasArt: (panelId: ID) => boolean): ID | null {
  let latest: Page | null = null;
  for (const { page } of storyPages(state, projectId)) {
    if (collectPanelIds(page.layout).some(hasArt) && (!latest || page.updatedAt >= latest.updatedAt)) {
      latest = page;
    }
  }
  return latest?.id ?? null;
}
