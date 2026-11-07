import { hitTestPanel, type PanelShape } from '../layout/layout';
import type { Block, Bubble, ID, Scene } from '../model/types';
import { uid } from '../util/id';
import { bubbleCenter } from './bubbles';

const DUPLICATE_OFFSET = 30;

function changes<T extends object>(row: T, patch: Partial<T>): boolean {
  return (Object.keys(patch) as (keyof T)[]).some(key => row[key] !== patch[key]);
}

/** Returns the same array when nothing changes, so an empty edit never becomes an undo step. */
export function patchItem<T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>): T[] {
  const row = list.find(item => item.id === id);
  if (!row || !changes(row, patch)) {
    return list;
  }
  return list.map(item => (item.id === id ? { ...item, ...patch } : item));
}

/**
 * One undo step per run of edits to one property. The epoch moves after every undo and redo, so the
 * next edit starts a step of its own instead of merging into an older one.
 */
export function coalesceTag(epoch: number, id: ID, property: string): string {
  return `${epoch}:${id}:${property}`;
}

export function duplicateBubble(source: Bubble): Bubble {
  return {
    ...source,
    id: uid(),
    blockId: undefined,
    x: source.x + DUPLICATE_OFFSET,
    y: source.y + DUPLICATE_OFFSET,
    tail: source.tail ? { x: source.tail.x + DUPLICATE_OFFSET, y: source.tail.y + DUPLICATE_OFFSET } : null,
  };
}

export function moveInStack(bubbles: Bubble[], id: ID, step: number): Bubble[] {
  const index = bubbles.findIndex(bubble => bubble.id === id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= bubbles.length) {
    return bubbles;
  }
  const next = [...bubbles];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function defaultTail(bubble: Pick<Bubble, 'x' | 'y' | 'w' | 'h'>): NonNullable<Bubble['tail']> {
  return { x: bubble.x + bubble.w * 0.35, y: bubble.y + bubble.h + 50 };
}

export function clampFontSize(type: Bubble['type'], value: number): number {
  const sfx = type === 'sfx';
  return Math.max(sfx ? 24 : 14, Math.min(sfx ? 220 : 72, value));
}

export function bubblesInOrder(bubbles: Bubble[], shapes: PanelShape[], rtl: boolean): Bubble[] {
  const rank = (bubble: Bubble) => {
    const id = hitTestPanel(shapes, bubbleCenter(bubble));
    const index = shapes.findIndex(shape => shape.id === id);
    return index < 0 ? shapes.length : index;
  };
  return [...bubbles].sort((a, b) => rank(a) - rank(b) || a.y - b.y || (rtl ? b.x - a.x : a.x - b.x));
}

export function bubblesInPanel(bubbles: Bubble[], shapes: PanelShape[], panelId: ID): Bubble[] {
  return bubbles.filter(bubble => hitTestPanel(shapes, bubbleCenter(bubble)) === panelId);
}

/** The scene edit that carries a bubble's text back to the script, or null when they already agree. */
export function scriptSync(
  bubble: Pick<Bubble, 'text' | 'blockId'> | null | undefined,
  scenes: (Scene | undefined)[],
): { sceneId: ID; blocks: Block[] } | null {
  const text = bubble?.text.trim() ?? '';
  if (!bubble?.blockId || !text) {
    return null;
  }
  const scene = scenes.find(item => item?.blocks.some(block => block.id === bubble.blockId));
  const source = scene?.blocks.find(block => block.id === bubble.blockId);
  if (!scene || !source || source.text.trim() === text) {
    return null;
  }
  return {
    sceneId: scene.id,
    blocks: scene.blocks.map(block => (block.id === source.id ? { ...block, text } : block)),
  };
}
