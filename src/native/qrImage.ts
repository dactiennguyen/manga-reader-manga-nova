/**
 * Reads the QR code in a picked photo, such as a screenshot of a friend's room code. Skia decodes the
 * photo and hands back its pixels; the decoding of the code itself is pure JS (core/nearby/qrRead.ts).
 */
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { types } from '@react-native-documents/picker';

import { qrImageScale, readQrPixels } from '../core/nearby/qrRead';
import { pickToCache } from './files';

/** The QR text in the image at `path`, or null when there is none or the image cannot be read. */
export async function readQrFromImage(path: string): Promise<string | null> {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(await RNFS.readFile(path, 'base64')));
  if (!image) {
    return null;
  }
  const scale = qrImageScale(image.width(), image.height());
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  // Drawn onto a white surface: a transparent PNG would otherwise read as black around the code.
  const surface = Skia.Surface.Make(width, height);
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  canvas.drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, width, height), Skia.Paint());
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  return pixels instanceof Uint8Array ? readQrPixels(pixels, width, height) : null;
}

/**
 * Lets the user pick a photo and reads its QR code. `undefined` when they cancelled, null when the photo
 * has no code that can be read.
 */
export async function pickQrImage(): Promise<string | null | undefined> {
  const picked = await pickToCache(types.images);
  if (!picked) {
    return undefined;
  }
  try {
    return await readQrFromImage(picked.path);
  } catch {
    return null;
  } finally {
    RNFS.unlink(picked.path).catch(() => undefined);
  }
}
