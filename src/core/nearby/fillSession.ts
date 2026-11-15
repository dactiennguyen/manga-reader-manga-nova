/**
 * Fill the bubbles, running on one phone. Every phone follows the game (fill.ts). On top of that: the
 * host runs the clock and keeps the lines sent to it until the reveal; the artist's phone keeps the
 * bubbles being placed and sends the panel when time is up; each writer's phone keeps the lines being
 * typed, sends them when time is up, and knows which version is its own.
 */
import { uid } from '../util/id';
import {
  DONE_GRACE_MS,
  FILL_BUBBLES_MAX,
  INITIAL_FILL,
  LINES_GRACE_MS,
  RESULT_MS,
  SHOW_MS,
  SKIP_MS,
  VOTE_MS,
  cleanBubble,
  cleanBubbles,
  cleanLines,
  everyoneVoted,
  everyoneWrote,
  hasWords,
  placeBubble,
  reduceFill,
  votersOf,
  writersOf,
  type BubbleKind,
  type FillBubble,
  type FillState,
  type FillVersion,
} from './fill';
import { nextTurn } from './guess';
import type { RoomHandle } from './relaySession';
import { realClock, type Clock } from './transport';
import type { MemberId, Message } from './types';

export type FillSnapshot = {
  state: FillState;
  /** On the artist's phone while drawing: the bubbles placed so far, not sent yet. */
  layout: FillBubble[];
  /** On a writer's phone: the lines being typed, one per bubble. */
  draft: string[];
  /** The lines this phone last sent this turn, or null. */
  sent: string[] | null;
  /** This phone's version id this turn: the version it may not vote for. */
  mine: string | null;
};

const EMPTY: FillSnapshot = { state: INITIAL_FILL, layout: [], draft: [], sent: null, mine: null };

export type FillDeps = { clock?: Clock; newId?: () => string; random?: () => number };

export class FillSession {
  private snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  /** Host timers for the current turn, and this phone's own send-when-time-is-up. */
  private timers: unknown[] = [];
  /** Host only: the lines sent to it this turn, by writer. */
  private entries = new Map<MemberId, FillVersion>();
  /** Host only: version id to author, from the reveal on. */
  private authors: Record<string, MemberId> = {};
  private readonly clock: Clock;
  private readonly newId: () => string;
  private readonly random: () => number;

  constructor(
    private readonly room: RoomHandle,
    deps: FillDeps = {},
  ) {
    this.clock = deps.clock ?? realClock;
    this.newId = deps.newId ?? uid;
    this.random = deps.random ?? Math.random;
  }

  start(): this {
    this.offs.push(this.room.getState().onMessage('*', (message, from) => this.onMessage(message, from)));
    return this;
  }

  stop(): void {
    this.offs.forEach(off => off());
    this.offs = [];
    this.clearTimers();
  }

  reset(): void {
    this.clearTimers();
    this.entries.clear();
    this.authors = {};
    this.update(EMPTY);
  }

  getSnapshot = (): FillSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // ------------------------------------------------------------ actions

  /** Host: starts a game with everyone in the room, in the order they joined. */
  begin(rounds: number, drawSeconds: number, writeSeconds: number): void {
    const api = this.room.getState();
    if (!api.me?.host || !api.room) {
      return;
    }
    api.setActivity('fill', { rounds, drawSeconds, writeSeconds });
    api.send({ t: 'fill.start', rounds, drawSeconds, writeSeconds, order: api.room.members.map(member => member.id) });
    this.nextTurn();
  }

  /** Artist: part of a stroke. Points are whole board units, x then y. */
  ink(id: number, points: number[], size: number, color: string, done: boolean): void {
    if (this.drawing()) {
      this.room.getState().send({ t: 'fill.ink', turn: this.snapshot.state.turn, id, size, color, points: points.map(Math.round), done });
    }
  }

  undo(): void {
    if (this.drawing()) {
      this.room.getState().send({ t: 'fill.undo', turn: this.snapshot.state.turn });
    }
  }

  clear(): void {
    if (this.drawing()) {
      this.room.getState().send({ t: 'fill.clear', turn: this.snapshot.state.turn });
    }
  }

  /** Artist: a new empty bubble. Its index, or -1 when there are already enough. */
  addBubble(kind: BubbleKind): number {
    const { layout } = this.snapshot;
    if (!this.drawing() || layout.length >= FILL_BUBBLES_MAX) {
      return -1;
    }
    this.update({ layout: [...layout, placeBubble(kind, layout.length)] });
    return layout.length;
  }

  /** Artist: a bubble moved, resized or changed shape. Stays on this phone until the panel is sent. */
  setBubble(index: number, bubble: FillBubble): void {
    const { layout } = this.snapshot;
    if (!this.drawing() || !layout[index]) {
      return;
    }
    const next = layout.slice();
    next[index] = cleanBubble(bubble);
    this.update({ layout: next });
  }

  removeBubble(index: number): void {
    if (this.drawing()) {
      this.update({ layout: this.snapshot.layout.filter((_, at) => at !== index) });
    }
  }

  /** Artist: the panel is done. With no bubble placed, one goes on so the others have something to fill. */
  finish(): void {
    if (!this.drawing()) {
      return;
    }
    const layout = this.snapshot.layout.length ? cleanBubbles(this.snapshot.layout) : [placeBubble('speak', 0)];
    this.update({ layout });
    this.room.getState().send({ t: 'fill.done', turn: this.snapshot.state.turn, bubbles: layout });
  }

  /** Writer: the line typed for one bubble so far. */
  setLine(index: number, text: string): void {
    const { state, draft } = this.snapshot;
    if (!this.writing() || index < 0 || index >= state.bubbles.length) {
      return;
    }
    const next = Array.from({ length: state.bubbles.length }, (_, at) => draft[at] ?? '');
    next[index] = text;
    this.update({ draft: next });
  }

  /** Writer: sends the lines to the host (again, to change them). False when there is nothing to send. */
  submit(): boolean {
    const { state, draft, mine } = this.snapshot;
    const lines = cleanLines(draft, state.bubbles.length);
    const host = this.hostId();
    if (!this.writing() || !mine || !host || !hasWords(lines)) {
      return false;
    }
    this.update({ sent: lines });
    this.room.getState().send({ t: 'fill.lines', turn: state.turn, id: mine, lines }, host);
    return true;
  }

  /** Voter: one vote, for a version that is not this phone's own. */
  vote(version: string): boolean {
    const { state, mine } = this.snapshot;
    const me = this.room.getState().me?.id;
    if (
      !me ||
      state.phase !== 'vote' ||
      !state.order.includes(me) ||
      me in state.votes ||
      version === mine ||
      !state.versions.some(item => item.id === version)
    ) {
      return false;
    }
    this.room.getState().send({ t: 'fill.vote', turn: state.turn, version });
    return true;
  }

  // ------------------------------------------------------------ internals

  private me(): MemberId | undefined {
    return this.room.getState().me?.id;
  }

  private drawing(): boolean {
    const { state } = this.snapshot;
    return state.phase === 'drawing' && !state.panelDone && state.artist !== null && state.artist === this.me();
  }

  private writing(): boolean {
    const { state } = this.snapshot;
    const me = this.me();
    return state.phase === 'writing' && !!me && me !== state.artist && state.order.includes(me);
  }

  private update(next: Partial<FillSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener());
  }

  private clearTimers(): void {
    this.timers.forEach(timer => this.clock.clearTimeout(timer));
    this.timers = [];
  }

  /**
   * Runs after the message being handled has gone out to everyone. The host hands its own messages to
   * itself before forwarding them, so anything sent from inside a handler would otherwise overtake the
   * message that caused it (the writing opening before the panel arrives, a result before the last vote).
   */
  private soon(run: () => void): void {
    Promise.resolve()
      .then(() => {
        if (this.offs.length) {
          run();
        }
      })
      .catch(() => undefined);
  }

  private later(ms: number, run: () => void): void {
    this.timers.push(this.clock.setTimeout(run, Math.max(0, ms)));
  }

  private hostId(): MemberId | undefined {
    return this.room.getState().room?.members.find(member => member.host)?.id;
  }

  private isHost(): boolean {
    return !!this.room.getState().me?.host;
  }

  /** Players of this game who are still in the room. Someone who joined mid-game only watches. */
  private present(leaving?: MemberId): MemberId[] {
    const order = this.snapshot.state.order;
    const members = this.room.getState().room?.members.map(member => member.id) ?? [];
    return members.filter(id => id !== leaving && (!order.length || order.includes(id)));
  }

  private onMessage(message: Message, from: MemberId): void {
    if (!message.t.startsWith('fill.') && message.t !== 'bye') {
      return;
    }
    // Lines reach the host alone and stay out of the shared state until the reveal.
    if (message.t === 'fill.lines') {
      if (this.isHost()) {
        this.soon(() => this.takeLines(message.turn, message.id, message.lines, from));
      }
      return;
    }
    const api = this.room.getState();
    const before = this.snapshot.state;
    const state = reduceFill(before, message, from, { offset: api.clockOffset ?? 0, host: this.hostId() ?? null });
    if (state !== before) {
      this.update({ state });
    }
    // A member leaving changes nothing in the game itself, but the host may have to move it on.
    if (state !== before || message.t === 'bye') {
      this.soon(() => this.react(message, from, state));
    }
  }

  /** What this phone does about a message that changed the game: the host's clock, the artist's and writers' timers. */
  private react(message: Message, from: MemberId, after: FillState): void {
    const host = this.isHost();
    const me = this.me();
    const now = this.snapshot.state;
    switch (message.t) {
      case 'fill.start':
        this.clearTimers();
        this.entries.clear();
        this.authors = {};
        this.update({ layout: [], draft: [], sent: null, mine: null });
        break;
      case 'fill.turn':
        if (now.turn !== after.turn) {
          break;
        }
        this.clearTimers();
        this.entries.clear();
        this.authors = {};
        this.update({ layout: [], draft: [], sent: null, mine: after.artist !== me ? this.newId() : null });
        if (after.artist === me) {
          // The artist's phone sends the panel as it is when time runs out, so the game never waits on it.
          this.later(after.endsAt - this.clock.now(), () => {
            if (this.snapshot.state.turn === after.turn) {
              this.finish();
            }
          });
        }
        if (host) {
          this.later(after.endsAt - this.clock.now() + DONE_GRACE_MS, () => this.skip(after.turn));
        }
        break;
      case 'fill.done':
        if (host && now.turn === after.turn && now.phase === 'drawing') {
          this.clearTimers();
          const ms = now.writeSeconds * 1000;
          this.room.getState().send({ t: 'fill.write', turn: now.turn, endsAt: this.clock.now() + ms });
          this.later(ms + LINES_GRACE_MS, () => this.endWriting(now.turn));
        }
        break;
      case 'fill.write':
        if (now.turn !== after.turn || now.phase !== 'writing') {
          break;
        }
        if (this.writing()) {
          this.update({ draft: Array.from({ length: now.bubbles.length }, (_, at) => this.snapshot.draft[at] ?? '') });
          // What was typed goes out when time is up, unless it was sent as it is.
          this.later(now.endsAt - this.clock.now(), () => {
            const { draft, sent, state } = this.snapshot;
            if (state.turn === after.turn && JSON.stringify(cleanLines(draft, state.bubbles.length)) !== JSON.stringify(sent)) {
              this.submit();
            }
          });
        }
        if (host && everyoneWrote(now, this.present())) {
          this.endWriting(now.turn);
        }
        break;
      case 'fill.reveal':
        if (host && now.phase === 'reveal' && now.turn === after.turn) {
          this.later(now.versions.length * SHOW_MS, () => this.openBallot(now.turn));
        }
        break;
      case 'fill.ballot':
        if (host && now.phase === 'vote' && now.turn === after.turn) {
          this.later(VOTE_MS, () => this.endVote(now.turn));
        }
        break;
      case 'fill.vote':
        if (host && now.phase === 'vote' && everyoneVoted(now.order, this.authors, now.votes, this.present())) {
          this.endVote(now.turn);
        }
        break;
      case 'fill.result':
        if (host && now.phase === 'result' && now.turn === after.turn) {
          this.clearTimers();
          this.later(RESULT_MS, () => this.nextTurn());
        }
        break;
      case 'fill.skip':
        if (host && now.phase === 'result' && now.turn === after.turn) {
          this.clearTimers();
          this.later(SKIP_MS, () => this.nextTurn());
        }
        break;
      case 'fill.over':
        this.clearTimers();
        this.update({ layout: [], draft: [], sent: null });
        break;
      case 'bye':
        if (!host) {
          break;
        }
        // Whoever left, the ones still here must not wait for them.
        if (now.phase === 'drawing' && from === now.artist && now.artist !== null) {
          this.skip(now.turn);
        } else if (now.phase === 'writing' && everyoneWrote(now, this.present(from))) {
          this.endWriting(now.turn);
        } else if (now.phase === 'vote' && everyoneVoted(now.order, this.authors, now.votes, this.present(from))) {
          this.endVote(now.turn);
        }
        break;
      default:
        break;
    }
  }

  /** Host: keeps one writer's lines for the reveal, and tells the room that they have written. */
  private takeLines(turn: number, id: string, raw: string[], from: MemberId): void {
    const state = this.snapshot.state;
    if (!this.isHost() || state.phase !== 'writing' || turn !== state.turn || !writersOf(state, [from]).length) {
      return;
    }
    // A version id belongs to one writer: another phone cannot take it over.
    const taken = [...this.entries].some(([member, entry]) => member !== from && entry.id === id);
    const lines = cleanLines(raw, state.bubbles.length);
    if (taken || !hasWords(lines)) {
      return;
    }
    this.entries.set(from, { id, lines });
    const api = this.room.getState();
    if (!state.wrote.includes(from)) {
      api.send({ t: 'fill.wrote', turn, member: from });
    }
    if (everyoneWrote(this.snapshot.state, this.present())) {
      this.endWriting(turn);
    }
  }

  /** Host: writing is over (time up, or everyone has written). The versions, shuffled, or the result when there are none. */
  private endWriting(turn: number): void {
    const state = this.snapshot.state;
    if (!this.isHost() || state.turn !== turn || state.phase !== 'writing') {
      return;
    }
    this.clearTimers();
    const entries = [...this.entries].filter(([member]) => member !== state.artist && state.order.includes(member));
    // Fisher-Yates, so the order says nothing about who wrote first.
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    this.authors = Object.fromEntries(entries.map(([member, entry]) => [entry.id, member]));
    const api = this.room.getState();
    if (!entries.length) {
      api.send({ t: 'fill.result', turn, authors: [], votes: [] });
      return;
    }
    api.send({ t: 'fill.reveal', turn, versions: entries.map(([, entry]) => entry), at: this.clock.now() });
  }

  /** Host: the reveal is over. The vote, or straight to the result when nobody has a version to vote for. */
  private openBallot(turn: number): void {
    const state = this.snapshot.state;
    if (!this.isHost() || state.turn !== turn || state.phase !== 'reveal') {
      return;
    }
    this.clearTimers();
    if (!votersOf(state.order, this.authors, this.present()).length) {
      this.endVote(turn);
      return;
    }
    this.room.getState().send({ t: 'fill.ballot', turn, endsAt: this.clock.now() + VOTE_MS });
  }

  /** Host: names the authors and the votes that count. */
  private endVote(turn: number): void {
    const state = this.snapshot.state;
    if (!this.isHost() || state.turn !== turn || (state.phase !== 'vote' && state.phase !== 'reveal')) {
      return;
    }
    this.clearTimers();
    this.room.getState().send({
      t: 'fill.result',
      turn,
      authors: Object.entries(this.authors).map(([version, member]) => ({ version, member })),
      votes: Object.entries(state.votes).map(([member, version]) => ({ member, version })),
    });
  }

  /** Host: no panel this turn (the artist left, or their phone never sent it). */
  private skip(turn: number): void {
    const state = this.snapshot.state;
    if (!this.isHost() || state.turn !== turn || state.phase !== 'drawing' || state.panelDone) {
      return;
    }
    this.clearTimers();
    this.room.getState().send({ t: 'fill.skip', turn });
  }

  /** Host: the next turn, or the final scores when the game is done or too few are left. */
  private nextTurn(): void {
    const api = this.room.getState();
    if (!api.me?.host) {
      return;
    }
    this.clearTimers();
    const state = this.snapshot.state;
    const next = nextTurn(state, this.present());
    if (!next) {
      api.send({ t: 'fill.over', scores: state.scores });
      return;
    }
    api.send({ t: 'fill.turn', turn: next.turn, artist: next.drawer, endsAt: this.clock.now() + state.drawSeconds * 1000 });
  }
}
