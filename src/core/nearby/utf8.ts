/* eslint-disable no-bitwise -- UTF-8 works on bits. */
/**
 * UTF-8 by hand, the one codec the nearby code uses (protocol lines, blob payloads, links): Hermes has no
 * TextEncoder or TextDecoder, and Buffer is not part of the app. It follows the standard both ways: no
 * overlong forms, no surrogate code points, nothing past U+10FFFF.
 */

const REPLACEMENT = 0xfffd;

/** A lone surrogate (half an emoji, cut by a slice) is written as U+FFFD, so the bytes are always valid. */
export function utf8Encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 3);
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // Base64 lines are ASCII, so this is the path nearly every character takes.
    if (code < 0x80) {
      out[at++] = code;
      continue;
    }
    if (code >= 0xd800 && code < 0xe000) {
      const low = code < 0xdc00 && i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (low >= 0xdc00 && low < 0xe000) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      } else {
        code = REPLACEMENT;
      }
    }
    if (code < 0x800) {
      out[at++] = 0xc0 | (code >> 6);
      out[at++] = 0x80 | (code & 63);
    } else if (code < 0x10000) {
      out[at++] = 0xe0 | (code >> 12);
      out[at++] = 0x80 | ((code >> 6) & 63);
      out[at++] = 0x80 | (code & 63);
    } else {
      out[at++] = 0xf0 | (code >> 18);
      out[at++] = 0x80 | ((code >> 12) & 63);
      out[at++] = 0x80 | ((code >> 6) & 63);
      out[at++] = 0x80 | (code & 63);
    }
  }
  return out.slice(0, at);
}

/**
 * Reads bytes as UTF-8. A broken sequence (a stray continuation byte, a cut-off character, an overlong
 * form, a surrogate) gives null when `fatal`, otherwise one U+FFFD and reading goes on after it.
 */
function decode(bytes: ArrayLike<number>, fatal: boolean): string | null {
  let out = '';
  let run: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const first = bytes[i];
    if (first < 0x80) {
      run.push(first);
      i += 1;
    } else {
      // 0xC0, 0xC1 and 0xF5 up can only start overlong or out-of-range characters, so they never lead.
      const extra = first >= 0xc2 && first < 0xe0 ? 1 : first >= 0xe0 && first < 0xf0 ? 2 : first >= 0xf0 && first < 0xf5 ? 3 : 0;
      let code = extra ? first & (0x3f >> extra) : -1;
      let used = 1;
      for (let k = 1; k <= extra; k++) {
        const next = bytes[i + k];
        if (next === undefined || next >> 6 !== 2) {
          code = -1;
          break;
        }
        code = (code << 6) | (next & 63);
        used++;
      }
      const smallest = extra === 1 ? 0x80 : extra === 2 ? 0x800 : 0x10000;
      if (code < smallest || code > 0x10ffff || (code >= 0xd800 && code < 0xe000)) {
        if (fatal) {
          return null;
        }
        run.push(REPLACEMENT);
      } else if (code >= 0x10000) {
        run.push(0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 1023));
      } else {
        run.push(code);
      }
      i += used;
    }
    if (run.length > 8192) {
      out += String.fromCharCode.apply(null, run);
      run = [];
    }
  }
  return out + String.fromCharCode.apply(null, run);
}

/** For bytes from the network: never throws, never fails; bad bytes become U+FFFD and the line's parse decides. */
export function utf8Decode(bytes: ArrayLike<number>): string {
  return decode(bytes, false) as string;
}

/** For links and payloads that must be exact: null for anything that is not valid UTF-8. */
export function utf8DecodeStrict(bytes: ArrayLike<number>): string | null {
  return decode(bytes, true);
}
