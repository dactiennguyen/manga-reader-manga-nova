/**
 * Playing together on the same Wi-Fi, with no server: one phone hosts a room, the others join it.
 * These are the shapes every part shares: the room, its members, and the messages sent between phones.
 * Messages are plain JSON, one per line on a TCP connection (see protocol.ts). Large payloads such as a
 * whole story or an image travel as numbered chunks of a `blob` and are put back together on arrival.
 */
import type { BlockType, Bubble, DialogueKind, ID, Stroke } from '../model/types';
import type { FillBubble, FillVersion } from './fill';
import type { ScriptDoc, ScriptOp, SharedBlock } from './scriptTogether';

/** Bumped when a message changes shape, so an older app can say "update to join" instead of breaking. */
export const PROTOCOL_VERSION = 3;

/** The Bonjour / NSD service type rooms are advertised under. Info.plist NSBonjourServices must match. */
export const SERVICE_TYPE = '_manganova._tcp';

export type MemberId = string;

export type Member = {
  id: MemberId;
  /** Pen name, or a friendly fallback like "Guest 2". */
  name: string;
  /** Index into a fixed set of ink colours, so each person's cursor and strokes are told apart. */
  color: number;
  host: boolean;
  /** A random key this person's phone keeps (safety.ts), so someone blocked stays blocked in later rooms. Set by the host. */
  key?: string;
};

export type Activity = 'lobby' | 'codraw' | 'relay' | 'battle' | 'guess' | 'fill' | 'script' | 'read' | 'dub' | 'send' | 'cards' | 'mangaka';

/** What a phone can see of a room before joining: from discovery, a QR code or a typed code. */
export type RoomAddress = {
  host: string;
  port: number;
  /** A short secret in the QR code / room code; the host refuses joins without it. */
  token: string;
  /** Shown in the list of nearby rooms. */
  name?: string;
};

/**
 * Who can join a hosted room. `open`: anyone on the same Wi-Fi, by tapping the room in their list (the
 * advert carries the token). `code`: the room is still listed, with a lock, but the advert leaves the
 * token out, so joining needs the room code or the QR code from the host's screen.
 */
export type JoinMode = 'open' | 'code';

/** A room in the list of rooms nearby. `token` is null for a code-only room: tapping it asks for the code. */
export type NearbyRoom = { host: string; port: number; token: string | null; name?: string };

export type RoomState = {
  roomId: string;
  name: string;
  members: Member[];
  activity: Activity;
  /** Activity-specific settings chosen by the host, e.g. the battle prompt and timer. */
  options: Record<string, unknown>;
};

/** A stroke drawn by someone in a shared page, in that panel's page units. */
export type RemoteStroke = { pageId: ID; panelId: ID; layerKey: string; stroke: Stroke };

export type Message =
  // Joining and leaving
  /** `rejoin` is the member id a guest had before a short Wi-Fi blip, so it keeps its colour and place. */
  | { t: 'hello'; v: number; token: string; name: string; app: string; rejoin?: MemberId; key?: string }
  | { t: 'welcome'; v: number; you: MemberId; room: RoomState }
  /** `removed`: the host took this person out of the room, or blocked them. Also sent mid-room, before the link closes. */
  | { t: 'refused'; reason: 'token' | 'version' | 'full' | 'started' | 'removed' }
  | { t: 'room'; room: RoomState }
  | { t: 'bye'; from: MemberId }
  /** `at` is the guest's clock when it pinged; the host echoes it with its own clock, for clock sync. */
  | { t: 'ping'; at?: number }
  | { t: 'pong'; at?: number; hostAt?: number }
  // Large payloads, in chunks: a story bundle, a page image, an audio clip, a card
  | { t: 'blob'; id: string; kind: 'story' | 'image' | 'audio' | 'card' | 'page'; index: number; count: number; data: string; meta?: Record<string, unknown> }
  // Activities: each activity owns the messages whose `t` starts with its name
  | { t: 'codraw.stroke'; from: MemberId; item: RemoteStroke }
  | { t: 'codraw.cursor'; from: MemberId; panelId: ID; x: number; y: number }
  | { t: 'codraw.react'; from: MemberId; emoji: string }
  | { t: 'codraw.end' }
  | { t: 'relay.turn'; member: MemberId; panelIndex: number; deadline: number }
  | { t: 'relay.done'; from: MemberId; panelIndex: number; blobId: string }
  | { t: 'relay.reveal' }
  | { t: 'battle.start'; prompt: string; seconds: number; startsAt: number }
  | { t: 'battle.submit'; from: MemberId; blobId: string }
  | { t: 'battle.vote'; from: MemberId; for: MemberId }
  | { t: 'battle.result'; scores: Record<MemberId, number> }
  // Guess the drawing (guess.ts). `turn` ties each message to one turn, so a late one cannot leak into the next.
  | { t: 'guess.start'; rounds: number; seconds: number; order: MemberId[] }
  | { t: 'guess.turn'; turn: number; drawer: MemberId; chooseUntil: number }
  /** Drawer to host only: a word is picked. The word itself stays on the drawer's phone. */
  | { t: 'guess.picked'; turn: number; mask: string }
  | { t: 'guess.draw'; turn: number; mask: string; endsAt: number }
  | { t: 'guess.ink'; turn: number; id: number; size: number; color: string; points: number[]; done: boolean }
  | { t: 'guess.undo'; turn: number }
  | { t: 'guess.clear'; turn: number }
  /** Guesser to drawer only. */
  | { t: 'guess.try'; turn: number; text: string }
  | { t: 'guess.hit'; turn: number; member: MemberId }
  | { t: 'guess.miss'; turn: number; member: MemberId; text: string }
  /** Drawer to one guesser: one letter off. */
  | { t: 'guess.close'; turn: number }
  /** `hits` is the host's list of right guessers, so every phone scores the same turn. */
  | { t: 'guess.end'; turn: number; hits: MemberId[] }
  | { t: 'guess.reveal'; turn: number; word: string }
  | { t: 'guess.over'; scores: Record<MemberId, number> }
  // Fill the bubbles (fill.ts). `turn` ties each message to one turn, so a late one cannot leak into the next.
  | { t: 'fill.start'; rounds: number; drawSeconds: number; writeSeconds: number; order: MemberId[] }
  | { t: 'fill.turn'; turn: number; artist: MemberId; endsAt: number }
  /** Artist to all: the panel's strokes, sent in pieces while drawing (shown to the others once it is done). */
  | { t: 'fill.ink'; turn: number; id: number; size: number; color: string; points: number[]; done: boolean }
  | { t: 'fill.undo'; turn: number }
  | { t: 'fill.clear'; turn: number }
  /** Artist to all: the panel is finished, with its empty bubbles. */
  | { t: 'fill.done'; turn: number; bubbles: FillBubble[] }
  | { t: 'fill.write'; turn: number; endsAt: number }
  /** Writer to host only: one line per bubble, under the version id the writer's phone picked. Sent again to change them. */
  | { t: 'fill.lines'; turn: number; id: string; lines: string[] }
  /** Host to all: this player has sent lines (never what they wrote). */
  | { t: 'fill.wrote'; turn: number; member: MemberId }
  /** Host to all: every version, shuffled, without names. `at` is when the reveal started, on the host's clock. */
  | { t: 'fill.reveal'; turn: number; versions: FillVersion[]; at: number }
  | { t: 'fill.ballot'; turn: number; endsAt: number }
  | { t: 'fill.vote'; turn: number; version: string }
  /** Host to all: who wrote which version, and the votes that count, so every phone scores the same turn. */
  | { t: 'fill.result'; turn: number; authors: { version: string; member: MemberId }[]; votes: { member: MemberId; version: string }[] }
  /** Host to all: no panel this turn (the artist left or their phone never sent it). */
  | { t: 'fill.skip'; turn: number }
  | { t: 'fill.over'; scores: Record<MemberId, number> }
  // Writing a script together (scriptTogether.ts). The host orders every change; `key` is a line (b:id) or a scene heading (s:id).
  | { t: 'script.doc'; doc: ScriptDoc; rev: number; locks: Record<string, MemberId> }
  /** Guest to host: send me the script again (joined late, or missed it). */
  | { t: 'script.want' }
  | { t: 'script.focus'; key: string | null }
  | { t: 'script.edit'; key: string; text: string }
  | { t: 'script.add'; sceneId: string; afterId: string | null; block: SharedBlock }
  | { t: 'script.set'; blockId: string; type: BlockType; characterId?: string; kind?: DialogueKind }
  | { t: 'script.remove'; blockId: string }
  | { t: 'script.scene'; sceneId: string; afterId: string | null }
  | { t: 'script.end' }
  /** Host to all: a change, by whom, in the one order every phone applies. */
  | { t: 'script.apply'; by: MemberId; op: ScriptOp }
  | { t: 'read.page'; projectId: ID; pageIndex: number }
  // Added by share: a guest who missed the story asks the host to send it again.
  | { t: 'read.want'; from: MemberId; projectId: ID }
  | {
      t: 'read.note';
      from: MemberId;
      pageId: ID;
      panelId: ID | null;
      x: number;
      y: number;
      sticker: string;
      text: string;
      /** Added by share: a note id, so the author's review list keeps each note once. */
      id?: string;
      /** Added by share: guests read a copy with remapped ids, so the page and panel also travel by position. */
      pageIndex?: number;
      panelIndex?: number;
    }
  | { t: 'dub.roles'; roles: Record<ID, MemberId> }
  | { t: 'dub.clip'; from: MemberId; bubbleId: ID; blobId: string; ms: number }
  | { t: 'cards.offer'; from: MemberId; blobId: string }
  | { t: 'send.offer'; from: MemberId; blobId: string; title: string; bytes: number }
  | { t: 'send.accept'; from: MemberId; blobId: string }
  // Added by share: the receiver declines, either side cancels, or the import fails; and the receiver confirms it.
  | { t: 'send.cancel'; from: MemberId; blobId: string; reason?: 'declined' | 'cancelled' | 'failed' | 'busy' }
  | { t: 'send.done'; from: MemberId; blobId: string }
  // Added by share: the receiver kept the offered card, so the giver can say so.
  | { t: 'cards.keep'; from: MemberId; blobId: string };

export type MessageType = Message['t'];

/** A bubble the dubbing activity records, with who voices it. */
export type DubLine = { bubbleId: ID; pageId: ID; text: Bubble['text']; characterId?: ID };

/**
 * What actually travels on a line: the message plus routing. `to` asks the host to deliver to one member
 * only; `from` is set by the host when it relays (a guest's own claim is never trusted).
 */
export type Envelope = { m: Message; from?: MemberId; to?: MemberId };

/** A blob put back together from its chunks. */
export type RoomBlob = {
  id: string;
  kind: Extract<Message, { t: 'blob' }>['kind'];
  data: string;
  meta?: Record<string, unknown>;
  from: MemberId;
};

export type BlobProgress = { id: string; from: MemberId; done: number; count: number; direction: 'in' | 'out' };
