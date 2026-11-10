import { useCallback } from 'react';

import { coverImageRect, fitImageRect } from '../../core/art/strokes';
import { t } from '../../core/i18n';
import { LIMITS } from '../../core/model/constants';
import type { PanelShape } from '../../core/layout/layout';
import type { ArtLayer, ID } from '../../core/model/types';
import { pickImage } from '../../native/files';
import { loadImage } from '../../render/images';
import { addLayer, editLayer, loadArt, rewriteLayer, setActiveLayer } from '../../state/artStore';
import { confirm, toast } from '../../ui';
import type { CanvasReference } from './CanvasOverlays';
import { importBundledImage } from './materialFile';
import type { Material } from './materials';

export function useLayerActions(
  panelId: ID,
  active: ArtLayer | undefined,
  shape: PanelShape,
  showReference: (reference: CanvasReference) => void,
) {
  const importImage = useCallback(async () => {
    if (!active) {
      return;
    }
    if (active.locked) {
      toast(t('Layer is locked'));
      return;
    }
    const path = await pickImage();
    const image = path ? await loadImage(path) : null;
    if (!path || !image) {
      if (path) {
        toast(t('Could not open the image'));
      }
      return;
    }
    const rect = fitImageRect(image.width(), image.height(), shape.bbox);
    editLayer(panelId, active.id, { image: { uri: path, ...rect } });
    toast(t('Image placed on layer'));
  }, [active, panelId, shape]);

  const clearActive = useCallback(async () => {
    // Strokes do not re-render the screen, so `active` can be behind the store.
    const layer = loadArt(panelId)?.layers.find(item => item.id === active?.id);
    if (!layer || (!layer.strokes.length && !layer.image)) {
      toast(t('Layer is already empty'));
      return;
    }
    if (layer.locked) {
      toast(t('Layer is locked'));
      return;
    }
    if (await confirm(t('Clear layer "{name}"?', { name: layer.name }), undefined, { confirmText: t('Clear'), destructive: true })) {
      rewriteLayer(panelId, layer.id, [], { image: undefined });
      toast(t('Layer cleared'));
    }
  }, [active, panelId]);

  const addReference = useCallback(async () => {
    const path = await pickImage();
    if (path) {
      showReference({ id: path, images: [path] });
    }
  }, [showReference]);

  /** A background goes under the drawing and leaves the current layer active. A pattern goes on top. */
  const placeMaterial = useCallback(
    async (material: Material): Promise<boolean> => {
      const background = material.kind === 'background';
      if ((loadArt(panelId)?.layers.length ?? 0) >= LIMITS.layers) {
        toast(t('A panel can hold {max} layers. Merge or delete one first', { max: LIMITS.layers }));
        return false;
      }
      try {
        const file = await importBundledImage(material.source);
        if (!file) {
          throw new Error('Unreadable material');
        }
        const place = background ? coverImageRect : fitImageRect;
        const rect = place(file.width, file.height, shape.bbox);
        addLayer(panelId, material.label, { image: { uri: file.uri, ...rect } }, background ? 0 : undefined);
        if (background && active) {
          setActiveLayer(panelId, active.id);
        }
        return true;
      } catch {
        toast(t('Could not add this material'));
        return false;
      }
    },
    [active, panelId, shape],
  );

  return { importImage, clearActive, addReference, placeMaterial };
}
