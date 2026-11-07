import type { BlockDraft } from '../ai/writing';
import type { Block, ID, Scene } from '../model/types';
import type { SceneChange } from './scriptTools';

export type AiAction = 'continue' | 'rewrite' | 'voice' | 'shorten' | 'sfx';

export type RewriteScope = 'block' | 'scene';

export type TextChange = { id: ID; text: string };

export type BlockLocation = { scene: Scene; index: number; block: Block };

export type InsertResult = { changes: SceneChange[]; blockIds: ID[] };

export const MAX_SCENE_REWRITE = 12;

export function findBlock(scenes: Scene[], blockId: ID | null | undefined): BlockLocation | undefined {
  if (!blockId) {
    return undefined;
  }
  for (const scene of scenes) {
    const index = scene.blocks.findIndex(block => block.id === blockId);
    if (index >= 0) {
      return { scene, index, block: scene.blocks[index] };
    }
  }
  return undefined;
}

export function nextBlockId(scenes: Scene[], blockId: ID): ID | undefined {
  let passed = false;
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      if (passed) {
        return block.id;
      }
      if (block.id === blockId) {
        passed = true;
      }
    }
  }
  return undefined;
}

export function draftToBlock(draft: BlockDraft, id: ID): Block {
  const block: Block = { id, type: draft.type, text: draft.text };
  if (draft.type === 'dialogue') {
    block.kind = draft.kind ?? 'speak';
    if (draft.characterId) {
      block.characterId = draft.characterId;
    }
  }
  return block;
}

export function insertDrafts(
  scenes: Scene[],
  drafts: BlockDraft[],
  afterBlockId: ID | null,
  makeId: () => ID,
): InsertResult {
  if (!drafts.length || !scenes.length) {
    return { changes: [], blockIds: [] };
  }
  const created = drafts.map(draft => draftToBlock(draft, makeId()));
  const found = findBlock(scenes, afterBlockId);
  const scene = found?.scene ?? scenes[scenes.length - 1];
  const index = found ? found.index : scene.blocks.length - 1;
  const anchor = scene.blocks[index];
  const blocks = [...scene.blocks];
  if (anchor && !anchor.text.trim()) {
    blocks.splice(index, 1, ...created);
  } else {
    blocks.splice(index + 1, 0, ...created);
  }
  return { changes: [{ sceneId: scene.id, blocks }], blockIds: created.map(block => block.id) };
}

export function rewriteTargets(location: BlockLocation, scope: RewriteScope): Block[] {
  if (scope === 'scene' && location.scene.blocks.length <= MAX_SCENE_REWRITE) {
    return location.scene.blocks.filter(block => block.text.trim());
  }
  return [location.block];
}

export function pairRewrite(targets: Block[], drafts: BlockDraft[]): TextChange[] {
  const count = Math.min(targets.length, drafts.length);
  const changes: TextChange[] = [];
  for (let index = 0; index < count; index += 1) {
    const text = drafts[index].text.trim();
    if (text) {
      changes.push({ id: targets[index].id, text });
    }
  }
  return changes;
}

export function applyTexts(scenes: Scene[], changes: TextChange[]): SceneChange[] {
  const byId = new Map(changes.map(change => [change.id, change.text]));
  const result: SceneChange[] = [];
  for (const scene of scenes) {
    let touched = false;
    const blocks = scene.blocks.map(block => {
      const text = byId.get(block.id);
      if (text === undefined || text === block.text) {
        return block;
      }
      touched = true;
      return { ...block, text };
    });
    if (touched) {
      result.push({ sceneId: scene.id, blocks });
    }
  }
  return result;
}

export function actionAvailability(
  location: BlockLocation | undefined,
  hasSpeaker: boolean,
): Record<AiAction, boolean> {
  const text = location?.block.text.trim() ?? '';
  const sceneHasText = location?.scene.blocks.some(block => block.text.trim()) ?? false;
  const dialogue = !!location && location.block.type === 'dialogue' && text !== '';
  return {
    continue: true,
    rewrite: !!location && (text !== '' || sceneHasText),
    voice: dialogue && hasSpeaker,
    shorten: dialogue,
    sfx: !!location && location.block.type === 'action' && text !== '',
  };
}
