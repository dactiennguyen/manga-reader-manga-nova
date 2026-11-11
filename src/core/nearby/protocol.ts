/**
 * How messages travel: one JSON envelope per line ("\n"), lines capped at MAX_LINE bytes, big payloads
 * cut into numbered blob chunks and put back together on arrival. Pure, so it is tested without phones.
 */
import { CHUNK_CHARS } from './schema';
import { PROTOCOL_VERSION, type Envelope, type Message, type MemberId, type RoomBlob } from './types';
import { utf8Decode, utf8Encode } from './utf8';

export { CHUNK_CHARS, parseEnvelope } from './schema';
// Lines are read with the forgiving decoder, so bad bytes never throw: they become U+FFFD and the envelope
// check decides what is kept.
export { utf8Decode, utf8Encode } from './utf8';

/** A blob chunk is ~48 KB; 256 KB leaves room for a long stroke and refuses anything absurd. */
export const MAX_LINE = 256 * 1024;
/** 4096 chunks × 48 KB ≈ 190 MB of base64: more than any story bundle, still bounded. */
export const MAX_CHUNKS = 4096;
/** Guests ping the host this often; either side gives up on the other after HEARTBEAT_TIMEOUT. */
export const PING_EVERY = 3000;
export const HEARTBEAT_TIMEOUT = 10000;
/** A guest whose Wi-Fi blinks gets this long to come back as the same member. */
export const REJOIN_GRACE = 8000;
/** A blob that stops arriving for this long is thrown away. */
export const BLOB_IDLE_TIMEOUT = 30000;
export const MAX_MEMBERS = 8;
export const APP_ID = 'manganova';

export function versionOk(version: number): boolean {
  return version === PROTOCOL_VERSION;
}

export function encodeLine(envelope: Envelope): Uint8Array {
  return utf8Encode(`${JSON.stringify(envelope)}\n`);
}

/**
 * Cuts lines out of a byte stream. Works on bytes, not text, because a TCP read can end in the middle of
 * a multi-byte character, while a newline byte never appears inside one.
 */
export class LineReader {
  private parts: Uint8Array[] = [];
  private size = 0;

  constructor(
    private readonly onLine: (line: string) => void,
    private readonly onOverflow: () => void,
    private readonly maxLine = MAX_LINE,
  ) {}

  push(bytes: Uint8Array): void {
    let start = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 10) {
        continue;
      }
      this.take(bytes.subarray(start, i));
      if (this.size > this.maxLine) {
        return this.overflow();
      }
      const line = utf8Decode(this.joined());
      this.parts = [];
      this.size = 0;
      if (line.trim()) {
        this.onLine(line);
      }
      start = i + 1;
    }
    this.take(bytes.subarray(start));
    if (this.size > this.maxLine) {
      this.overflow();
    }
  }

  private take(bytes: Uint8Array) {
    if (bytes.length) {
      this.parts.push(bytes.slice());
      this.size += bytes.length;
    }
  }

  private joined(): Uint8Array {
    if (this.parts.length === 1) {
      return this.parts[0];
    }
    const all = new Uint8Array(this.size);
    let at = 0;
    for (const part of this.parts) {
      all.set(part, at);
      at += part.length;
    }
    return all;
  }

  private overflow() {
    this.parts = [];
    this.size = 0;
    this.onOverflow();
  }
}

type BlobChunk = Extract<Message, { t: 'blob' }>;

/** The chunks of one blob, made one at a time so a big story is never copied all at once. */
export function* blobChunks(
  id: string,
  kind: BlobChunk['kind'],
  base64: string,
  meta?: Record<string, unknown>,
): Generator<BlobChunk> {
  const count = Math.max(1, Math.ceil(base64.length / CHUNK_CHARS));
  if (count > MAX_CHUNKS) {
    throw new Error('blob too large');
  }
  for (let index = 0; index < count; index++) {
    const data = base64.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS);
    yield index === 0 && meta ? { t: 'blob', id, kind, index, count, data, meta } : { t: 'blob', id, kind, index, count, data };
  }
}

type Pending = { kind: BlobChunk['kind']; count: number; parts: (string | undefined)[]; got: number; meta?: Record<string, unknown>; at: number };

export type AcceptResult =
  | { status: 'progress'; done: number; count: number }
  | { status: 'complete'; blob: RoomBlob }
  | { status: 'rejected' };

/**
 * Puts blobs back together. Each chunk must agree with the first on kind and count, sit inside the count,
 * and not repeat; anything else drops the whole blob. Blobs that go quiet are swept away.
 */
export class BlobAssembler {
  private pending = new Map<string, Pending>();

  constructor(private readonly now: () => number = Date.now) {}

  accept(chunk: BlobChunk, from: MemberId): AcceptResult {
    const key = `${from}\u0000${chunk.id}`;
    let entry = this.pending.get(key);
    if (!entry) {
      entry = { kind: chunk.kind, count: chunk.count, parts: new Array(chunk.count), got: 0, at: this.now() };
      this.pending.set(key, entry);
    }
    if (entry.kind !== chunk.kind || entry.count !== chunk.count || chunk.index >= entry.count || entry.parts[chunk.index] !== undefined) {
      this.pending.delete(key);
      return { status: 'rejected' };
    }
    entry.parts[chunk.index] = chunk.data;
    entry.got++;
    entry.at = this.now();
    if (chunk.meta) {
      entry.meta = chunk.meta;
    }
    if (entry.got < entry.count) {
      return { status: 'progress', done: entry.got, count: entry.count };
    }
    this.pending.delete(key);
    const blob: RoomBlob = { id: chunk.id, kind: entry.kind, data: entry.parts.join(''), from };
    if (entry.meta) {
      blob.meta = entry.meta;
    }
    return { status: 'complete', blob };
  }

  /** Drops blobs idle for longer than `idleMs`; returns how many were dropped. */
  sweep(idleMs = BLOB_IDLE_TIMEOUT): number {
    const limit = this.now() - idleMs;
    let dropped = 0;
    for (const [key, entry] of this.pending) {
      if (entry.at < limit) {
        this.pending.delete(key);
        dropped++;
      }
    }
    return dropped;
  }

  /** Forgets everything one member was sending, e.g. when they leave. */
  dropFrom(from: MemberId): void {
    for (const key of [...this.pending.keys()]) {
      if (key.startsWith(`${from}\u0000`)) {
        this.pending.delete(key);
      }
    }
  }

  get size(): number {
    return this.pending.size;
  }
}
