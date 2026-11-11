/**
 * Writing a script together, on one phone. Everyone follows the shared copy (scriptTogether.ts). The host
 * also orders the changes: a guest's change arrives addressed to the host, and the host hands it on to the
 * whole room as `script.apply`. The host sends the copy to anyone who joins late or asks for it.
 */
import type { RoomStoreState } from './room';
import {
  INITIAL_SCRIPT,
  SCRIPT_EDIT_EVERY_MS,
  blockKey,
  docBytes,
  fitsAfter,
  isScriptOp,
  makeIdMaker,
  reduceScript,
  sceneKey,
  type ScriptDoc,
  type ScriptOp,
  type ScriptState,
} from './scriptTogether';
import type { MemberId, Message } from './types';
import type { BlockType, DialogueKind } from '../model/types';

/** The room store, as much of it as this needs (core stays free of zustand itself). */
type RoomStore = { getState(): RoomStoreState; subscribe(listener: (state: RoomStoreState) => void): () => void };

export type ScriptSnapshot = { state: ScriptState };

const EMPTY: ScriptSnapshot = { state: INITIAL_SCRIPT };

export class ScriptSession {
  private snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  private known = new Set<MemberId>();
  private nextId: (() => string) | null = null;
  /** Typed text not sent yet: it goes out a few times a second, and always before any other change. */
  private pending: { key: string; text: string } | null = null;
  private editTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting = false;
  /** The host's copy size, measured once per change. */
  private sized = { rev: -1, bytes: 0 };

  constructor(
    private readonly room: RoomStore,
    private readonly editEveryMs = SCRIPT_EDIT_EVERY_MS,
  ) {}

  start(): this {
    const api = this.room.getState();
    this.offs.push(
      api.onMessage('*', (message, from) => this.onMessage(message, from)),
      this.room.subscribe(state => this.onRoom(state)),
    );
    return this;
  }

  stop(): void {
    this.dropPending();
    this.offs.forEach(off => off());
    this.offs = [];
  }

  reset(): void {
    this.dropPending();
    this.known.clear();
    this.update({ state: INITIAL_SCRIPT });
  }

  getSnapshot = (): ScriptSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // ------------------------------------------------------------ actions

  /** Host: opens the session with this chapter's script. */
  share(doc: ScriptDoc): void {
    const api = this.room.getState();
    if (!api.me?.host) {
      return;
    }
    this.known = new Set(api.room?.members.map(member => member.id));
    api.setActivity('script', { chapterId: doc.chapterId });
    api.send({ t: 'script.doc', doc, rev: 0, locks: {} });
  }

  /** Guest: asks the host for the script, e.g. on opening the screen after it was shared. */
  want(): void {
    const api = this.room.getState();
    const host = this.hostId();
    if (!api.me?.host && host) {
      api.send({ t: 'script.want' }, host);
    }
  }

  focus(key: string | null): void {
    this.flushEdit();
    if (key !== this.heldKey()) {
      this.change({ t: 'script.focus', key });
    }
  }

  /** Typing in the held line or heading. Sent a few times a second; `flushEdit` sends the rest at once. */
  edit(key: string, text: string): void {
    if (this.pending && this.pending.key !== key) {
      this.flushEdit();
    }
    this.pending = { key, text };
    if (!this.editTimer) {
      this.editTimer = setTimeout(() => this.flushEdit(), this.editEveryMs);
    }
  }

  /** Sends typed text still waiting. Every other change calls this first, while the line is still held. */
  flushEdit(): void {
    if (this.editTimer) {
      clearTimeout(this.editTimer);
      this.editTimer = null;
    }
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      this.change({ t: 'script.edit', key: pending.key, text: pending.text });
    }
  }

  /** Adds a line after `afterId` (null: at the top of the scene) and returns its id; the adder holds it. */
  addLine(sceneId: string, afterId: string | null, type: BlockType, characterId?: string): string {
    this.flushEdit();
    const id = this.makeId();
    this.change({ t: 'script.add', sceneId, afterId, block: { id, type, text: '', characterId } });
    return id;
  }

  setLine(blockId: string, type: BlockType, characterId?: string, kind?: DialogueKind): void {
    this.flushEdit();
    this.change({ t: 'script.set', blockId, type, characterId, kind });
  }

  removeLine(blockId: string): void {
    this.flushEdit();
    this.change({ t: 'script.remove', blockId });
  }

  /** Adds an empty scene after `afterId` (null: at the end) and returns its id; the adder holds its heading. */
  addScene(afterId: string | null): string {
    this.flushEdit();
    const id = this.makeId();
    this.change({ t: 'script.scene', sceneId: id, afterId });
    return id;
  }

  /** Host: closes the session once the script is saved. */
  end(): void {
    this.flushEdit();
    const api = this.room.getState();
    if (api.me?.host) {
      api.send({ t: 'script.end' });
    }
  }

  /** The line or heading this phone holds, if any. */
  heldKey(): string | null {
    const me = this.room.getState().me?.id;
    const found = Object.entries(this.snapshot.state.locks).find(([, holder]) => holder === me);
    return found ? found[0] : null;
  }

  // ------------------------------------------------------------ internals

  private dropPending(): void {
    if (this.editTimer) {
      clearTimeout(this.editTimer);
      this.editTimer = null;
    }
    this.pending = null;
  }

  /** Host: a change is passed on only while the chapter stays small enough to send whole. */
  private fits(op: ScriptOp): boolean {
    const { doc, rev } = this.snapshot.state;
    if (!doc) {
      return false;
    }
    if (this.sized.rev !== rev) {
      this.sized = { rev, bytes: docBytes(doc) };
    }
    return fitsAfter(doc, this.sized.bytes, op);
  }

  private makeId(): string {
    if (!this.nextId) {
      this.nextId = makeIdMaker(this.room.getState().me?.id ?? 'me');
    }
    return this.nextId();
  }

  /** The host applies its own change for everyone at once; a guest asks the host to. */
  private change(op: ScriptOp): void {
    const api = this.room.getState();
    const me = api.me?.id;
    if (!me || !this.snapshot.state.doc || this.snapshot.state.ended) {
      return;
    }
    if (api.me?.host) {
      if (this.fits(op)) {
        api.send({ t: 'script.apply', by: me, op });
      }
    } else {
      const host = this.hostId();
      if (host) {
        api.send(op, host);
      }
    }
  }

  private update(next: Partial<ScriptSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener());
  }

  private hostId(): MemberId | undefined {
    return this.room.getState().room?.members.find(member => member.host)?.id;
  }

  private sendCopy(to: MemberId): void {
    const { state } = this.snapshot;
    if (state.doc && !state.ended) {
      this.room.getState().send({ t: 'script.doc', doc: state.doc, rev: state.rev, locks: state.locks }, to);
    }
  }

  private onRoom(state: RoomStoreState): void {
    // A guest back from a Wi-Fi blink missed changes while away: it asks for the whole copy again.
    const wasAway = this.reconnecting;
    this.reconnecting = state.reconnecting;
    if (!state.me?.host) {
      if (wasAway && !state.reconnecting && state.status === 'joined' && state.room?.activity === 'script' && this.snapshot.state.doc) {
        this.want();
      }
      return;
    }
    if (state.room?.activity !== 'script') {
      return;
    }
    const present = state.room.members.map(member => member.id);
    present.filter(id => !this.known.has(id) && id !== state.me?.id).forEach(id => this.sendCopy(id));
    this.known = new Set(present);
  }

  private onMessage(message: Message, from: MemberId): void {
    if (!message.t.startsWith('script.') && message.t !== 'bye') {
      return;
    }
    const api = this.room.getState();
    if (api.me?.host) {
      if (message.t === 'script.want') {
        this.sendCopy(from);
        return;
      }
      if (isScriptOp(message)) {
        // A guest's change: put it in the room's one order.
        if (from !== api.me.id && this.fits(message)) {
          api.send({ t: 'script.apply', by: from, op: message });
        }
        return;
      }
    }
    const before = this.snapshot.state;
    const state = reduceScript(before, message, from, {
      host: this.hostId() ?? null,
      present: api.room?.members.map(member => member.id) ?? [],
    });
    if (state !== before) {
      this.update({ state });
    }
  }
}

export { blockKey, sceneKey };
