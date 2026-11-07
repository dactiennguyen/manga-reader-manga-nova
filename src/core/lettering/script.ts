import { panelOrder, type PanelShape, type Pt, type Rect } from '../layout/layout';
import type { Block, Bubble, BubbleType, ID, Page, Scene } from '../model/types';
import { createBubble } from './bubbles';
import { fitBubbleText, type TextMeasure } from './fit';

export type PageBlock = { block: Block; panelId: ID; panelIndex: number; placed: boolean };

const LETTERED: Block['type'][] = ['dialogue', 'narration', 'sfx'];

export function blockMapOf(scenes: (Scene | undefined)[]): Record<ID, Block> {
  const map: Record<ID, Block> = {};
  scenes.forEach(scene => scene?.blocks.forEach(block => (map[block.id] = block)));
  return map;
}

export function pageBlocksOf(page: Page, blocks: Record<ID, Block>, rtl: boolean): PageBlock[] {
  const placed = new Set(page.bubbles.map(bubble => bubble.blockId).filter(Boolean));
  const seen = new Set<ID>();
  const list: PageBlock[] = [];
  panelOrder(page, rtl).forEach((panelId, panelIndex) => {
    (page.panels[panelId]?.blockIds ?? []).forEach(blockId => {
      const block = blocks[blockId];
      if (block && LETTERED.includes(block.type) && !seen.has(blockId)) {
        seen.add(blockId);
        list.push({ block, panelId, panelIndex, placed: placed.has(blockId) });
      }
    });
  });
  return list;
}

export function bubbleTypeOf(block: Block): BubbleType {
  if (block.type === 'narration') {
    return 'narration';
  }
  if (block.type === 'sfx') {
    return 'sfx';
  }
  return block.kind ?? 'speak';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.max(min, max), value));
}

function sized(bubble: Bubble, maxH: number, measure: TextMeasure | null): Bubble {
  let next = bubble;
  if (!measure || bubble.type === 'sfx') {
    return next;
  }
  for (let i = 0; i < 8; i++) {
    const fit = fitBubbleText(next, measure);
    if (!fit.overflow && fit.fontSize >= next.fontSize) {
      break;
    }
    if (next.h >= maxH) {
      break;
    }
    next = { ...next, h: Math.min(maxH, next.h * 1.18) };
  }
  return next;
}

export function placeBlock(
  item: PageBlock,
  bb: Rect,
  slot: number,
  cursor: { y: number },
  rtl: boolean,
  measure: TextMeasure | null,
): Bubble {
  const { block } = item;
  const type = bubbleTypeOf(block);
  const pad = Math.min(24, bb.w * 0.05);
  const length = Math.max(1, block.text.trim().length);
  const base = { text: block.text.trim(), blockId: block.id, characterId: block.characterId };
  const startSide = rtl ? 1 : -1;
  const place = (w: number, h: number, side: number, y: number): Pt => ({
    x: side > 0 ? bb.x + bb.w - pad - w / 2 : bb.x + pad + w / 2,
    y: clamp(y, bb.y + pad, bb.y + bb.h - pad - h) + h / 2,
  });

  if (type === 'narration') {
    const w = clamp(120 + length * 5, 160, Math.min(bb.w - pad * 2, 380));
    const lines = Math.ceil((length * 14) / Math.max(60, w - 32));
    const h = clamp(30 + lines * 32, 60, bb.h * 0.4);
    const bubble = sized(createBubble(type, place(w, h, startSide, cursor.y), { ...base, w, h }), bb.h * 0.5, measure);
    cursor.y = bubble.y + bubble.h + 10;
    return bubble;
  }

  if (type === 'sfx') {
    const w = clamp(bb.w * 0.5, 120, Math.min(bb.w - pad * 2, 340));
    const fontSize = clamp((w / Math.max(2, length)) * 1.5, 36, 96);
    const h = clamp(fontSize * 1.4, 50, bb.h * 0.4);
    const side = slot % 2 === 0 ? -startSide : startSide;
    const center = place(w, h, side, Math.max(cursor.y, bb.y + bb.h * 0.45));
    return createBubble(type, center, { ...base, w, h, fontSize });
  }

  const maxW = Math.min(bb.w - pad * 2, Math.max(120, Math.min(bb.w * 0.62, 380)));
  const w = clamp(150 + length * 3.4, Math.min(170, maxW), maxW);
  const lines = Math.ceil((length * 15) / (w * 0.7));
  const maxH = Math.max(80, bb.h * 0.55);
  const h = clamp(70 + lines * 36, 100, maxH);
  const side = slot % 2 === 0 ? startSide : -startSide;
  const draft = createBubble(type, place(w, h, side, cursor.y), { ...base, w, h });
  const fitted = sized(draft, maxH, measure);
  const top = clamp(fitted.y, bb.y + pad, bb.y + bb.h - pad - fitted.h);
  const tipY = Math.min(top + fitted.h + 46, bb.y + bb.h - 8);
  const tipX = clamp(fitted.x + fitted.w / 2 - side * fitted.w * 0.18, bb.x + 8, bb.x + bb.w - 8);
  const bubble = { ...fitted, y: top, tail: tipY > top + fitted.h + 10 ? { x: tipX, y: tipY } : null };
  cursor.y = top + fitted.h * 0.72;
  return bubble;
}

export function autoPlace(
  items: PageBlock[],
  shapes: PanelShape[],
  rtl: boolean,
  measure: TextMeasure | null,
): Bubble[] {
  const result: Bubble[] = [];
  shapes.forEach(shape => {
    const cursor = { y: shape.bbox.y + Math.min(24, shape.bbox.w * 0.05) };
    let slot = 0;
    items
      .filter(item => item.panelId === shape.id)
      .forEach(item => {
        if (!item.placed) {
          result.push(placeBlock(item, shape.bbox, slot, cursor, rtl, measure));
        }
        slot++;
      });
  });
  return result;
}
