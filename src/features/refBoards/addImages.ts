import { Image } from 'react-native';

import { t, tn } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { fileUri } from '../../core/util/paths';
import { pickImagesToCache, pickPhotosToCache, removeFile, storeRefFile } from '../../native/files';
import { REF_LIMITS, imagesOf, useRefBoards, type ImageInput, type RefImageSource } from '../../state/useRefBoards';
import { toast } from '../../ui';

async function sizeOf(path: string): Promise<{ width: number; height: number }> {
  try {
    return await Image.getSize(fileUri(path));
  } catch {
    return { width: 0, height: 0 };
  }
}

function roomOn(boardId: ID): number {
  return Math.max(0, REF_LIMITS.imagesPerBoard - imagesOf(useRefBoards.getState().images, boardId).length);
}

/** Copies each file into the board's folder, reads its size, then pins it. Returns how many were pinned. */
async function pin(boardId: ID, sources: { path: string; move: boolean; source: RefImageSource; caption?: string }[]): Promise<number> {
  const room = roomOn(boardId);
  if (room === 0) {
    toast(t('A board holds up to {n} pictures.', { n: REF_LIMITS.imagesPerBoard }));
    sources.filter(item => item.move).forEach(item => removeFile(item.path));
    return 0;
  }
  const inputs: ImageInput[] = [];
  for (const item of sources.slice(0, room)) {
    try {
      const path = await storeRefFile(item.path, boardId, item.move);
      inputs.push({ path, ...(await sizeOf(path)), source: item.source, caption: item.caption });
    } catch {}
  }
  sources.slice(room).filter(item => item.move).forEach(item => removeFile(item.path));
  const added = useRefBoards.getState().addImages(boardId, inputs).length;
  if (added < sources.length) {
    toast(added ? t('Some pictures could not be added.') : t('Could not load the image'));
  } else if (added > 1) {
    toast(tn(added, '{count} picture pinned', '{count} pictures pinned'));
  }
  return added;
}

/** Where pictures on the device come from: the photo library, or image files through the system file picker. */
export type DeviceSource = 'photos' | 'files';

export async function addFromDevice(boardId: ID, from: DeviceSource = 'photos'): Promise<number> {
  try {
    const max = Math.min(REF_LIMITS.pickAtOnce, Math.max(1, roomOn(boardId)));
    const picked = await (from === 'photos' ? pickPhotosToCache(max) : pickImagesToCache(max));
    return picked.length ? await pin(boardId, picked.map(item => ({ path: item.path, move: true, source: 'device' }))) : 0;
  } catch {
    toast(t('Could not load the image'));
    return 0;
  }
}

/** Pictures the app already keeps: copied, so deleting the character or the board never breaks the other. */
export function addFromApp(boardId: ID, items: { path: string; source: RefImageSource; caption?: string }[]): Promise<number> {
  return pin(
    boardId,
    items.map(item => ({ ...item, move: false })),
  );
}
