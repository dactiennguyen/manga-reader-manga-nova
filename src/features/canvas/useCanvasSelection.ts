import { useCallback, useMemo, useRef, useState } from 'react';

import { IDENTITY_AFFINE, isIdentityAffine, type Affine } from '../../core/art/affine';
import { pickStrokes, removeSelected, selectionBounds, transformSelected } from '../../core/art/selection';
import { activeLayerOf } from '../../core/art/tools';
import { t, tn } from '../../core/i18n';
import type { ArtLayer, ID, Stroke } from '../../core/model/types';
import { buildSelectionScene, type SelectionScene } from '../../render/selectionScene';
import { artRev, loadArt } from '../../state/artStore';
import { toast } from '../../ui';

export type CanvasSelection = {
  /** How many strokes are selected. 0 when nothing is. */
  count: number;
  /** Picks the strokes of the active layer that the lasso encloses. */
  lasso: (points: number[]) => void;
  all: () => void;
  /** The transform as the gesture left it. Nothing is stored until `end`. */
  setMatrix: (m: Affine) => void;
  /** Closes the selection. With `apply` the pending transform is written as one undo step. */
  end: (apply: boolean) => void;
  /** Deletes the selected strokes as one undo step. */
  remove: () => void;
  /** The art changed from outside, so the picked indices mean nothing now. Null when a selection was open. */
  drop: () => null | undefined;
};

type Picked = { layerId: ID; indices: number[]; rev: number };

/** How the selection reaches the screen and the store. Both belong to the canvas document. */
export type SelectionTarget = {
  show: (scene: SelectionScene | null) => void;
  rewrite: (layerId: ID, strokes: Stroke[]) => void;
};

export function useCanvasSelection(panelId: ID, target: SelectionTarget): CanvasSelection {
  const picked = useRef<Picked | null>(null);
  const matrix = useRef<Affine>(IDENTITY_AFFINE);
  const [count, setCount] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  /** Forgets the selection and returns it with its layer, if the layer is still as it was picked. */
  const take = useCallback((): { sel: Picked; layer: ArtLayer | undefined; m: Affine } | null => {
    const sel = picked.current;
    if (!sel) {
      return null;
    }
    const m = matrix.current;
    picked.current = null;
    matrix.current = IDENTITY_AFFINE;
    setCount(0);
    const layer =
      sel.rev === artRev(panelId) ? loadArt(panelId)?.layers.find(item => item.id === sel.layerId) : undefined;
    return { sel, layer, m };
  }, [panelId]);

  const end = useCallback(
    (apply: boolean) => {
      const taken = take();
      if (!taken) {
        return;
      }
      if (apply && taken.layer && !isIdentityAffine(taken.m)) {
        targetRef.current.rewrite(taken.layer.id, transformSelected(taken.layer.strokes, taken.sel.indices, taken.m));
      } else {
        targetRef.current.show(null);
      }
    },
    [take],
  );

  const remove = useCallback(() => {
    const taken = take();
    if (!taken) {
      return;
    }
    if (taken.layer) {
      targetRef.current.rewrite(taken.layer.id, removeSelected(taken.layer.strokes, taken.sel.indices));
    } else {
      targetRef.current.show(null);
    }
  }, [take]);

  /** The active layer when it can be changed. Says why when it cannot. */
  const editable = useCallback((): ArtLayer | null => {
    const art = loadArt(panelId);
    const layer = art ? activeLayerOf(art) : undefined;
    if (!layer || !layer.visible) {
      toast(t('Layer is hidden'));
      return null;
    }
    if (layer.locked) {
      toast(t('Layer is locked'));
      return null;
    }
    if (!layer.strokes.length) {
      toast(t('Layer is empty'));
      return null;
    }
    return layer;
  }, [panelId]);

  const open = useCallback(
    (layer: ArtLayer, indices: number[]) => {
      const box = selectionBounds(layer.strokes, indices);
      if (!box) {
        toast(t('No strokes inside the selection'));
        return;
      }
      picked.current = { layerId: layer.id, indices, rev: artRev(panelId) };
      matrix.current = IDENTITY_AFFINE;
      setCount(indices.length);
      targetRef.current.show(buildSelectionScene(layer, indices, box));
      toast(tn(indices.length, '{count} stroke selected', '{count} strokes selected'));
    },
    [panelId],
  );

  const lasso = useCallback(
    (points: number[]) => {
      // A new lasso keeps what the last selection did, then reads the layer again.
      end(true);
      const layer = editable();
      if (layer) {
        open(layer, pickStrokes(layer.strokes, points));
      }
    },
    [editable, end, open],
  );

  const all = useCallback(() => {
    end(true);
    const layer = editable();
    if (layer) {
      open(
        layer,
        layer.strokes.map((_, index) => index),
      );
    }
  }, [editable, end, open]);

  const setMatrix = useCallback((m: Affine) => {
    if (picked.current) {
      matrix.current = m;
    }
  }, []);

  const drop = useCallback((): null | undefined => {
    if (!picked.current) {
      return undefined;
    }
    picked.current = null;
    matrix.current = IDENTITY_AFFINE;
    setCount(0);
    return null;
  }, []);

  return useMemo(
    () => ({ count, lasso, all, setMatrix, end, remove, drop }),
    [all, count, drop, end, lasso, remove, setMatrix],
  );
}
