import { ImageFormat, makeImageFromView } from '@shopify/react-native-skia';
import type { RefObject } from 'react';

import { DIRS, MIME, RNFS, ensureDirs, shareFile } from '../../../native/files';

/**
 * Snapshots the card as it is drawn on screen with Skia and hands the PNG to the share sheet. The view must
 * be laid out, visible and not rotated, and set `collapsable={false}` so Android keeps a native view for it.
 */
export async function shareCardImage(view: RefObject<unknown>, fileName: string, title: string): Promise<void> {
  const image = await makeImageFromView(view as RefObject<never>);
  if (!image) {
    throw new Error('The card could not be drawn');
  }
  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  await ensureDirs();
  const path = `${DIRS.exports}/${fileName}.png`;
  await RNFS.writeFile(path, base64, 'base64');
  await shareFile(path, MIME.png, title);
}
