/**
 * Reading a QR code inside the app, so joining a room or adding a friend does not depend on the phone's
 * camera app (several Android camera apps do not open `manganova://` links). The live camera reports the
 * text it found; a picked photo goes through `readQrPixels`, which runs the pure JS jsQR decoder.
 */
import jsQR from 'jsqr';

import { parseFriendLink } from './friendLink';
import { parseRoomLink } from './link';

export type ScannedCode = { kind: 'room' | 'friend'; url: string } | { kind: 'other'; text: string };

/** What a scanned text is. Links are matched case-insensitively, since some QR apps upper-case them. */
export function classifyScan(text: string): ScannedCode {
  const url = text.trim();
  if (parseRoomLink(url)) {
    return { kind: 'room', url };
  }
  if (parseFriendLink(url)) {
    return { kind: 'friend', url };
  }
  return { kind: 'other', text: url };
}

/** Photos larger than this on their longest side are scaled down first: jsQR's time grows with the pixels. */
export const QR_IMAGE_MAX_SIDE = 1200;

/** The scale that fits an image inside QR_IMAGE_MAX_SIDE, never enlarging. */
export function qrImageScale(width: number, height: number): number {
  const side = Math.max(width, height);
  return side > QR_IMAGE_MAX_SIDE ? QR_IMAGE_MAX_SIDE / side : 1;
}

/**
 * The text of the QR code in RGBA pixels, or null. Tries dark-on-light first and then light-on-dark, so a
 * screenshot of the app's dark theme also reads.
 */
export function readQrPixels(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): string | null {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return null;
  }
  const pixels = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4);
  const found = jsQR(pixels, width, height, { inversionAttempts: 'attemptBoth' });
  return found?.data ? found.data : null;
}
