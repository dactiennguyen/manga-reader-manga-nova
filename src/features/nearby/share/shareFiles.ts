import { ImageFormat, Skia } from '@shopify/react-native-skia';

import type { ID } from '../../../core/model/types';
import type { StoryFiles } from '../../../core/nearby/sendStory';
import { toAbsolute } from '../../../core/util/paths';
import { uid } from '../../../core/util/id';
import { DIRS, RNFS, ensureDirs, fileSize, removeFile, saveImageData } from '../../../native/files';
import { appServices } from '../../../state/services';
import { useStory } from '../../../state/useStory';

const FACE_SIZE = 160;

/**
 * Stories travel as the same `.manganova` file the export makes and the import reads, so a story sent nearby
 * is exactly a backup handed over: images included, ids remapped on arrival, nothing new to keep in step.
 */
export const storyFiles: StoryFiles = {
  async pack(projectId: ID) {
    const path = await appServices().exportProject(projectId);
    try {
      const [base64, bytes] = await Promise.all([RNFS.readFile(path, 'base64'), fileSize(path)]);
      const title = useStory.getState().projects[projectId]?.title.trim() ?? '';
      return { base64, title, bytes };
    } finally {
      removeFile(path).catch(() => undefined);
    }
  },
  async unpack(base64: string) {
    await ensureDirs();
    const path = `${DIRS.tmp}/nearby-${uid()}.manganova`;
    await RNFS.writeFile(path, base64, 'base64');
    try {
      return await appServices().importProject(path);
    } finally {
      removeFile(path).catch(() => undefined);
    }
  },
};

/** A small square JPEG of a character's face for a card swap, centre-cropped. Null when there is none. */
export async function faceThumbnail(face: string | undefined): Promise<string | null> {
  if (!face) {
    return null;
  }
  try {
    const data = Skia.Data.fromBase64(await RNFS.readFile(toAbsolute(face), 'base64'));
    const image = Skia.Image.MakeImageFromEncoded(data);
    const surface = image ? Skia.Surface.Make(FACE_SIZE, FACE_SIZE) : null;
    if (!image || !surface) {
      return null;
    }
    const side = Math.min(image.width(), image.height());
    const src = Skia.XYWHRect((image.width() - side) / 2, (image.height() - side) / 2, side, side);
    surface.getCanvas().drawImageRect(image, src, Skia.XYWHRect(0, 0, FACE_SIZE, FACE_SIZE), Skia.Paint());
    surface.flush();
    return surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 80);
  } catch {
    return null;
  }
}

/** Saves a received face picture among this phone's images and returns its path. */
export function saveFace(base64: string | undefined): Promise<string | undefined> {
  return base64 ? saveImageData(base64, 'jpg').catch(() => undefined) : Promise.resolve(undefined);
}
