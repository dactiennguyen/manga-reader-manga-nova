/**
 * JSON ↔ base64 for blobs (a shared page, a layer). Encoded in slices with a pause between them, so a
 * page full of strokes never freezes the screen while it is packed or unpacked.
 */
/* eslint-disable no-bitwise -- base64 is bit arithmetic */
import { utf8Decode, utf8Encode } from './protocol';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** A multiple of 3, so each slice encodes without padding in the middle. */
const SLICE_BYTES = 48 * 1024 * 3;

const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function encodeSlice(bytes: Uint8Array, start: number, end: number): string {
  const out: string[] = [];
  let i = start;
  for (; i + 2 < end; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out.push(ALPHABET[n >> 18], ALPHABET[(n >> 12) & 63], ALPHABET[(n >> 6) & 63], ALPHABET[n & 63]);
  }
  const rest = end - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out.push(ALPHABET[n >> 18], ALPHABET[(n >> 12) & 63], '==');
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out.push(ALPHABET[n >> 18], ALPHABET[(n >> 12) & 63], ALPHABET[(n >> 6) & 63], '=');
  }
  return out.join('');
}

export async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += SLICE_BYTES) {
    parts.push(encodeSlice(bytes, start, Math.min(bytes.length, start + SLICE_BYTES)));
    if (start + SLICE_BYTES < bytes.length) {
      await pause();
    }
  }
  return parts.join('');
}

/** Null for anything that is not clean base64: the data came from another phone. */
export async function base64ToBytes(text: string): Promise<Uint8Array | null> {
  const clean = text.replace(/[=]+$/, '');
  if (clean.length % 4 === 1) {
    return null;
  }
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let at = 0;
  const sliceChars = (SLICE_BYTES / 3) * 4;
  for (let start = 0; start < clean.length; start += sliceChars) {
    const end = Math.min(clean.length, start + sliceChars);
    for (let i = start; i < end; i += 4) {
      let n = 0;
      let count = 0;
      for (let k = 0; k < 4 && i + k < end; k++) {
        const code = clean.charCodeAt(i + k);
        const value = code < 128 ? LOOKUP[code] : -1;
        if (value < 0) {
          return null;
        }
        n |= value << (18 - 6 * k);
        count++;
      }
      out[at++] = (n >> 16) & 255;
      if (count > 2) {
        out[at++] = (n >> 8) & 255;
      }
      if (count > 3) {
        out[at++] = n & 255;
      }
    }
    if (end < clean.length) {
      await pause();
    }
  }
  return out.subarray(0, at);
}

export function jsonToBase64(value: unknown): Promise<string> {
  return bytesToBase64(utf8Encode(JSON.stringify(value)));
}

export async function base64ToText(text: string): Promise<string | null> {
  const bytes = await base64ToBytes(text);
  return bytes ? utf8Decode(bytes) : null;
}

/** Null when the text is not base64 or not JSON. The caller still checks the shape. */
export async function base64ToJson(text: string): Promise<unknown> {
  const decoded = await base64ToText(text);
  if (decoded === null) {
    return null;
  }
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
