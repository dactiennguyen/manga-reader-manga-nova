/**
 * The shape of every message a phone accepts. Anything from the network is checked here before the app
 * sees it: unknown types, wrong fields and oversized strings are dropped, never guessed at.
 */
import { z } from 'zod';

import { GUESS_TEXT_MAX, INK_POINTS_MAX } from './guess';
import { SCRIPT_BLOCKS_MAX, SCRIPT_CAST_MAX, SCRIPT_SCENES_MAX, SCRIPT_TEXT_MAX } from './scriptTogether';
import type { Envelope, Message } from './types';

/** Base64 per blob chunk. Kept well below MAX_LINE so a chunk plus its envelope always fits one line. */
export const CHUNK_CHARS = 48 * 1024;

const id = z.string().min(1).max(80);
const name = z.string().max(60);
const num = z.number().finite();
const member = z.object({ id, name, color: z.number().int().min(0).max(63), host: z.boolean() });
const activity = z.enum(['lobby', 'codraw', 'relay', 'battle', 'guess', 'script', 'read', 'dub', 'send', 'cards', 'mangaka']);
const meta = z.record(z.string().max(80), z.unknown()).optional();
const turn = z.number().int().min(0).max(1000);
const blockType = z.enum(['setting', 'action', 'dialogue', 'narration', 'sfx']);
const dialogueKind = z.enum(['speak', 'think', 'shout', 'whisper']);
const scriptKey = z.string().regex(/^[bs]:.{1,80}$/);
const sharedBlock = z.object({ id, type: blockType, text: z.string().max(SCRIPT_TEXT_MAX), characterId: id.optional(), kind: dialogueKind.optional() });
const scriptDoc = z.object({
  chapterId: id,
  title: z.string().max(200),
  characters: z.array(z.object({ id, name: z.string().max(80) })).max(SCRIPT_CAST_MAX),
  scenes: z.array(z.object({ id, description: z.string().max(SCRIPT_TEXT_MAX), blocks: z.array(sharedBlock).max(SCRIPT_BLOCKS_MAX) })).max(SCRIPT_SCENES_MAX),
});

const room = z.object({
  roomId: id,
  name,
  members: z.array(member).max(16),
  activity,
  options: z.record(z.string().max(80), z.unknown()),
});

const stroke = z.object({
  tool: z.enum(['gpen', 'pencil', 'brush', 'eraser', 'line', 'rect', 'ellipse', 'fill']),
  color: z.string().max(32),
  size: num,
  opacity: num,
  points: z.array(num).max(60000),
  pressure: z.boolean().optional(),
  tone: z.object({ density: num }).optional(),
});

const remoteStroke = z.object({ pageId: id, panelId: id, layerKey: z.string().max(80), stroke });

const scriptOps = [
  z.object({ t: z.literal('script.focus'), key: scriptKey.nullable() }),
  z.object({ t: z.literal('script.edit'), key: scriptKey, text: z.string().max(SCRIPT_TEXT_MAX) }),
  z.object({ t: z.literal('script.add'), sceneId: id, afterId: id.nullable(), block: sharedBlock }),
  z.object({ t: z.literal('script.set'), blockId: id, type: blockType, characterId: id.optional(), kind: dialogueKind.optional() }),
  z.object({ t: z.literal('script.remove'), blockId: id }),
  z.object({ t: z.literal('script.scene'), sceneId: id, afterId: id.nullable() }),
] as const;

const message = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), v: num, token: z.string().max(32), name, app: z.string().max(40), rejoin: id.optional() }),
  z.object({ t: z.literal('welcome'), v: num, you: id, room }),
  z.object({ t: z.literal('refused'), reason: z.enum(['token', 'version', 'full', 'started']) }),
  z.object({ t: z.literal('room'), room }),
  z.object({ t: z.literal('bye'), from: id }),
  z.object({ t: z.literal('ping'), at: num.optional() }),
  z.object({ t: z.literal('pong'), at: num.optional(), hostAt: num.optional() }),
  z.object({
    t: z.literal('blob'),
    id,
    kind: z.enum(['story', 'image', 'audio', 'card', 'page']),
    index: z.number().int().min(0),
    count: z.number().int().min(1).max(4096),
    data: z.string().max(CHUNK_CHARS).regex(/^[A-Za-z0-9+/=]*$/),
    meta,
  }),
  z.object({ t: z.literal('codraw.stroke'), from: id, item: remoteStroke }),
  z.object({ t: z.literal('codraw.cursor'), from: id, panelId: id, x: num, y: num }),
  z.object({ t: z.literal('codraw.react'), from: id, emoji: z.string().max(16) }),
  z.object({ t: z.literal('codraw.end') }),
  z.object({ t: z.literal('relay.turn'), member: id, panelIndex: z.number().int().min(0), deadline: num }),
  z.object({ t: z.literal('relay.done'), from: id, panelIndex: z.number().int().min(0), blobId: id }),
  z.object({ t: z.literal('relay.reveal') }),
  z.object({ t: z.literal('battle.start'), prompt: z.string().max(200), seconds: num, startsAt: num }),
  z.object({ t: z.literal('battle.submit'), from: id, blobId: id }),
  z.object({ t: z.literal('battle.vote'), from: id, for: id }),
  z.object({ t: z.literal('battle.result'), scores: z.record(id, num) }),
  z.object({ t: z.literal('guess.start'), rounds: z.number().int().min(1).max(5), seconds: z.number().int().min(20).max(300), order: z.array(id).max(16) }),
  z.object({ t: z.literal('guess.turn'), turn, drawer: id, chooseUntil: num }),
  z.object({ t: z.literal('guess.picked'), turn, mask: z.string().max(GUESS_TEXT_MAX) }),
  z.object({ t: z.literal('guess.draw'), turn, mask: z.string().max(GUESS_TEXT_MAX), endsAt: num }),
  z.object({
    t: z.literal('guess.ink'),
    turn,
    id: z.number().int().min(0),
    size: num,
    color: z.string().max(32),
    points: z.array(num).max(INK_POINTS_MAX),
    done: z.boolean(),
  }),
  z.object({ t: z.literal('guess.undo'), turn }),
  z.object({ t: z.literal('guess.clear'), turn }),
  z.object({ t: z.literal('guess.try'), turn, text: z.string().max(GUESS_TEXT_MAX) }),
  z.object({ t: z.literal('guess.hit'), turn, member: id }),
  z.object({ t: z.literal('guess.miss'), turn, member: id, text: z.string().max(GUESS_TEXT_MAX) }),
  z.object({ t: z.literal('guess.close'), turn }),
  z.object({ t: z.literal('guess.end'), turn, hits: z.array(id).max(16) }),
  z.object({ t: z.literal('guess.reveal'), turn, word: z.string().max(GUESS_TEXT_MAX) }),
  z.object({ t: z.literal('guess.over'), scores: z.record(id, num) }),
  z.object({ t: z.literal('script.doc'), doc: scriptDoc, rev: z.number().int().min(0), locks: z.record(scriptKey, id) }),
  z.object({ t: z.literal('script.want') }),
  ...scriptOps,
  z.object({ t: z.literal('script.end') }),
  z.object({ t: z.literal('script.apply'), by: id, op: z.discriminatedUnion('t', scriptOps) }),
  z.object({ t: z.literal('read.page'), projectId: id, pageIndex: z.number().int().min(0) }),
  z.object({ t: z.literal('read.want'), from: id, projectId: id }),
  z.object({
    t: z.literal('read.note'),
    from: id,
    pageId: id,
    panelId: id.nullable(),
    x: num,
    y: num,
    sticker: z.string().max(32),
    text: z.string().max(500),
    id: id.optional(),
    pageIndex: z.number().int().min(0).optional(),
    panelIndex: z.number().int().min(0).optional(),
  }),
  z.object({ t: z.literal('dub.roles'), roles: z.record(id, id) }),
  z.object({ t: z.literal('dub.clip'), from: id, bubbleId: id, blobId: id, ms: num }),
  z.object({ t: z.literal('cards.offer'), from: id, blobId: id }),
  z.object({ t: z.literal('send.offer'), from: id, blobId: id, title: z.string().max(200), bytes: num }),
  z.object({ t: z.literal('send.accept'), from: id, blobId: id }),
  z.object({ t: z.literal('send.cancel'), from: id, blobId: id, reason: z.enum(['declined', 'cancelled', 'failed', 'busy']).optional() }),
  z.object({ t: z.literal('send.done'), from: id, blobId: id }),
  z.object({ t: z.literal('cards.keep'), from: id, blobId: id }),
]);

/**
 * Fails to compile when types.ts gains a message, or a required field, that this schema does not check.
 * Fields not listed here are stripped on arrival, so a new field (optional ones too) goes on both sides.
 */
type Checked = z.infer<typeof message>;
type SchemaMatchesTypes = Checked extends Message ? ([Exclude<Message['t'], Checked['t']>] extends [never] ? true : never) : never;
export const SCHEMA_MATCHES_TYPES: SchemaMatchesTypes = true;

const envelope = z.object({ m: message, from: id.optional(), to: id.optional() });

const KNOWN = new Set(message.options.map(option => option.shape.t.value as string));

export type ParseResult = { ok: true; envelope: Envelope } | { ok: false; reason: 'json' | 'unknown' | 'shape' };

/** Reads one line. Unknown message types are reported apart so a newer phone's extras are just skipped. */
export function parseEnvelope(line: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return { ok: false, reason: 'json' };
  }
  const type = (raw as { m?: { t?: unknown } } | null)?.m?.t;
  if (typeof type !== 'string' || !KNOWN.has(type)) {
    return { ok: false, reason: 'unknown' };
  }
  const result = envelope.safeParse(raw);
  return result.success ? { ok: true, envelope: result.data as Envelope } : { ok: false, reason: 'shape' };
}
