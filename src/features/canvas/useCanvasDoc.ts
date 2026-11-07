import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { transformLayer, type LayerTransform } from '../../core/art/artMath';
import { activeLayerOf } from '../../core/art/tools';
import type { ArtLayer, ID, PanelArt, Stroke } from '../../core/model/types';
import { useImageCacheRev } from '../../render/images';
import { appendToScene, syncLayerScene, type LayerScene } from '../../render/layerScene';
import { artHasContent, artRev, commitStroke, emptyArt, loadArt, rewriteLayer, saveArt } from '../../state/artStore';
import { useStory } from '../../state/useStory';
import { toast } from '../../ui';
import type { CanvasEngine, ScenePictures, StrokeMeta } from './useCanvasEngine';

export type CanvasDoc = {
  art: PanelArt;
  active: ArtLayer | undefined;
  /** True when the panel already had art when it opened. */
  hadArt: boolean;
  commit: (layerId: ID, meta: StrokeMeta, points: Float32Array, seq: number) => void;
  applyTransform: (layerId: ID, t: LayerTransform) => void;
  /** The art store moved. Strokes this hook wrote itself are recognised and skipped. */
  onArtRev: () => void;
  /** Call when leaving: thumbnails and page views follow the page's art revision. */
  leave: () => void;
};

export function useCanvasDoc(panelId: ID, pageId: ID, engine: CanvasEngine): CanvasDoc {
  const { publish } = engine;
  const [initial] = useState(() => {
    const art = loadArt(panelId) ?? emptyArt();
    return { art, hadArt: artHasContent(art) };
  });
  const [art, setArt] = useState(initial.art);
  const imageRev = useImageCacheRev();
  const imageRevRef = useRef(imageRev);
  imageRevRef.current = imageRev;
  const scenes = useRef(new Map<ID, LayerScene>());
  const handledRev = useRef(artRev(panelId));
  const dirty = useRef(false);

  const pictures = useCallback((): ScenePictures => {
    const out: ScenePictures = {};
    scenes.current.forEach((scene, id) => {
      out[id] = scene.picture;
    });
    return out;
  }, []);

  const syncScenes = useCallback((next: PanelArt) => {
    const map = new Map<ID, LayerScene>();
    next.layers.forEach(layer => {
      map.set(layer.id, syncLayerScene(layer, scenes.current.get(layer.id), imageRevRef.current));
    });
    scenes.current = map;
  }, []);

  const refresh = useCallback(
    (clearTransform: boolean) => {
      const next = loadArt(panelId);
      if (next) {
        syncScenes(next);
        setArt(next);
        publish(pictures(), null, clearTransform);
      }
    },
    [panelId, pictures, publish, syncScenes],
  );

  useEffect(() => {
    // Not during render: saving notifies the store's listeners, and it gives the layers their real ids.
    if (!loadArt(panelId)) {
      saveArt(panelId, initial.art);
      handledRev.current = artRev(panelId);
    }
    refresh(false);
  }, [imageRev, initial.art, panelId, refresh]);

  const onArtRev = useCallback(() => {
    const rev = artRev(panelId);
    if (rev !== handledRev.current) {
      handledRev.current = rev;
      dirty.current = true;
      refresh(false);
    }
  }, [panelId, refresh]);

  const commit = useCallback(
    (layerId: ID, meta: StrokeMeta, points: Float32Array, seq: number) => {
      const stroke: Stroke = { ...meta, points: Array.from(points) };
      try {
        // Another change may still be on its way to onArtRev. It must not be marked as handled here.
        const caughtUp = artRev(panelId) === handledRev.current;
        commitStroke(panelId, layerId, stroke);
        if (caughtUp) {
          handledRev.current = artRev(panelId);
        }
        dirty.current = true;
        const scene = scenes.current.get(layerId);
        if (scene) {
          scenes.current.set(layerId, appendToScene(scene, stroke));
        }
      } catch {
        toast("Couldn't save that stroke.");
      }
      publish(pictures(), seq, false);
    },
    [panelId, pictures, publish],
  );

  const applyTransform = useCallback(
    (layerId: ID, t: LayerTransform) => {
      const layer = loadArt(panelId)?.layers.find(item => item.id === layerId);
      if (!layer) {
        publish(pictures(), null, true);
        return;
      }
      const moved = transformLayer(layer, t);
      rewriteLayer(panelId, layerId, moved.strokes, moved.image ? { image: moved.image } : {});
      handledRev.current = artRev(panelId);
      dirty.current = true;
      refresh(true);
    },
    [panelId, pictures, publish, refresh],
  );

  const leave = useCallback(() => {
    if (dirty.current) {
      dirty.current = false;
      useStory.getState().bumpArt(pageId);
    }
  }, [pageId]);

  const active = useMemo(() => activeLayerOf(art), [art]);

  return { art, active, hadArt: initial.hadArt, commit, applyTransform, onArtRev, leave };
}
