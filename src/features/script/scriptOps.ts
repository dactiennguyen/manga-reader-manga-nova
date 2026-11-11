import type { BlockDraft } from '../../core/ai/writing';
import { t, tn } from '../../core/i18n';
import type { Block, BlockType, ID, Scene } from '../../core/model/types';
import type { UndoScope } from '../../core/ports';
import { applyTexts, insertDrafts, type BlockLocation, type TextChange } from '../../core/script/aiDrafts';
import { insertBlockAfter, moveInScene, patchBlocks, removeBlockAt, transferBlock, withBlockType } from '../../core/script/blockOps';
import type { SceneChange } from '../../core/script/scriptTools';
import type { ActionMeta } from '../../core/story/scopes';
import { uid } from '../../core/util/id';
import { restoreScriptVersion, snapshotScript, type ScriptVersion } from '../../state/scriptHistory';
import { redoStory, undoStory, useStory } from '../../state/useStory';
import { confirm, snackbar, toast } from '../../ui';

export type ScriptContext = {
  chapterId: ID;
  scope: UndoScope;
  sceneIds: () => ID[];
  scenes: () => Scene[];
  find: (blockId: ID | null | undefined) => BlockLocation | undefined;
  flush: () => void;
  edit: <R>(work: () => R, meta?: Pick<ActionMeta, 'coalesceKey' | 'typing'>) => R;
  focusBlock: (blockId: ID) => void;
  reveal: (sceneId: ID, blockId: ID, animated?: boolean) => void;
  clearFocus: () => void;
};

/** Every script edit goes through ctx.edit, so one user action is one undo step. */
export function createScriptOps({ chapterId, scope, sceneIds, scenes, find, flush, edit, focusBlock, reveal, clearFocus }: ScriptContext) {
  const story = () => useStory.getState();

  const setBlocks = (sceneId: ID, blocks: Block[]) => edit(() => story().updateScene(sceneId, { blocks }));

  const applyChanges = (changes: SceneChange[], patch: { collapsed?: boolean } = {}) =>
    edit(() => changes.forEach(change => story().updateScene(change.sceneId, { blocks: change.blocks, ...patch })));

  const patchBlock = (blockId: ID | null, patch: (block: Block) => Block) => {
    const found = find(blockId);
    if (found && blockId) {
      setBlocks(found.scene.id, patchBlocks(found.scene, blockId, patch));
    }
  };

  const removeBlock = (blockId: ID | null) => {
    const found = find(blockId);
    const result = found ? removeBlockAt(found) : null;
    if (found && result) {
      setBlocks(found.scene.id, result.blocks);
      focusBlock(result.neighborId);
    }
  };

  const insertAfter = (blockId: ID | null) => {
    flush();
    const found = find(blockId);
    if (found) {
      const { blocks, createdId } = insertBlockAfter(found, '', uid);
      setBlocks(found.scene.id, blocks);
      focusBlock(createdId);
    }
  };

  const changeType = (blockId: ID | null, type: BlockType) => {
    flush();
    patchBlock(blockId, block => withBlockType(block, type));
  };

  const transfer = (blockId: ID, targetSceneId: ID, atStart: boolean) => {
    const found = find(blockId);
    const target = story().scenes[targetSceneId];
    const changes = found && target ? transferBlock(found, target, atStart, uid) : null;
    if (!changes) {
      return false;
    }
    edit(() => {
      story().updateScene(changes[0].sceneId, { blocks: changes[0].blocks });
      story().updateScene(changes[1].sceneId, { blocks: changes[1].blocks, collapsed: false });
    });
    return true;
  };

  const moveBlock = (blockId: ID | null, delta: -1 | 1, refocus: boolean) => {
    flush();
    const found = find(blockId);
    if (!found || !blockId) {
      return;
    }
    const blocks = moveInScene(found, delta);
    if (blocks) {
      setBlocks(found.scene.id, blocks);
      if (refocus) {
        focusBlock(blockId);
      }
      return;
    }
    const ids = sceneIds();
    const neighbor = ids[ids.indexOf(found.scene.id) + delta];
    if (neighbor && transfer(blockId, neighbor, delta === 1)) {
      if (refocus) {
        focusBlock(blockId);
      } else {
        reveal(neighbor, blockId);
      }
    }
  };

  const moveToScene = (blockId: ID, targetSceneId: ID) => {
    flush();
    if (transfer(blockId, targetSceneId, false)) {
      reveal(targetSceneId, blockId);
      toast(t('Moved to scene {n}', { n: sceneIds().indexOf(targetSceneId) + 1 }));
    }
  };

  const addScene = () => {
    flush();
    const first: Block = { id: uid(), type: 'setting', text: '' };
    const sceneId = edit(() => story().addScene(chapterId, { blocks: [first] }));
    reveal(sceneId, first.id);
    focusBlock(first.id);
  };

  const moveScene = (index: number, delta: -1 | 1) => {
    flush();
    edit(() => story().moveScene(chapterId, index, index + delta));
  };

  const removeScene = async (sceneId: ID, number: number) => {
    const count = story().scenes[sceneId]?.blocks.length ?? 0;
    const ok = await confirm(
      t('Delete scene {n}?', { n: number }),
      tn(count, 'Its {count} block will be deleted.', 'Its {count} blocks will be deleted.'),
      {
        confirmText: t('Delete scene'),
        destructive: true,
      },
    );
    if (ok) {
      flush();
      edit(() => story().removeScene(sceneId));
    }
  };

  const undo = () => {
    flush();
    undoStory(scope);
  };

  const redo = () => {
    flush();
    redoStory(scope);
  };

  const insertAiDrafts = (afterBlockId: ID | null, drafts: BlockDraft[]) => {
    flush();
    const result = insertDrafts(scenes(), drafts, afterBlockId, uid);
    if (!result.changes.length) {
      return;
    }
    snapshotScript(chapterId);
    applyChanges(result.changes, { collapsed: false });
    reveal(result.changes[0].sceneId, result.blockIds[0]);
    snackbar({
      message: tn(result.blockIds.length, 'Inserted {count} block', 'Inserted {count} blocks'),
      actionLabel: t('Undo'),
      onAction: undo,
    });
  };

  const replaceAiTexts = (changes: TextChange[]) => {
    flush();
    const sceneChanges = applyTexts(scenes(), changes);
    if (!sceneChanges.length) {
      toast(t('Nothing changed'));
      return;
    }
    snapshotScript(chapterId);
    applyChanges(sceneChanges);
    snackbar({
      message: changes.length === 1 ? t('Line replaced') : t('Replaced {count} blocks', { count: changes.length }),
      actionLabel: t('Undo'),
      onAction: undo,
    });
  };

  const restoreVersion = async (version: ScriptVersion) => {
    const ok = await confirm(t('Restore this version?'), t('Your current script is saved as a version first.'), {
      confirmText: t('Restore'),
    });
    if (ok) {
      flush();
      restoreScriptVersion(chapterId, version);
      clearFocus();
      toast(t('Version restored'));
    }
    return ok;
  };

  return {
    setBlocks,
    applyChanges,
    patchBlock,
    removeBlock,
    insertAfter,
    changeType,
    moveBlock,
    moveToScene,
    addScene,
    moveScene,
    removeScene,
    undo,
    redo,
    insertAiDrafts,
    replaceAiTexts,
    restoreVersion,
  };
}
