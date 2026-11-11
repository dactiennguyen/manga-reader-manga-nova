/**
 * Writing a chapter's script together. The host shares the chapter (scenes, lines and the cast), then
 * everyone edits the same copy live.
 *
 * Order: a guest sends each change to the host alone; the host hands it on to everyone, the sender
 * included, as `script.apply` with the author named. Every phone applies only those, through
 * `reduceScript`, in the host's order, so all copies stay the same without any merging. (A guest never
 * applies its own change early: two people grabbing the same line at once would otherwise each think
 * they had it.)
 *
 * Who types where: tapping a line or a scene heading claims it (`script.focus`). Only the person holding a
 * line can change its text; the others watch it change and see their name on it. The first claim the host
 * passes on wins, so two people never type into the same line. A claim ends on focusing elsewhere, on
 * leaving the room, or when the line is deleted.
 *
 * Saving: only the host's chapter changes, when the host saves; its old script is kept as a version.
 */
import type { BlockType, DialogueKind } from '../model/types';
import type { MemberId, Message } from './types';
import { utf8Encode } from './utf8';

/** The changes people make. Guests send them to the host; everyone applies them inside `script.apply`. */
export type ScriptOp = Extract<Message, { t: 'script.focus' | 'script.edit' | 'script.add' | 'script.set' | 'script.remove' | 'script.scene' }>;

export const SCRIPT_OPS: ReadonlySet<Message['t']> = new Set(['script.focus', 'script.edit', 'script.add', 'script.set', 'script.remove', 'script.scene']);

export function isScriptOp(message: Message): message is ScriptOp {
  return SCRIPT_OPS.has(message.t);
}

export const SCRIPT_TEXT_MAX = 2000;
export const SCRIPT_SCENES_MAX = 200;
export const SCRIPT_BLOCKS_MAX = 400;
export const SCRIPT_CAST_MAX = 100;
/** The shared chapter, in UTF-8 bytes, must fit one message line (MAX_LINE, 256 KiB) with room to spare. */
export const SCRIPT_DOC_BYTES_MAX = 200_000;
/** A typist's text goes out at most this often. */
export const SCRIPT_EDIT_EVERY_MS = 250;

export const BLOCK_TYPES: readonly BlockType[] = ['setting', 'action', 'dialogue', 'narration', 'sfx'];
export const DIALOGUE_KINDS: readonly DialogueKind[] = ['speak', 'think', 'shout', 'whisper'];

export type SharedBlock = { id: string; type: BlockType; text: string; characterId?: string; kind?: DialogueKind };
export type SharedScene = { id: string; description: string; blocks: SharedBlock[] };
export type SharedCharacter = { id: string; name: string };
export type ScriptDoc = { chapterId: string; title: string; characters: SharedCharacter[]; scenes: SharedScene[] };

/** What can be claimed: a line's text, or a scene's heading. */
export const blockKey = (id: string) => `b:${id}`;
export const sceneKey = (id: string) => `s:${id}`;

export type ScriptState = {
  doc: ScriptDoc | null;
  /** Changes applied since the doc arrived; a fresh doc carries the host's count. */
  rev: number;
  /** Who holds each line or heading. */
  locks: Record<string, MemberId>;
  /** The host saved and closed the session. */
  ended: boolean;
};

export const INITIAL_SCRIPT: ScriptState = { doc: null, rev: 0, locks: {}, ended: false };

/** Bytes on the wire, not characters: kanji and Thai take three bytes each. */
export function docBytes(doc: ScriptDoc): number {
  return utf8Encode(JSON.stringify(doc)).length;
}

/** Whether a change keeps the shared chapter small enough to send whole to someone joining late. */
export function fitsAfter(doc: ScriptDoc, docSize: number, op: ScriptOp): boolean {
  const added = op.t === 'script.edit' ? op.text : op.t === 'script.add' ? op.block.text + op.block.id : op.t === 'script.scene' ? op.sceneId : '';
  // Generous room for the JSON around the new text.
  return !added || docSize + utf8Encode(added).length + 200 <= SCRIPT_DOC_BYTES_MAX;
}

function findBlock(doc: ScriptDoc, id: string): { scene: SharedScene; index: number } | null {
  for (const scene of doc.scenes) {
    const index = scene.blocks.findIndex(block => block.id === id);
    if (index >= 0) {
      return { scene, index };
    }
  }
  return null;
}

function allIds(doc: ScriptDoc): Set<string> {
  const ids = new Set<string>();
  doc.scenes.forEach(scene => {
    ids.add(scene.id);
    scene.blocks.forEach(block => ids.add(block.id));
  });
  return ids;
}

/** A copy with one scene replaced, everything else shared. */
function withScene(doc: ScriptDoc, sceneId: string, change: (scene: SharedScene) => SharedScene): ScriptDoc {
  return { ...doc, scenes: doc.scenes.map(scene => (scene.id === sceneId ? change(scene) : scene)) };
}

function heldByOther(state: ScriptState, key: string, member: MemberId, present: readonly MemberId[]): boolean {
  const holder = state.locks[key];
  return !!holder && holder !== member && present.includes(holder);
}

function released(locks: Record<string, MemberId>, member: MemberId): Record<string, MemberId> {
  return Object.fromEntries(Object.entries(locks).filter(([, holder]) => holder !== member));
}

function cleanBlock(block: SharedBlock, cast: readonly SharedCharacter[]): SharedBlock {
  const out: SharedBlock = { id: block.id, type: block.type, text: block.text.slice(0, SCRIPT_TEXT_MAX) };
  if (block.type === 'dialogue') {
    if (block.characterId && cast.some(item => item.id === block.characterId)) {
      out.characterId = block.characterId;
    }
    out.kind = block.kind ?? 'speak';
  }
  return out;
}

export type ScriptContext = { host: MemberId | null; present: readonly MemberId[] };

/**
 * Every phone applies the session through this, in the host's order. `from` is the sender as the host
 * saw it. Anything that does not fit (a line someone else holds, an unknown id, a full scene) is ignored.
 */
export function reduceScript(state: ScriptState, message: Message, from: MemberId, context: ScriptContext): ScriptState {
  switch (message.t) {
    case 'script.doc':
      if (from !== context.host) {
        return state;
      }
      return { doc: message.doc, rev: message.rev, locks: message.locks, ended: false };
    case 'script.end':
      return from === context.host && state.doc ? { ...state, ended: true, locks: {} } : state;
    case 'script.apply':
      return from === context.host ? applyOp(state, message.op, message.by, context) : state;
    case 'bye': {
      const locks = released(state.locks, from);
      return Object.keys(locks).length === Object.keys(state.locks).length ? state : { ...state, locks };
    }
    default:
      // A bare change is a guest's request to the host; it counts only once the host applies it.
      return state;
  }
}

/** One change by `by`, already ordered by the host. */
export function applyOp(state: ScriptState, message: ScriptOp, from: MemberId, context: ScriptContext): ScriptState {
  const doc = state.doc;
  if (!doc || state.ended) {
    return state;
  }
  const next = (changed: ScriptDoc, locks = state.locks): ScriptState => ({ ...state, doc: changed, rev: state.rev + 1, locks });

  switch (message.t) {
    case 'script.focus': {
      const locks = released(state.locks, from);
      if (message.key === null) {
        return { ...state, locks };
      }
      const [kind, id] = [message.key.slice(0, 2), message.key.slice(2)];
      const exists = kind === 'b:' ? !!findBlock(doc, id) : kind === 's:' && doc.scenes.some(scene => scene.id === id);
      if (!exists || heldByOther(state, message.key, from, context.present)) {
        return { ...state, locks };
      }
      return { ...state, locks: { ...locks, [message.key]: from } };
    }
    case 'script.edit': {
      if (state.locks[message.key] !== from) {
        return state;
      }
      const text = message.text.slice(0, SCRIPT_TEXT_MAX);
      const id = message.key.slice(2);
      if (message.key.startsWith('s:')) {
        return doc.scenes.some(scene => scene.id === id) ? next(withScene(doc, id, scene => ({ ...scene, description: text }))) : state;
      }
      const found = findBlock(doc, id);
      if (!found || found.scene.blocks[found.index].text === text) {
        return state;
      }
      return next(withScene(doc, found.scene.id, scene => ({ ...scene, blocks: scene.blocks.map(block => (block.id === id ? { ...block, text } : block)) })));
    }
    case 'script.add': {
      const scene = doc.scenes.find(item => item.id === message.sceneId);
      if (!scene || scene.blocks.length >= SCRIPT_BLOCKS_MAX || allIds(doc).has(message.block.id)) {
        return state;
      }
      const at = message.afterId === null ? 0 : scene.blocks.findIndex(block => block.id === message.afterId) + 1;
      if (at === 0 && message.afterId !== null) {
        return state;
      }
      const blocks = scene.blocks.slice();
      blocks.splice(at, 0, cleanBlock(message.block, doc.characters));
      // The person who added a line is about to type in it.
      return next(withScene(doc, scene.id, item => ({ ...item, blocks })), { ...released(state.locks, from), [blockKey(message.block.id)]: from });
    }
    case 'script.set': {
      const found = findBlock(doc, message.blockId);
      if (!found || heldByOther(state, blockKey(message.blockId), from, context.present)) {
        return state;
      }
      const old = found.scene.blocks[found.index];
      const changed = cleanBlock({ ...old, type: message.type, characterId: message.characterId, kind: message.kind }, doc.characters);
      return next(withScene(doc, found.scene.id, scene => ({ ...scene, blocks: scene.blocks.map(block => (block.id === old.id ? changed : block)) })));
    }
    case 'script.remove': {
      const found = findBlock(doc, message.blockId);
      if (!found || heldByOther(state, blockKey(message.blockId), from, context.present)) {
        return state;
      }
      const locks = { ...state.locks };
      delete locks[blockKey(message.blockId)];
      return next(withScene(doc, found.scene.id, scene => ({ ...scene, blocks: scene.blocks.filter(block => block.id !== message.blockId) })), locks);
    }
    case 'script.scene': {
      if (doc.scenes.length >= SCRIPT_SCENES_MAX || allIds(doc).has(message.sceneId)) {
        return state;
      }
      const at = message.afterId === null ? doc.scenes.length : doc.scenes.findIndex(scene => scene.id === message.afterId) + 1;
      if (at === 0) {
        return state;
      }
      const scenes = doc.scenes.slice();
      scenes.splice(at, 0, { id: message.sceneId, description: '', blocks: [] });
      return next({ ...doc, scenes }, { ...released(state.locks, from), [sceneKey(message.sceneId)]: from });
    }
  }
}

/** Ids made on a phone: its member id and a counter, so two phones never make the same one. */
export function makeIdMaker(member: MemberId, start = Date.now()) {
  let n = start % 1_000_000;
  return () => `${member.slice(0, 12)}-${(n++).toString(36)}`;
}

/** The script as plain text, for copying or sharing: scene headings, then each line. */
export function scriptText(doc: ScriptDoc, labels: { scene: (index: number) => string; type: (type: BlockType) => string }): string {
  const nameOf = (id?: string) => doc.characters.find(item => item.id === id)?.name ?? '';
  return doc.scenes
    .map((scene, index) => {
      const head = [labels.scene(index + 1), scene.description.trim()].filter(Boolean).join(': ');
      const lines = scene.blocks
        .filter(block => block.text.trim())
        .map(block => (block.type === 'dialogue' ? `${nameOf(block.characterId) || labels.type('dialogue')}: ${block.text.trim()}` : `[${labels.type(block.type)}] ${block.text.trim()}`));
      return [head, ...lines].join('\n');
    })
    .join('\n\n');
}
