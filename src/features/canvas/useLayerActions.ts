import { useCallback } from 'react';

import { fitImageRect } from '../../core/art/strokes';
import type { PanelShape } from '../../core/layout/layout';
import type { ArtLayer, ID } from '../../core/model/types';
import { pickImage } from '../../native/files';
import { loadImage } from '../../render/images';
import { editLayer, loadArt, rewriteLayer } from '../../state/artStore';
import { confirm, toast } from '../../ui';

export function useLayerActions(
  panelId: ID,
  active: ArtLayer | undefined,
  shape: PanelShape,
  setRefPath: (path: string | null) => void,
) {
  const importImage = useCallback(async () => {
    if (!active) {
      return;
    }
    if (active.locked) {
      toast('Layer is locked');
      return;
    }
    const path = await pickImage();
    const image = path ? await loadImage(path) : null;
    if (!path || !image) {
      if (path) {
        toast('Could not open the image');
      }
      return;
    }
    const rect = fitImageRect(image.width(), image.height(), shape.bbox);
    editLayer(panelId, active.id, { image: { uri: path, ...rect } });
    toast('Image placed on layer');
  }, [active, panelId, shape]);

  const clearActive = useCallback(async () => {
    // Strokes do not re-render the screen, so `active` can be behind the store.
    const layer = loadArt(panelId)?.layers.find(item => item.id === active?.id);
    if (!layer || (!layer.strokes.length && !layer.image)) {
      toast('Layer is already empty');
      return;
    }
    if (layer.locked) {
      toast('Layer is locked');
      return;
    }
    if (await confirm(`Clear layer "${layer.name}"?`, undefined, { confirmText: 'Clear', destructive: true })) {
      rewriteLayer(panelId, layer.id, [], { image: undefined });
      toast('Layer cleared');
    }
  }, [active, panelId]);

  const addReference = useCallback(async () => {
    const path = await pickImage();
    if (path) {
      setRefPath(path);
    }
  }, [setRefPath]);

  return { importImage, clearActive, addReference };
}
