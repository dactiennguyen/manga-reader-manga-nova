/**
 * Ways to reach a room without the nearby list: a `manganova://join` link (inside the QR code), a short
 * typed room code. (The mangaka card's `manganova://friend` link is in friendLink.ts.)
 *
 * The room code is 10 letters/digits for 6 bytes: the last two parts of the host's IP address, the port,
 * and the 16-bit token. The first two parts of the IP are taken from the joining phone, which is on the
 * same Wi-Fi (home networks are almost always /16 or smaller).
 */
import type { RoomAddress } from './types';

const SCHEME = 'manganova:';
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U to misread

/** Tokens are 4 hex digits so they fit the typed code; the host also slows down repeated wrong guesses. */
export function newToken(random: () => number = Math.random): string {
  return Math.floor(random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
}

export function isIPv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function validPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port < 65536;
}

function validToken(token: string): boolean {
  return /^[0-9a-f]{4}$/.test(token);
}

function addressQuery(address: RoomAddress): string {
  const params = [`h=${address.host}`, `p=${address.port}`, `k=${address.token}`];
  if (address.name) {
    params.push(`n=${encodeURIComponent(address.name.slice(0, 60))}`);
  }
  return params.join('&');
}

function readQuery(url: string): Map<string, string> {
  const query = new Map<string, string>();
  const at = url.indexOf('?');
  if (at < 0) {
    return query;
  }
  for (const pair of url.slice(at + 1).split('#')[0].split('&')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    try {
      query.set(pair.slice(0, eq), decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')));
    } catch {
      // A broken escape: skip that one field.
    }
  }
  return query;
}

function addressFrom(query: Map<string, string>): RoomAddress | null {
  const host = query.get('h') ?? '';
  const port = Number(query.get('p'));
  const token = (query.get('k') ?? '').toLowerCase();
  if (!isIPv4(host) || !validPort(port) || !validToken(token)) {
    return null;
  }
  const name = query.get('n')?.trim().slice(0, 60);
  return name ? { host, port, token, name } : { host, port, token };
}

/** "manganova://join?..." or null when it is not a valid join link. */
function pathOf(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith(SCHEME)) {
    return null;
  }
  return trimmed.slice(SCHEME.length).replace(/^\/+/, '').split(/[?#]/)[0].toLowerCase();
}

export function roomLink(address: RoomAddress): string {
  return `manganova://join?${addressQuery(address)}`;
}

export function parseRoomLink(url: string): RoomAddress | null {
  return pathOf(url) === 'join' ? addressFrom(readQuery(url)) : null;
}

/** "ABCDE-FGHJK" from the host's address. Null when the host is not an IPv4 address. */
export function roomCode(address: RoomAddress): string | null {
  if (!isIPv4(address.host) || !validPort(address.port) || !validToken(address.token)) {
    return null;
  }
  const [, , c, d] = address.host.split('.').map(Number);
  const token = parseInt(address.token, 16);
  // 48 bits do not fit a 32-bit integer, so the value is built in a float, which is exact up to 2^53.
  let value = ((c * 256 + d) * 65536 + address.port) * 65536 + token;
  let code = '';
  for (let i = 0; i < 10; i++) {
    code = CODE_ALPHABET[value % 32] + code;
    value = Math.floor(value / 32);
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Reads a typed room code; `myIp` supplies the first two parts of the host's IP address. */
export function parseRoomCode(code: string, myIp: string | null): RoomAddress | null {
  const clean = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (clean.length !== 10) {
    return null;
  }
  let value = 0;
  for (const char of clean) {
    const digit = CODE_ALPHABET.indexOf(char);
    if (digit < 0) {
      return null;
    }
    value = value * 32 + digit;
  }
  const token = value % 65536;
  value = Math.floor(value / 65536);
  const port = value % 65536;
  value = Math.floor(value / 65536);
  const d = value % 256;
  const c = Math.floor(value / 256);
  const [a, b] = myIp && isIPv4(myIp) ? myIp.split('.') : ['192', '168'];
  if (c > 255 || !validPort(port)) {
    return null;
  }
  return { host: `${a}.${b}.${c}.${d}`, port, token: token.toString(16).padStart(4, '0') };
}
