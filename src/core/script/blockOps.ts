import { tn } from '../i18n';
import { panelOrder } from '../layout/layout';
import { DIALOGUE_KINDS } from '../model/constants';
import type { Block, BlockType, ID, Page, Scene } from '../model/types';
import type { BlockLocation } from './aiDrafts';
import type { SceneChange, ScriptMatch } from './scriptTools';

export type PanelRef = { label: string; pageId: ID };

export type FindContext = { before: string; match: string; after: string };

export type EnterResult =
  | { kind: 'reset'; blocks: Block[] }
  | { kind: 'remove' }
  | { kind: 'split'; blocks: Block[]; createdId: ID };

/** Setting is a one-liner, so the next block is Action. Everything else keeps its type. */
export function blockAfter(block: Block, id: ID, text: string): Block {
  const created: Block = { id, type: block.type === 'setting' ? 'action' : block.type, text };
  if (block.type === 'dialogue') {
    created.kind = block.kind ?? 'speak';
  }
  return created;
}

export function patchBlocks(scene: Scene, blockId: ID, patch: (block: Block) => Block): Block[] {
  return scene.blocks.map(block => (block.id === blockId ? patch(block) : block));
}

export function insertBlockAfter(
  location: BlockLocation,
  text: string,
  makeId: () => ID,
): { blocks: Block[]; createdId: ID } {
  const created = blockAfter(location.block, makeId(), text);
  const blocks = [...location.scene.blocks];
  blocks.splice(location.index + 1, 0, created);
  return { blocks, createdId: created.id };
}

/** Enter on an empty block steps out of it instead of adding another empty one. */
export function enterBlock(location: BlockLocation, before: string, after: string, makeId: () => ID): EnterResult {
  const { block, scene, index } = location;
  if (!before && !after) {
    if (block.type !== 'action') {
      return { kind: 'reset', blocks: patchBlocks(scene, block.id, () => ({ id: block.id, type: 'action', text: '' })) };
    }
    return { kind: 'remove' };
  }
  const created = blockAfter(block, makeId(), after);
  const blocks = patchBlocks(scene, block.id, current => ({ ...current, text: before }));
  blocks.splice(index + 1, 0, created);
  return { kind: 'split', blocks, createdId: created.id };
}

/** A scene always keeps one block. */
export function removeBlockAt(location: BlockLocation): { blocks: Block[]; neighborId: ID } | null {
  const { scene, index, block } = location;
  if (scene.blocks.length <= 1) {
    return null;
  }
  const neighbor = scene.blocks[index - 1] ?? scene.blocks[index + 1];
  return { blocks: scene.blocks.filter(item => item.id !== block.id), neighborId: neighbor.id };
}

export function withBlockType(block: Block, type: BlockType): Block {
  const next: Block = { id: block.id, type, text: block.text };
  if (type === 'dialogue') {
    next.kind = block.kind ?? 'speak';
    next.characterId = block.characterId;
  }
  return next;
}

export function nextDialogueKind(block: Block): Block {
  const at = DIALOGUE_KINDS.indexOf(block.kind ?? 'speak');
  return { ...block, kind: DIALOGUE_KINDS[(at + 1) % DIALOGUE_KINDS.length] };
}

export function moveInScene(location: BlockLocation, delta: -1 | 1): Block[] | null {
  const target = location.index + delta;
  if (target < 0 || target >= location.scene.blocks.length) {
    return null;
  }
  const blocks = [...location.scene.blocks];
  blocks.splice(location.index, 1);
  blocks.splice(target, 0, location.block);
  return blocks;
}

/** The source scene gets an empty Action block if the moved block was its last one. */
export function transferBlock(
  location: BlockLocation,
  target: Scene,
  atStart: boolean,
  makeId: () => ID,
): [SceneChange, SceneChange] | null {
  if (target.id === location.scene.id) {
    return null;
  }
  const rest = location.scene.blocks.filter(block => block.id !== location.block.id);
  return [
    { sceneId: location.scene.id, blocks: rest.length ? rest : [{ id: makeId(), type: 'action', text: '' }] },
    { sceneId: target.id, blocks: atStart ? [location.block, ...target.blocks] : [...target.blocks, location.block] },
  ];
}

export function blockEdges(sceneIds: ID[], location: BlockLocation | undefined): { first: boolean; last: boolean } {
  const at = location ? sceneIds.indexOf(location.scene.id) : -1;
  return {
    first: !location || (location.index === 0 && at <= 0),
    last: !location || (location.index === location.scene.blocks.length - 1 && at >= sceneIds.length - 1),
  };
}

export function panelRefs(pageIds: ID[], pages: Record<ID, Page | undefined>, rtl: boolean): Map<ID, PanelRef> {
  const map = new Map<ID, PanelRef>();
  pageIds.forEach((pageId, pageIndex) => {
    const page = pages[pageId];
    if (!page) {
      return;
    }
    panelOrder(page, rtl).forEach((panelId, panelIndex) => {
      for (const blockId of page.panels[panelId]?.blockIds ?? []) {
        map.set(blockId, { label: `P${pageIndex + 1}·${panelIndex + 1}`, pageId });
      }
    });
  });
  return map;
}

export function findContext(text: string | undefined, match: ScriptMatch | undefined): FindContext | undefined {
  if (text === undefined || !match) {
    return undefined;
  }
  const flat = (value: string) => value.replace(/\n/g, ' ');
  return {
    before: (match.start > 16 ? '…' : '') + flat(text.slice(Math.max(0, match.start - 16), match.start)),
    match: flat(text.slice(match.start, match.end)),
    after: flat(text.slice(match.end, match.end + 24)),
  };
}

export function hasScriptText(scenes: Scene[]): boolean {
  return scenes.some(scene => scene.blocks.some(block => block.text.trim()));
}

export function pagesText(value: number): string {
  return tn(value, '~{count} page', '~{count} pages', { count: Number.isInteger(value) ? value : value.toFixed(1) });
}
