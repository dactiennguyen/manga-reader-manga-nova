/**
 * Guess the drawing, running on one phone. Every phone follows the game (guess.ts). On top of that:
 * the host runs the clock (turns, opening the drawing, ending a turn, the final scores), and whoever is
 * drawing keeps the secret word, judges the guesses sent to them and reveals the word at the end.
 */
import {
  CHOOSE_MS,
  INITIAL_GUESS,
  PICK_GRACE_MS,
  REVEAL_MS,
  everyoneGuessed,
  judgeGuess,
  maskWord,
  nextTurn,
  pickChoices,
  reduceGuess,
  wordForms,
  displayWord,
  type GuessState,
} from './guess';
import type { RoomHandle } from './relaySession';
import { realClock, type Clock } from './transport';
import type { MemberId, Message } from './types';

/** A word the drawer can pick: as shown in the app's language, and its English key, also accepted. */
export type GuessWord = { entry: string; english: string };

export type GuessSnapshot = {
  state: GuessState;
  /** Only on the drawer's phone, while choosing. */
  choices: GuessWord[];
  /** Only on the drawer's phone: the word being drawn. */
  secret: GuessWord | null;
  /** This phone's last guess was one letter off; the time it was said. */
  closeAt: number;
};

const EMPTY: GuessSnapshot = { state: INITIAL_GUESS, choices: [], secret: null, closeAt: 0 };

export class GuessSession {
  private snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  /** Host timers for the current turn, and the drawer's auto-pick. */
  private timers: unknown[] = [];
  private used = new Set<string>();

  constructor(
    private readonly room: RoomHandle,
    private readonly words: () => GuessWord[],
    private readonly clock: Clock = realClock,
  ) {}

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
    this.used.clear();
    this.update(EMPTY);
  }

  getSnapshot = (): GuessSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // ------------------------------------------------------------ actions

  /** Host: starts a game with everyone in the room, in the order they joined. */
  begin(rounds: number, seconds: number): void {
    const api = this.room.getState();
    if (!api.me?.host || !api.room) {
      return;
    }
    api.setActivity('guess', { rounds, seconds });
    api.send({ t: 'guess.start', rounds, seconds, order: api.room.members.map(member => member.id) });
    this.nextTurn();
  }

  /** Drawer: picks one of the offered words. */
  pick(word: GuessWord): void {
    const { state, choices } = this.snapshot;
    const api = this.room.getState();
    if (state.phase !== 'choosing' || state.drawer !== api.me?.id || !choices.includes(word)) {
      return;
    }
    this.clearTimers();
    this.used.add(word.english);
    this.update({ choices: [], secret: word });
    api.send({ t: 'guess.picked', turn: state.turn, mask: maskWord(displayWord(word.entry)) }, this.hostId());
  }

  /** Drawer: part of a stroke. Points are whole board units, x then y. */
  ink(id: number, points: number[], size: number, color: string, done: boolean): void {
    const { state } = this.snapshot;
    if (state.phase === 'drawing' && state.drawer === this.room.getState().me?.id) {
      this.room.getState().send({ t: 'guess.ink', turn: state.turn, id, size, color, points: points.map(Math.round), done });
    }
  }

  undo(): void {
    this.drawerSend('guess.undo');
  }

  clear(): void {
    this.drawerSend('guess.clear');
  }

  /** Guesser: sends a guess to the drawer, who judges it. */
  guess(text: string): void {
    const { state } = this.snapshot;
    const api = this.room.getState();
    const me = api.me?.id;
    const trimmed = text.trim().slice(0, 60);
    if (!trimmed || !me || state.phase !== 'drawing' || !state.drawer || state.drawer === me || state.hits.includes(me)) {
      return;
    }
    api.send({ t: 'guess.try', turn: state.turn, text: trimmed }, state.drawer);
  }

  // ------------------------------------------------------------ internals

  private drawerSend(t: 'guess.undo' | 'guess.clear'): void {
    const { state } = this.snapshot;
    if (state.phase === 'drawing' && state.drawer === this.room.getState().me?.id) {
      this.room.getState().send({ t, turn: state.turn });
    }
  }

  private update(next: Partial<GuessSnapshot>): void {
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
   * message that caused it (an end before the last hit, a reveal before the end).
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

  /** Players of this game who are still in the room. Someone who joined mid-game only watches. */
  private present(): MemberId[] {
    const order = this.snapshot.state.order;
    const members = this.room.getState().room?.members.map(member => member.id) ?? [];
    return order.length ? members.filter(id => order.includes(id)) : members;
  }

  private onMessage(message: Message, from: MemberId): void {
    if (!message.t.startsWith('guess.') && message.t !== 'bye') {
      return;
    }
    const api = this.room.getState();
    const before = this.snapshot.state;

    // Messages for the drawer alone: judged here, never part of the shared state.
    if (message.t === 'guess.try') {
      this.soon(() => this.judge(message.text, message.turn, from));
      return;
    }
    if (message.t === 'guess.close') {
      if (message.turn === before.turn && from === before.drawer) {
        this.update({ closeAt: this.clock.now() });
      }
      return;
    }
    if (message.t === 'guess.picked') {
      if (api.me?.host && from === before.drawer && message.turn === before.turn && before.phase === 'choosing') {
        this.soon(() => {
          const now = this.snapshot.state;
          if (now.turn !== before.turn || now.phase !== 'choosing') {
            return;
          }
          this.clearTimers();
          const endsAt = this.clock.now() + before.seconds * 1000;
          api.send({ t: 'guess.draw', turn: before.turn, mask: message.mask, endsAt });
          this.later(endsAt - this.clock.now(), () => this.endTurn(before.turn));
        });
      }
      return;
    }

    const state = reduceGuess(before, message, from, { offset: api.clockOffset ?? 0, members: this.present(), host: this.hostId() ?? null });
    if (state !== before) {
      this.update({ state });
    }
    // A member leaving changes nothing in the game itself, but the host may have to end the turn.
    if (state !== before || message.t === 'bye') {
      this.soon(() => this.react(message, from, before, state));
    }
  }

  /** What this phone does about a message that changed the game: the host's clock, the drawer's duties. */
  private react(message: Message, from: MemberId, before: GuessState, after: GuessState): void {
    let state = after;
    const api = this.room.getState();
    const me = api.me?.id;
    switch (message.t) {
      case 'guess.start':
        if (state !== before) {
          this.used.clear();
          this.update({ choices: [], secret: null });
        }
        break;
      case 'guess.turn':
        if (state === before) {
          break;
        }
        if (state.drawer === me) {
          this.update({ choices: this.offer(), secret: null });
          // The drawer's phone picks for them when time runs out, so the game never waits on a choice.
          this.later(state.chooseUntil - this.clock.now(), () => {
            const first = this.snapshot.choices[0];
            if (first && this.snapshot.state.turn === state.turn && this.snapshot.state.phase === 'choosing') {
              this.pick(first);
            }
          });
        } else {
          this.update({ choices: [], secret: null });
        }
        if (api.me?.host) {
          this.later(state.chooseUntil - this.clock.now() + PICK_GRACE_MS, () => {
            if (this.snapshot.state.turn === state.turn && this.snapshot.state.phase === 'choosing') {
              this.endTurn(state.turn);
            }
          });
        }
        break;
      case 'guess.hit':
        if (api.me?.host && everyoneGuessed(this.snapshot.state, this.present())) {
          this.endTurn(state.turn);
        }
        break;
      case 'guess.end':
        if (state === before) {
          break;
        }
        if (state.drawer === me && this.snapshot.secret) {
          api.send({ t: 'guess.reveal', turn: state.turn, word: displayWord(this.snapshot.secret.entry) });
        }
        if (api.me?.host) {
          this.clearTimers();
          this.later(REVEAL_MS, () => this.nextTurn());
        }
        break;
      case 'guess.reveal': {
        // Every phone notes the word, so whoever draws next is not offered it again.
        const shown = this.words().find(word => displayWord(word.entry) === state.word);
        if (shown) {
          this.used.add(shown.english);
        }
        break;
      }
      case 'guess.over':
        this.clearTimers();
        this.update({ choices: [], secret: null });
        break;
      case 'bye':
        state = this.snapshot.state;
        if (api.me?.host && (state.phase === 'choosing' || state.phase === 'drawing')) {
          // The drawer left: nothing more can happen this turn. Otherwise, the ones left may all have guessed.
          if (from === state.drawer || everyoneGuessed(state, this.present().filter(id => id !== from))) {
            this.endTurn(state.turn);
          }
        }
        break;
      default:
        break;
    }
  }

  private offer(): GuessWord[] {
    const words = this.words();
    const keys = pickChoices(
      words.map(word => word.english),
      this.used,
    );
    return keys.map(key => words.find(word => word.english === key)).filter((word): word is GuessWord => !!word);
  }

  private judge(text: string, turn: number, from: MemberId): void {
    const { state, secret } = this.snapshot;
    const api = this.room.getState();
    if (!secret || state.phase !== 'drawing' || turn !== state.turn || state.drawer !== api.me?.id || from === state.drawer || state.hits.includes(from)) {
      return;
    }
    const verdict = judgeGuess(text, [...wordForms(secret.entry), ...wordForms(secret.english)]);
    if (verdict === 'right') {
      api.send({ t: 'guess.hit', turn, member: from });
      return;
    }
    api.send({ t: 'guess.miss', turn, member: from, text });
    if (verdict === 'close') {
      api.send({ t: 'guess.close', turn }, from);
    }
  }

  /** Host: ends a turn once (time up, everyone guessed, the drawer gone, or no word picked). */
  private endTurn(turn: number): void {
    const state = this.snapshot.state;
    if (!this.room.getState().me?.host || state.turn !== turn || (state.phase !== 'choosing' && state.phase !== 'drawing')) {
      return;
    }
    this.clearTimers();
    this.room.getState().send({ t: 'guess.end', turn, hits: state.hits });
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
      api.send({ t: 'guess.over', scores: state.scores });
      return;
    }
    api.send({ t: 'guess.turn', turn: next.turn, drawer: next.drawer, chooseUntil: this.clock.now() + CHOOSE_MS });
  }
}
