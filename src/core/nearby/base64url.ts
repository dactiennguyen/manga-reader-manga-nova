/* eslint-disable no-bitwise -- base64 works on bits. */
/**
 * UTF-8 text to URL-safe base64 and back, in plain TypeScript: a pen name in Japanese or Vietnamese must survive
 * a QR code, and `btoa` only takes Latin-1. Used for short payloads (links), never for whole files.
 */
import { utf8DecodeStrict, utf8Encode } from './utf8';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP: Record<string, number> = Object.fromEntries([...ALPHABET].map((char, index) => [char, index]));

export function encodeBase64Url(text: string): string {
  const bytes = utf8Encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let k = 0; k < chars; k++) {
      out += ALPHABET[(n >> (18 - 6 * k)) & 63];
    }
  }
  return out;
}

/** Null for anything that is not clean base64url of valid UTF-8. */
export function decodeBase64Url(encoded: string): string | null {
  if (encoded.length % 4 === 1) {
    return null;
  }
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const group = encoded.slice(i, i + 4);
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const value = k < group.length ? LOOKUP[group[k]] : 0;
      if (value === undefined) {
        return null;
      }
      n = (n << 6) | value;
    }
    bytes.push((n >> 16) & 255);
    if (group.length > 2) {
      bytes.push((n >> 8) & 255);
    }
    if (group.length > 3) {
      bytes.push(n & 255);
    }
  }
  // Strict: a broken sequence gives null instead of a replacement character, so garbled links are refused.
  return utf8DecodeStrict(bytes);
}

/** Standard padded base64 of UTF-8 text, the form blob chunks carry. */
export function encodeBase64Text(text: string): string {
  const url = encodeBase64Url(text).replace(/-/g, '+').replace(/_/g, '/');
  return url + '='.repeat((4 - (url.length % 4)) % 4);
}

export function decodeBase64Text(encoded: string): string | null {
  if (/[-_]/.test(encoded)) {
    return null;
  }
  return decodeBase64Url(encoded.replace(/[=]+$/, '').replace(/\+/g, '-').replace(/\//g, '_'));
}
