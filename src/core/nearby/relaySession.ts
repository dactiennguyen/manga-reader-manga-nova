/**
 * A relay running on one phone: follows the room's relay messages, keeps the panel pictures that arrive,
 * and on the host also drives the turns (next drawer, skip someone who left or ran out of time).
 */
import { realClock, type Clock } from './transport';
import type { RoomStoreState } from './room';
import {
  INITIAL_RELAY,
  RELAY_GRACE_MS,
  firstRelayStep,
  nextRelayStep,
  readRelaySetup,
  reassignRelayTurn,
  reduceRelay,
  relayOptions,
  type RelaySetup,
  type RelayState,
} from './relay';
import type { MemberId, Message, RoomBlob } from './types';

export type RoomHandle = { getState(): RoomStoreState };

/** A panel picture is a small JPEG; anything far bigger is not one of ours. */
export const MAX_IMAGE_CHARS = 3_000_000;

export type RelaySnapshot = {
  state: RelayState;
  /** Panel pictures by blob id, as base64 JPEG. */
  images: Record<string, string>;
  /** When the current turn ends, on this phone's clock. */
  deadline: number | null;
};

export class RelaySession {
  private snapshot: RelaySnapshot = { state: INITIAL_RELAY, images: {}, deadline: null };
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  private grace: unknown = null;

  constructor(private readonly room: RoomHandle, private readonly clock: Clock = realClock) {}

  start(): this {
    const api = this.room.getState();
    this.offs.push(
      api.onMessage('*', (message, from) => this.onMessage(message, from)),
      api.onBlob(blob => this.onBlob(blob)),
    );
    return this;
  }

  stop(): void {
    this.offs.forEach(off => off());
    this.offs = [];
    this.clearGrace();
  }

  /** Forgets the last relay, e.g. when the room moves on to another activity. */
  reset(): void {
    this.clearGrace();
    this.update({ state: INITIAL_RELAY, images: {}, deadline: null });
  }

  getSnapshot = (): RelaySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Host: saves the setup in the room and starts the first turn. */
  begin(setup: RelaySetup): void {
    const api = this.room.getState();
    if (!api.me?.host) {
      return;
    }
    this.update({ state: INITIAL_RELAY, images: {}, deadline: null });
    api.setActivity('relay', relayOptions(setup));
    api.send(firstRelayStep(setup, this.present(), this.clock.now()));
  }

  /** The drawer: sends the panel picture first, so it is there before anyone hears the panel is done. */
  async submit(panelIndex: number, jpegBase64: string): Promise<void> {
    const api = this.room.getState();
    const blobId = await api.sendBlob('image', jpegBase64, { relay: panelIndex });
    api.send({ t: 'relay.done', from: api.me?.id ?? '', panelIndex, blobId });
  }

  /** Host: reveal now, whatever is left. */
  reveal(): void {
    if (this.room.getState().me?.host) {
      this.room.getState().send({ t: 'relay.reveal' });
    }
  }

  private setup(): RelaySetup | null {
    return readRelaySetup(this.room.getState().room?.options);
  }

  private present(): MemberId[] {
    return this.room.getState().room?.members.map(member => member.id) ?? [];
  }

  private update(next: Partial<RelaySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener());
  }

  private clearGrace(): void {
    if (this.grace !== null) {
      this.clock.clearTimeout(this.grace);
      this.grace = null;
    }
  }

  private onBlob(blob: RoomBlob): void {
    if (blob.kind !== 'image' || typeof blob.meta?.relay !== 'number' || blob.data.length > MAX_IMAGE_CHARS) {
      return;
    }
    this.update({ images: { ...this.snapshot.images, [blob.id]: blob.data } });
  }

  private onMessage(message: Message, from: MemberId): void {
    const before = this.snapshot.state;
    const state = reduceRelay(before, message, from);
    if (state !== before) {
      const setup = this.setup();
      const deadline =
        message.t === 'relay.turn'
          ? // The host's clock may differ from ours; the length of a turn does not.
            this.clock.now() + (setup?.seconds ?? 0) * 1000
          : message.t === 'relay.reveal'
          ? null
          : this.snapshot.deadline;
      this.update({ state, deadline });
    }
    if (this.room.getState().me?.host) {
      // After the host has passed this message on, so every phone hears "done" before the next turn.
      Promise.resolve().then(() => this.drive(message, from, before, state));
    }
  }

  /** Host only: decides what comes next. */
  private drive(message: Message, from: MemberId, before: RelayState, state: RelayState): void {
    const setup = this.setup();
    if (!setup) {
      return;
    }
    const api = this.room.getState();
    const turn = state.turn;
    if (message.t === 'relay.turn' && turn) {
      this.clearGrace();
      this.grace = this.clock.setTimeout(() => {
        this.grace = null;
        const current = this.snapshot.state.turn;
        if (current && current.panelIndex === turn.panelIndex && !this.snapshot.state.done[turn.panelIndex]) {
          api.send(nextRelayStep(setup, turn.panelIndex, this.present(), this.clock.now()));
        }
      }, setup.seconds * 1000 + RELAY_GRACE_MS);
    } else if (message.t === 'relay.done' && state !== before) {
      this.clearGrace();
      api.send(nextRelayStep(setup, message.panelIndex, this.present(), this.clock.now()));
    } else if (message.t === 'bye' && turn && turn.member === from && !state.done[turn.panelIndex]) {
      this.clearGrace();
      const present = this.present().filter(id => id !== from);
      api.send(reassignRelayTurn(setup, turn.panelIndex, present, this.clock.now()));
    } else if (message.t === 'relay.reveal') {
      this.clearGrace();
    }
  }
}
