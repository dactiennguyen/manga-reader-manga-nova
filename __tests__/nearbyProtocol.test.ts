import { isIPv4, newToken, parseRoomCode, parseRoomLink, roomCode, roomLink } from '../src/core/nearby/link';
import {
  BlobAssembler,
  blobChunks,
  CHUNK_CHARS,
  encodeLine,
  LineReader,
  MAX_LINE,
  parseEnvelope,
  utf8Decode,
  utf8Encode,
} from '../src/core/nearby/protocol';
import type { Envelope } from '../src/core/nearby/types';
import { utf8DecodeStrict } from '../src/core/nearby/utf8';

describe('nearby framing', () => {
  it('round-trips text in UTF-8, emoji and accents included', () => {
    const text = 'Mai 🎨 vẽ truyện — 漫画';
    expect(utf8Decode(utf8Encode(text))).toBe(text);
    expect(Array.from(utf8Encode('é'))).toEqual([0xc3, 0xa9]);
  });

  it('decodes bad bytes from the network without throwing, and refuses them in strict mode', () => {
    const bad: number[][] = [
      [0xff], // never valid
      [0x80], // a continuation with no lead
      [0xe6, 0xbc], // a character cut short
      [0xc0, 0xaf], // overlong '/'
      [0xed, 0xa0, 0x80], // a surrogate written as UTF-8
      [0xf4, 0x90, 0x80, 0x80], // past U+10FFFF
    ];
    for (const bytes of bad) {
      const line = Uint8Array.from([0x61, ...bytes, 0x62]);
      const text = utf8Decode(line);
      expect(text.startsWith('a') && text.endsWith('b') && text.includes('\ufffd')).toBe(true);
      expect(utf8DecodeStrict(line)).toBeNull();
    }
    // A stray byte inside a line still lets the next character through intact.
    expect(utf8Decode(Uint8Array.from([0xe6, 0x41]))).toBe('\ufffdA');
    // Half an emoji is written as U+FFFD, so what goes out is always valid UTF-8.
    expect(utf8DecodeStrict(utf8Encode('x\ud83cy'))).toBe('x\ufffdy');
    expect(utf8DecodeStrict(utf8Encode('Mai 🎨 漫画'))).toBe('Mai 🎨 漫画');
    // A garbled line is dropped by the envelope check, never thrown at the reader.
    const lines: string[] = [];
    new LineReader(line => lines.push(line), () => undefined).push(Uint8Array.from([0x7b, 0xff, 0x7d, 10]));
    expect(lines).toHaveLength(1);
    expect(parseEnvelope(lines[0]).ok).toBe(false);
  });

  it('cuts lines out of a stream split at any byte, even inside a character', () => {
    const envelopes: Envelope[] = [
      { m: { t: 'codraw.react', from: 'a', emoji: '🎉' } },
      { m: { t: 'ping' } },
      { m: { t: 'read.note', from: 'b', pageId: 'p', panelId: null, x: 0.5, y: 0.25, sticker: '❤️', text: 'Hay quá!' }, to: 'c' },
    ];
    const bytes = new Uint8Array(envelopes.flatMap(item => Array.from(encodeLine(item))));
    for (const step of [1, 2, 3, 7, 1000]) {
      const lines: string[] = [];
      const reader = new LineReader(line => lines.push(line), () => {
        throw new Error('overflow');
      });
      for (let at = 0; at < bytes.length; at += step) {
        reader.push(bytes.subarray(at, at + step));
      }
      expect(lines.map(line => (parseEnvelope(line) as { envelope: Envelope }).envelope)).toEqual(envelopes);
    }
  });

  it('gives up on a line longer than the cap', () => {
    const overflow = jest.fn();
    const reader = new LineReader(() => undefined, overflow, 100);
    reader.push(new Uint8Array(60).fill(65));
    expect(overflow).not.toHaveBeenCalled();
    reader.push(new Uint8Array(60).fill(65));
    expect(overflow).toHaveBeenCalledTimes(1);
    expect(MAX_LINE).toBeGreaterThan(CHUNK_CHARS * 2);
  });
});

describe('nearby message checks', () => {
  it('accepts every well-formed message', () => {
    const ok: Envelope['m'][] = [
      { t: 'hello', v: 1, token: 'ab12', name: 'Ken', app: 'manganova' },
      { t: 'welcome', v: 1, you: 'g1', room: { roomId: 'r', name: 'Room', members: [{ id: 'h', name: 'Mai', color: 0, host: true }], activity: 'lobby', options: {} } },
      { t: 'refused', reason: 'token' },
      { t: 'blob', id: 'b1', kind: 'image', index: 0, count: 1, data: 'QUJD', meta: { w: 2 } },
      { t: 'codraw.stroke', from: 'a', item: { pageId: 'p', panelId: 'q', layerKey: 'a', stroke: { tool: 'gpen', color: '#000', size: 2, opacity: 1, points: [0, 0, 1, 1] } } },
      { t: 'codraw.stroke', from: 'a', item: { pageId: 'p', panelId: 'q', layerKey: 'a', stroke: { tool: 'brush', color: '#000', size: 2, opacity: 1, points: [0, 0, 0.5, 1, 1, 1], pressure: true, tone: { density: 0.4 } } } },
      { t: 'ping', at: 5 },
      { t: 'pong', at: 5, hostAt: 9 },
      { t: 'battle.result', scores: { a: 2, b: 1 } },
      { t: 'dub.roles', roles: { c1: 'a' } },
      { t: 'send.offer', from: 'a', blobId: 'b', title: 'Story', bytes: 1000 },
    ];
    for (const m of ok) {
      expect(parseEnvelope(JSON.stringify({ m }))).toEqual({ ok: true, envelope: { m } });
    }
  });

  it('drops broken JSON, unknown types and wrong shapes, and strips unknown fields', () => {
    expect(parseEnvelope('{nope')).toEqual({ ok: false, reason: 'json' });
    expect(parseEnvelope(JSON.stringify({ m: { t: 'eval', code: '1' } }))).toEqual({ ok: false, reason: 'unknown' });
    expect(parseEnvelope(JSON.stringify({ m: { t: 'battle.vote', from: 'a' } }))).toEqual({ ok: false, reason: 'shape' });
    expect(parseEnvelope(JSON.stringify({ m: { t: 'blob', id: 'b', kind: 'exe', index: 0, count: 1, data: '' } }))).toMatchObject({ ok: false });
    expect(parseEnvelope(JSON.stringify({ m: { t: 'blob', id: 'b', kind: 'image', index: 0, count: 1, data: '<script>' } }))).toMatchObject({ ok: false });
    expect(parseEnvelope(JSON.stringify({ m: { t: 'codraw.react', from: 'a', emoji: 'x'.repeat(100) } }))).toMatchObject({ ok: false });
    expect(parseEnvelope(JSON.stringify({ m: { t: 'ping', extra: 1 } }))).toEqual({ ok: true, envelope: { m: { t: 'ping' } } });
  });
});

describe('nearby blobs', () => {
  const data = 'QUJD'.repeat(Math.ceil((CHUNK_CHARS * 3.2) / 4));

  it('cuts a blob into numbered chunks and puts it back together in any order', () => {
    const chunks = [...blobChunks('b1', 'story', data, { title: 'Ink' })];
    expect(chunks).toHaveLength(4);
    expect(chunks.every(chunk => chunk.data.length <= CHUNK_CHARS)).toBe(true);
    expect(chunks[0].meta).toEqual({ title: 'Ink' });
    expect(chunks[1].meta).toBeUndefined();
    const assembler = new BlobAssembler();
    const results = [chunks[2], chunks[0], chunks[3], chunks[1]].map(chunk => assembler.accept(chunk, 'm1'));
    expect(results.slice(0, 3).map(result => result.status)).toEqual(['progress', 'progress', 'progress']);
    expect(results[3]).toEqual({ status: 'complete', blob: { id: 'b1', kind: 'story', data, meta: { title: 'Ink' }, from: 'm1' } });
    expect(assembler.size).toBe(0);
  });

  it('keeps blobs with the same id from different members apart', () => {
    const assembler = new BlobAssembler();
    const [a0, a1] = [...blobChunks('same', 'image', data.slice(0, CHUNK_CHARS * 2))];
    expect(assembler.accept(a0, 'm1').status).toBe('progress');
    expect(assembler.accept(a0, 'm2').status).toBe('progress');
    expect(assembler.accept(a1, 'm1').status).toBe('complete');
    expect(assembler.size).toBe(1);
  });

  it('rejects a repeated chunk, an index past the count, or a count that changes', () => {
    const [c0, c1] = [...blobChunks('b', 'audio', data)];
    const assembler = new BlobAssembler();
    assembler.accept(c0, 'm');
    expect(assembler.accept(c0, 'm').status).toBe('rejected');
    assembler.accept(c0, 'm');
    expect(assembler.accept({ ...c1, index: 9 }, 'm').status).toBe('rejected');
    assembler.accept(c0, 'm');
    expect(assembler.accept({ ...c1, count: 2 }, 'm').status).toBe('rejected');
    expect(assembler.size).toBe(0);
  });

  it('throws away blobs that stop arriving, and those of a member who left', () => {
    let now = 0;
    const assembler = new BlobAssembler(() => now);
    const [c0] = [...blobChunks('b', 'card', data)];
    assembler.accept(c0, 'm1');
    assembler.accept(c0, 'm2');
    assembler.dropFrom('m2');
    expect(assembler.size).toBe(1);
    now = 10000;
    expect(assembler.sweep(30000)).toBe(0);
    now = 40001;
    expect(assembler.sweep(30000)).toBe(1);
    expect(assembler.size).toBe(0);
  });
});

describe('room links and codes', () => {
  const address = { host: '192.168.1.42', port: 51234, token: 'a1b2', name: "Mai's room & co" };

  it('builds and parses a join link', () => {
    const link = roomLink(address);
    expect(link.startsWith('manganova://join?')).toBe(true);
    expect(parseRoomLink(link)).toEqual(address);
    expect(parseRoomLink('MANGANOVA:///join?h=10.0.0.2&p=80&k=FFFF')).toEqual({ host: '10.0.0.2', port: 80, token: 'ffff' });
  });

  it('refuses links that are not valid joins', () => {
    for (const bad of [
      'https://example.com/join?h=1.2.3.4&p=1&k=abcd',
      'manganova://friend?h=1.2.3.4&p=1&k=abcd',
      'manganova://join?h=1.2.3.400&p=1&k=abcd',
      'manganova://join?h=1.2.3.4&p=70000&k=abcd',
      'manganova://join?h=1.2.3.4&p=1&k=zz',
      'manganova://join?h=evil.com&p=1&k=abcd',
      'manganova://join?h=1.2.3.4&p=1&k=abcd&n=%E0%A4%A',
    ]) {
      const parsed = parseRoomLink(bad);
      if (bad.endsWith('%A')) {
        expect(parsed).toEqual({ host: '1.2.3.4', port: 1, token: 'abcd' });
      } else {
        expect(parsed).toBeNull();
      }
    }
  });

  it('round-trips a typed room code using the joining phone address', () => {
    const code = roomCode(address)!;
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    expect(parseRoomCode(code, '192.168.7.9')).toEqual({ host: '192.168.1.42', port: 51234, token: 'a1b2' });
    expect(parseRoomCode(code.toLowerCase().replace('-', ' '), '192.168.0.3')).toEqual({ host: '192.168.1.42', port: 51234, token: 'a1b2' });
    expect(parseRoomCode(roomCode({ host: '10.20.255.1', port: 1, token: '0000' })!, '10.20.3.4')).toEqual({ host: '10.20.255.1', port: 1, token: '0000' });
    expect(parseRoomCode('ABC', null)).toBeNull();
    expect(parseRoomCode('UUUUU-UUUUU', null)).toBeNull();
  });

  it('makes 4-digit hex tokens', () => {
    expect(newToken(() => 0)).toBe('0000');
    expect(newToken(() => 0.99999)).toBe('ffff');
    expect(isIPv4('192.168.0.1')).toBe(true);
    expect(isIPv4('192.168.0')).toBe(false);
  });
});

describe('nearby discovery results', () => {
  it('keeps only Manganova rooms with a usable IPv4 address and a token', () => {
    const { roomsFrom } = require('../src/native/nearby/discovery') as typeof import('../src/native/nearby/discovery');
    const base = { fullName: '', host: '', addresses: [], ipv6: [] };
    const rooms = roomsFrom([
      { ...base, name: 'Mai 1a2b', port: 5000, ipv4: ['169.254.1.2', '192.168.1.20'], txt: { app: 'manganova', v: '1', k: '1a2b', n: 'Ink club' } },
      { ...base, name: 'printer', port: 631, ipv4: ['192.168.1.30'], txt: {} },
      { ...base, name: 'no ip', port: 5001, ipv4: [], txt: { app: 'manganova', k: 'ffff' } },
      { ...base, name: 'Ken ffff', port: 5002, ipv4: ['10.0.0.5'], txt: { app: 'manganova', k: 'ffff' } },
    ]);
    expect(rooms).toEqual([
      { host: '192.168.1.20', port: 5000, token: '1a2b', name: 'Ink club' },
      { host: '10.0.0.5', port: 5002, token: 'ffff', name: 'Ken ffff' },
    ]);
  });
});
