import type { ComponentRef } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

import type { Block, ID, Scene } from '../../core/model/types';
import type { UndoScope } from '../../core/ports';
import { findBlock } from '../../core/script/aiDrafts';
import { enterBlock, nextDialogueKind, patchBlocks } from '../../core/script/blockOps';
import type { ActionMeta } from '../../core/story/scopes';
import { uid } from '../../core/util/id';
import { snapshotScript } from '../../state/scriptHistory';
import { undoable, useStory, useUndoState } from '../../state/useStory';
import { createScriptOps } from './scriptOps';

export type BlockApi = {
  text: (blockId: ID, text: string) => void;
  enter: (blockId: ID, before: string, after: string) => void;
  backspaceEmpty: (blockId: ID) => void;
  focus: (blockId: ID) => void;
  blur: (blockId: ID) => void;
  register: (blockId: ID, input: ComponentRef<typeof TextInput> | null) => void;
  layout: (blockId: ID, y: number) => void;
  pickCharacter: (blockId: ID) => void;
  cycleKind: (blockId: ID) => void;
  openPanel: (pageId: ID) => void;
  shorten: (blockId: ID) => void;
  flushRef: { current: (() => void) | null };
};

export type SceneApi = {
  toggle: (sceneId: ID) => void;
  menu: (sceneId: ID) => void;
  describe: (sceneId: ID, description: string) => void;
  append: (sceneId: ID) => void;
  layout: (sceneId: ID, y: number) => void;
};

export type ScriptHandlers = {
  pickCharacter: (blockId: ID) => void;
  shorten: (blockId: ID) => void;
  openSceneMenu: (sceneId: ID) => void;
  openPanel: (pageId: ID) => void;
};

const SAVED_AFTER_MS = 700;
const REVEAL_MARGIN = 40;

export function useScriptController(chapterId: ID, initialBlockId: ID | undefined, handlers: ScriptHandlers) {
  const scope: UndoScope = `script:${chapterId}`;
  const [focusedId, setFocusedId] = useState<ID | null>(null);
  const [saving, setSaving] = useState(false);
  const { canUndo, canRedo } = useUndoState(scope);
  const listRef = useRef<FlashListRef<Scene>>(null);
  const inputs = useRef(new Map<ID, ComponentRef<typeof TextInput>>());
  const pendingFocus = useRef<ID | null>(null);
  const pendingReveal = useRef<{ sceneId: ID; blockId: ID; animated: boolean } | null>(null);
  const initialBlock = useRef(initialBlockId);
  const bodyY = useRef(new Map<ID, number>());
  const blockY = useRef(new Map<ID, number>());
  const savingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<(() => void) | null>(null);
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const ops = useMemo(() => {
    const story = () => useStory.getState();
    const sceneIds = () => story().chapters[chapterId]?.sceneIds ?? [];
    const scenes = () =>
      sceneIds()
        .map(id => story().scenes[id])
        .filter(Boolean);
    const find = (blockId: ID | null | undefined) => findBlock(scenes(), blockId);
    const flush = () => flushRef.current?.();

    const edit = <R>(work: () => R, meta: Pick<ActionMeta, 'coalesceKey' | 'typing'> = {}): R => {
      if (savingTimer.current) {
        clearTimeout(savingTimer.current);
      }
      setSaving(true);
      savingTimer.current = setTimeout(() => setSaving(false), SAVED_AFTER_MS);
      return undoable({ undoScope: scope, ...meta }, work);
    };

    /** Collapsing is view state, so it stays out of undo. */
    const setCollapsed = (sceneId: ID, collapsed: boolean) =>
      undoable({}, () => story().updateScene(sceneId, { collapsed }));

    const focusBlock = (blockId: ID) => {
      pendingFocus.current = blockId;
      requestAnimationFrame(() => {
        const input = inputs.current.get(blockId);
        if (pendingFocus.current === blockId && input) {
          pendingFocus.current = null;
          input.focus();
        }
      });
    };

    const settleReveal = () => {
      const target = pendingReveal.current;
      const y = target ? blockY.current.get(target.blockId) : undefined;
      const layout = target ? listRef.current?.getLayout(sceneIds().indexOf(target.sceneId)) : undefined;
      if (!target || y === undefined || !layout) {
        return;
      }
      pendingReveal.current = null;
      const offset = layout.y + (bodyY.current.get(target.sceneId) ?? 0) + y - REVEAL_MARGIN;
      listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: target.animated });
    };

    /** A block in a scene the list has not mounted has no position yet, so go to the scene and finish on layout. */
    const reveal = (sceneId: ID, blockId: ID, animated = true) => {
      const scene = story().scenes[sceneId];
      if (!scene) {
        return;
      }
      if (scene.collapsed) {
        setCollapsed(sceneId, false);
      }
      pendingReveal.current = { sceneId, blockId, animated };
      requestAnimationFrame(() => {
        if (pendingReveal.current?.blockId !== blockId) {
          return;
        }
        if (blockY.current.has(blockId)) {
          settleReveal();
        } else {
          listRef.current?.scrollToIndex({ index: sceneIds().indexOf(sceneId), animated: false })?.then(settleReveal);
        }
      });
    };

    const edits = createScriptOps({
      chapterId,
      scope,
      sceneIds,
      scenes,
      find,
      flush,
      edit,
      focusBlock,
      reveal,
      clearFocus: () => setFocusedId(null),
    });
    const { patchBlock, removeBlock, setBlocks } = edits;

    const onListLoad = () => {
      const found = find(initialBlock.current);
      if (found) {
        initialBlock.current = undefined;
        reveal(found.scene.id, found.block.id, false);
        focusBlock(found.block.id);
      }
    };

    const api: BlockApi = {
      flushRef,
      text: (blockId, text) => {
        const found = find(blockId);
        if (found && found.block.text !== text) {
          edit(
            () => story().updateScene(found.scene.id, { blocks: patchBlocks(found.scene, blockId, block => ({ ...block, text })) }),
            { coalesceKey: `block:${blockId}`, typing: true },
          );
        }
      },
      enter: (blockId, before, after) => {
        const found = find(blockId);
        if (!found) {
          return;
        }
        const result = enterBlock(found, before, after, uid);
        if (result.kind === 'remove') {
          removeBlock(blockId);
          return;
        }
        setBlocks(found.scene.id, result.blocks);
        if (result.kind === 'split') {
          focusBlock(result.createdId);
        }
      },
      backspaceEmpty: removeBlock,
      focus: blockId => setFocusedId(blockId),
      blur: blockId => setFocusedId(current => (current === blockId ? null : current)),
      register: (blockId, input) => {
        if (!input) {
          inputs.current.delete(blockId);
          blockY.current.delete(blockId);
          return;
        }
        inputs.current.set(blockId, input);
        if (pendingFocus.current === blockId) {
          focusBlock(blockId);
        }
      },
      layout: (blockId, y) => {
        blockY.current.set(blockId, y);
        if (pendingReveal.current?.blockId === blockId) {
          settleReveal();
        }
      },
      pickCharacter: blockId => {
        flush();
        latest.current.pickCharacter(blockId);
      },
      cycleKind: blockId => patchBlock(blockId, nextDialogueKind),
      openPanel: pageId => latest.current.openPanel(pageId),
      shorten: blockId => {
        flush();
        latest.current.shorten(blockId);
      },
    };

    const sceneApi: SceneApi = {
      toggle: sceneId => {
        flush();
        setFocusedId(null);
        setCollapsed(sceneId, !story().scenes[sceneId]?.collapsed);
      },
      menu: sceneId => latest.current.openSceneMenu(sceneId),
      describe: (sceneId, description) =>
        edit(() => story().updateScene(sceneId, { description }), { coalesceKey: `description:${sceneId}`, typing: true }),
      append: sceneId => {
        const scene = story().scenes[sceneId];
        if (scene) {
          flush();
          const created: Block = { id: uid(), type: 'action', text: '' };
          setBlocks(sceneId, [...scene.blocks, created]);
          focusBlock(created.id);
        }
      },
      layout: (sceneId, y) => {
        bodyY.current.set(sceneId, y);
      },
    };

    return { ...edits, api, sceneApi, scenes, find, flush, reveal, focusBlock, onListLoad };
  }, [chapterId, scope]);

  useEffect(() => {
    const flush = flushRef;
    snapshotScript(chapterId);
    return () => {
      flush.current?.();
      snapshotScript(chapterId);
    };
  }, [chapterId]);

  useEffect(
    () => () => {
      if (savingTimer.current) {
        clearTimeout(savingTimer.current);
      }
    },
    [],
  );

  return { ...ops, listRef, focusedId, saving, canUndo, canRedo };
}
