import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';

import type { Block, ID, Scene } from '../../core/model/types';
import { findContext } from '../../core/script/blockOps';
import { findInText, findMatches, replaceAllInScenes, replaceRange, type SceneChange } from '../../core/script/scriptTools';
import { snapshotScript } from '../../state/scriptHistory';
import { snackbar } from '../../ui';

type FindOps = {
  scenes: () => Scene[];
  find: (blockId: ID | null | undefined) => { block: Block } | undefined;
  flush: () => void;
  reveal: (sceneId: ID, blockId: ID) => void;
  patchBlock: (blockId: ID | null, patch: (block: Block) => Block) => void;
  applyChanges: (changes: SceneChange[]) => void;
  undo: () => void;
};

export function useScriptFind(chapterId: ID, scenes: Scene[], ops: FindOps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [findIndex, setFindIndex] = useState(0);

  const matches = useMemo(() => (open ? findMatches(scenes, query, matchCase) : []), [open, scenes, query, matchCase]);
  const matchIds = useMemo(() => (matches.length ? new Set(matches.map(match => match.blockId)) : undefined), [matches]);
  const currentIndex = matches.length ? Math.min(findIndex, matches.length - 1) : -1;
  const current = currentIndex >= 0 ? matches[currentIndex] : undefined;
  const currentSceneId = current?.sceneId;
  const currentBlockId = current?.blockId;

  const { reveal } = ops;
  useEffect(() => {
    if (currentSceneId && currentBlockId) {
      reveal(currentSceneId, currentBlockId);
    }
  }, [currentSceneId, currentBlockId, currentIndex, reveal]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [open]);

  const start = () => {
    ops.flush();
    setFindIndex(0);
    setOpen(true);
  };

  const step = (delta: -1 | 1) => {
    if (matches.length) {
      setFindIndex((currentIndex + delta + matches.length) % matches.length);
    }
  };

  const replaceCurrent = () => {
    ops.flush();
    const fresh = findMatches(ops.scenes(), query, matchCase);
    const at = Math.min(Math.max(currentIndex, 0), fresh.length - 1);
    const target = fresh[at];
    if (!target) {
      return;
    }
    ops.patchBlock(target.blockId, block => ({
      ...block,
      text: replaceRange(block.text, target.start, target.end, replacement),
    }));
    const added = findInText(replacement, query, matchCase).length;
    const remaining = fresh.length - 1 + added;
    setFindIndex(remaining > 0 ? (at + added) % remaining : 0);
  };

  const replaceEverything = () => {
    ops.flush();
    const { changes, count } = replaceAllInScenes(ops.scenes(), query, replacement, matchCase);
    if (!count) {
      return;
    }
    snapshotScript(chapterId);
    ops.applyChanges(changes);
    setFindIndex(0);
    Keyboard.dismiss();
    snackbar({
      message: `Replaced ${count} ${count === 1 ? 'occurrence' : 'occurrences'}`,
      actionLabel: 'Undo',
      onAction: ops.undo,
    });
  };

  return {
    open,
    start,
    matchIds,
    currentSceneId,
    currentBlockId,
    bar: {
      query,
      replacement,
      matchCase,
      count: matches.length,
      current: currentIndex,
      context: findContext(current ? ops.find(current.blockId)?.block.text : undefined, current),
      onQuery: (value: string) => {
        setQuery(value);
        setFindIndex(0);
      },
      onReplacement: setReplacement,
      onMatchCase: (value: boolean) => {
        setMatchCase(value);
        setFindIndex(0);
      },
      onNext: () => step(1),
      onPrevious: () => step(-1),
      onReplace: replaceCurrent,
      onReplaceAll: replaceEverything,
      onClose: () => setOpen(false),
    },
  };
}
