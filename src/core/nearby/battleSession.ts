/**
 * A speed battle running on one phone: follows the battle messages, keeps the drawings that arrive, and
 * on the host closes the vote (everyone voted, or time is up) and sends the scores.
 */
import {
  INITIAL_BATTLE,
  SUBMIT_GRACE_MS,
  VOTE_MS,
  battlePhase,
  canVoteFor,
  reduceBattle,
  startMessage,
  tally,
  votingDone,
  type BattleState,
} from './battle';
import type { RoomHandle } from './relaySession';
import { MAX_IMAGE_CHARS } from './relaySession';
import { realClock, type Clock } from './transport';
import type { MemberId, Message, RoomBlob } from './types';

export type BattleSnapshot = {
  state: BattleState;
  /** Drawings by blob id, as base64 JPEG. */
  images: Record<string, string>;
};

export class BattleSession {
  private snapshot: BattleSnapshot = { state: INITIAL_BATTLE, images: {} };
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  private timers: unknown[] = [];

  /** `offset` is the host's clock minus ours when the room knows it from a ping round trip. */
  constructor(
    private readonly room: RoomHandle,
    private readonly clock: Clock = realClock,
    private readonly offset: () => number | undefined = () => undefined,
  ) {}

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
    this.clearTimers();
  }

  /** Forgets the last battle, e.g. when the room moves on to another activity. */
  reset(): void {
    this.clearTimers();
    this.update({ state: INITIAL_BATTLE, images: {} });
  }

  getSnapshot = (): BattleSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Host: everyone starts at the same moment, a few seconds from now. */
  begin(prompt: string, minutes: number): void {
    const api = this.room.getState();
    if (!api.me?.host) {
      return;
    }
    api.setActivity('battle', { prompt, minutes });
    api.send(startMessage(prompt, minutes, this.clock.now()));
  }

  async submit(jpegBase64: string): Promise<void> {
    const api = this.room.getState();
    const blobId = await api.sendBlob('image', jpegBase64, { battle: true });
    api.send({ t: 'battle.submit', from: api.me?.id ?? '', blobId });
  }

  vote(target: MemberId): boolean {
    const api = this.room.getState();
    const me = api.me?.id;
    if (!me || !canVoteFor(this.snapshot.state, me, target)) {
      return false;
    }
    api.send({ t: 'battle.vote', from: me, for: target });
    return true;
  }

  private update(next: Partial<BattleSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener());
  }

  private clearTimers(): void {
    this.timers.forEach(timer => this.clock.clearTimeout(timer));
    this.timers = [];
  }

  private onBlob(blob: RoomBlob): void {
    if (blob.kind !== 'image' || blob.meta?.battle !== true || blob.data.length > MAX_IMAGE_CHARS) {
      return;
    }
    this.update({ images: { ...this.snapshot.images, [blob.id]: blob.data } });
  }

  private onMessage(message: Message, from: MemberId): void {
    const api = this.room.getState();
    const before = this.snapshot.state;
    const state = reduceBattle(before, message, from, {
      receivedAt: this.clock.now(),
      offset: this.offset(),
      members: api.room?.members.map(member => member.id) ?? [],
    });
    if (state === before) {
      return;
    }
    this.update({ state });
    if (!api.me?.host || state.scores) {
      if (state.scores) {
        this.clearTimers();
      }
      return;
    }
    if (message.t === 'battle.start') {
      this.clearTimers();
      const now = this.clock.now();
      const votingAt = state.endsAt + SUBMIT_GRACE_MS - now;
      // Once voting opens for sure, and once more when it must close.
      this.timers.push(
        this.clock.setTimeout(() => this.closeIfDone(), votingAt + 50),
        this.clock.setTimeout(() => this.close(), votingAt + VOTE_MS),
      );
      return;
    }
    // After the host has passed the vote on, so every phone has it before the scores.
    Promise.resolve().then(() => this.closeIfDone());
  }

  private closeIfDone(): void {
    const state = this.snapshot.state;
    if (battlePhase(state, this.clock.now()) === 'voting' && votingDone(state)) {
      this.close();
    }
  }

  private close(): void {
    const state = this.snapshot.state;
    if (!state.started || state.scores) {
      return;
    }
    this.room.getState().send({ t: 'battle.result', scores: tally(state) });
  }
}
