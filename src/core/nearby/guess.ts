/**
 * Guess the drawing: players take turns drawing a secret word while everyone else types guesses.
 *
 * Who knows what: only the drawer's phone knows the word. Guesses go to the drawer alone (`to`), and the
 * drawer's phone judges them and tells the room who got it (`guess.hit`) or what was tried
 * (`guess.miss`), so a right answer is never shown to the others. The word is revealed when the turn ends.
 *
 * Who decides when: the host runs the clock. It starts each turn, opens the drawing when the drawer has
 * picked, ends the turn when time is up or everyone has guessed, and announces the final scores. Scores
 * themselves follow from the order of the hits, so every phone counts the same points.
 */
import type { MemberId, Message } from './types';

export const GUESS_ROUNDS = [1, 2, 3] as const;
export const GUESS_SECONDS = [60, 90, 120] as const;
/** The drawer picks one of these many words. */
export const WORD_CHOICES = 3;
/** Time to pick a word; after it the drawer's phone picks the first one. */
export const CHOOSE_MS = 15000;
/** The host skips a drawer who has not picked this long after the choosing time (their phone is gone). */
export const PICK_GRACE_MS = 5000;
/** The word stays on screen this long before the next turn. */
export const REVEAL_MS = 6000;
export const GUESS_TEXT_MAX = 60;
/** How long "one letter off" stays under the guess field. */
export const CLOSE_SHOW_MS = 3000;
/** Points per stroke message and per drawing, so a runaway message cannot flood the room. */
export const INK_POINTS_MAX = 2000;
export const INK_STROKES_MAX = 600;
/** The drawing board is a square of this many units, whatever the screen size. */
export const BOARD_UNITS = 1000;

/** Pen sizes in board units, and the inks: black, red and blue on the paper-coloured board. */
export const INK_SIZES = [5, 12, 28] as const;
export const INK_COLORS = ['#1f1b16', '#c2412b', '#2f5d9b'] as const;

/** First right guess, second, third; everyone after that gets the last value. */
export const HIT_POINTS = [100, 80, 60, 50] as const;
/** The drawer earns this for each person who guesses right, so drawing clearly pays. */
export const DRAWER_POINTS = 25;

export type GuessPhase = 'idle' | 'choosing' | 'drawing' | 'reveal' | 'over';

export type InkStroke = { id: number; size: number; color: string; points: number[]; done: boolean };

export type FeedItem = { kind: 'miss'; member: MemberId; text: string } | { kind: 'hit'; member: MemberId };

export type GuessState = {
  phase: GuessPhase;
  rounds: number;
  seconds: number;
  /** Who draws, in turn order: the members in the room when the game started. */
  order: MemberId[];
  turn: number;
  drawer: MemberId | null;
  /** On this phone's clock. */
  chooseUntil: number;
  endsAt: number;
  /** The word's shape: `_` per letter, spaces kept. Empty while the drawer is choosing. */
  mask: string;
  strokes: InkStroke[];
  /** Right guessers this turn, first first. */
  hits: MemberId[];
  feed: FeedItem[];
  /** The word, once revealed (null when the drawer left before saying it). */
  word: string | null;
  scores: Record<MemberId, number>;
  /** What each person earned in the turn that just ended. */
  turnScores: Record<MemberId, number>;
  /** The host's final scores, when the game is over. */
  final: Record<MemberId, number> | null;
};

export const INITIAL_GUESS: GuessState = {
  phase: 'idle',
  rounds: 0,
  seconds: 0,
  order: [],
  turn: -1,
  drawer: null,
  chooseUntil: 0,
  endsAt: 0,
  mask: '',
  strokes: [],
  hits: [],
  feed: [],
  word: null,
  scores: {},
  turnScores: {},
  final: null,
};

export function totalTurns(state: Pick<GuessState, 'rounds' | 'order'>): number {
  return state.rounds * state.order.length;
}

/** 1-based round of a turn, for "Round 2 of 3". */
export function roundOf(state: Pick<GuessState, 'order' | 'turn'>): number {
  return state.order.length ? Math.floor(Math.max(0, state.turn) / state.order.length) + 1 : 1;
}

export function hitPoints(rank: number): number {
  return HIT_POINTS[Math.min(rank, HIT_POINTS.length - 1)];
}

// ---------------------------------------------------------------- words

/**
 * The forms a word is accepted in. A word list entry may list alternatives with `|`, such as
 * "cat|kitten" or "猫|ねこ|ネコ": the first is shown to the drawer, any of them counts as right.
 */
export function wordForms(entry: string): string[] {
  return entry
    .split('|')
    .map(form => form.trim())
    .filter(Boolean);
}

export function displayWord(entry: string): string {
  return wordForms(entry)[0] ?? '';
}

const KATAKANA = /[ァ-ヶ]/g;
const NOISE = /[\s.,!?¡¿'"`“”‘’\-_~:;()[\]{}…。、，！？「」『』・]/g;

/**
 * A guess as compared: no accents (so "con meo" counts for "con mèo"), no case, no spaces or punctuation,
 * full-width forms folded, and katakana read as hiragana.
 */
export function normalizeGuess(text: string): string {
  return text
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(KATAKANA, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(NOISE, '');
}

function editDistance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  let previous = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[y.length];
}

export type Verdict = 'right' | 'close' | 'wrong';

/**
 * `answers` are every accepted form (the word in the drawer's language, and its English key). Close means
 * one letter off on a word of four letters or more: worth a nudge, not points.
 */
export function judgeGuess(guess: string, answers: readonly string[]): Verdict {
  const typed = normalizeGuess(guess);
  if (!typed) {
    return 'wrong';
  }
  const forms = answers.map(normalizeGuess).filter(Boolean);
  if (forms.includes(typed)) {
    return 'right';
  }
  return forms.some(form => Array.from(form).length >= 4 && editDistance(form, typed) === 1) ? 'close' : 'wrong';
}

/** The word's shape for the guessers: each letter a `_`, spaces and hyphens kept. */
export function maskWord(word: string): string {
  return Array.from(word.trim())
    .map(char => (/\s/.test(char) ? ' ' : char === '-' ? '-' : '_'))
    .join('')
    .replace(/ +/g, ' ');
}

/** `count` different entries not used yet this game, falling back to used ones once all are spent. */
export function pickChoices(words: readonly string[], used: ReadonlySet<string>, count = WORD_CHOICES, random: () => number = Math.random): string[] {
  const fresh = words.filter(word => !used.has(word));
  const pool = fresh.length >= count ? fresh : [...words];
  const picked: string[] = [];
  while (picked.length < Math.min(count, pool.length)) {
    const word = pool[Math.floor(random() * pool.length)];
    if (!picked.includes(word)) {
      picked.push(word);
    }
  }
  return picked;
}

// ---------------------------------------------------------------- turns

/**
 * The next drawer after `turn`: the next player in order who is still in the room. Null when the game is
 * done, or when fewer than two people are left to play.
 */
export function nextTurn(state: Pick<GuessState, 'order' | 'rounds' | 'turn'>, present: readonly MemberId[]): { turn: number; drawer: MemberId } | null {
  if (present.length < 2) {
    return null;
  }
  const total = state.rounds * state.order.length;
  for (let turn = state.turn + 1; turn < total; turn++) {
    const drawer = state.order[turn % state.order.length];
    if (present.includes(drawer)) {
      return { turn, drawer };
    }
  }
  return null;
}

/** Everyone in the room except the drawer has guessed it. */
export function everyoneGuessed(state: Pick<GuessState, 'drawer' | 'hits'>, present: readonly MemberId[]): boolean {
  const guessers = present.filter(id => id !== state.drawer);
  return guessers.length > 0 && guessers.every(id => state.hits.includes(id));
}

/** Points earned by a turn's hits: each guesser by their place, the drawer per right guess. */
export function scoreTurn(drawer: MemberId | null, hits: readonly MemberId[]): Record<MemberId, number> {
  const earned: Record<MemberId, number> = {};
  hits.forEach((member, rank) => {
    earned[member] = (earned[member] ?? 0) + hitPoints(rank);
  });
  if (drawer && hits.length) {
    earned[drawer] = (earned[drawer] ?? 0) + DRAWER_POINTS * hits.length;
  }
  return earned;
}

function addScores(scores: Record<MemberId, number>, earned: Record<MemberId, number>): Record<MemberId, number> {
  const next = { ...scores };
  Object.entries(earned).forEach(([member, points]) => {
    next[member] = (next[member] ?? 0) + points;
  });
  return next;
}

/** Host clock to this phone's clock. `offset` is the host's clock minus ours (0 on the host). */
const local = (hostTime: number, offset: number) => hostTime - offset;

export type GuessContext = { offset: number; members: MemberId[]; host: MemberId | null };

/**
 * Every phone follows the game through this. `from` is the sender as the host saw it, never a claim in
 * the message: only the host can run the clock and only the current drawer can draw, judge or reveal.
 */
export function reduceGuess(state: GuessState, message: Message, from: MemberId, context: GuessContext): GuessState {
  const byHost = from === context.host;
  const byDrawer = from === state.drawer && state.drawer !== null;
  const thisTurn = 'turn' in message && message.turn === state.turn;
  switch (message.t) {
    case 'guess.start': {
      if (!byHost) {
        return state;
      }
      const order = message.order.filter((id, index, all) => all.indexOf(id) === index);
      return { ...INITIAL_GUESS, phase: 'choosing', rounds: message.rounds, seconds: message.seconds, order, scores: Object.fromEntries(order.map(id => [id, 0])) };
    }
    case 'guess.turn':
      if (!byHost || state.phase === 'idle' || state.phase === 'over' || message.turn <= state.turn) {
        return state;
      }
      return {
        ...state,
        phase: 'choosing',
        turn: message.turn,
        drawer: message.drawer,
        chooseUntil: local(message.chooseUntil, context.offset),
        endsAt: 0,
        mask: '',
        strokes: [],
        hits: [],
        feed: [],
        word: null,
        turnScores: {},
      };
    case 'guess.draw':
      if (!byHost || !thisTurn || state.phase !== 'choosing') {
        return state;
      }
      return { ...state, phase: 'drawing', mask: message.mask, endsAt: local(message.endsAt, context.offset) };
    case 'guess.ink': {
      if (!byDrawer || !thisTurn || state.phase !== 'drawing') {
        return state;
      }
      const at = state.strokes.findIndex(item => item.id === message.id);
      if (at < 0) {
        if (state.strokes.length >= INK_STROKES_MAX) {
          return state;
        }
        const added: InkStroke = { id: message.id, size: message.size, color: message.color, points: message.points, done: message.done };
        return { ...state, strokes: [...state.strokes, added] };
      }
      const old = state.strokes[at];
      if (old.done || old.points.length + message.points.length > INK_POINTS_MAX * 4) {
        return state;
      }
      const strokes = state.strokes.slice();
      strokes[at] = { ...old, points: old.points.concat(message.points), done: message.done };
      return { ...state, strokes };
    }
    case 'guess.undo':
      return byDrawer && thisTurn && state.phase === 'drawing' ? { ...state, strokes: state.strokes.slice(0, -1) } : state;
    case 'guess.clear':
      return byDrawer && thisTurn && state.phase === 'drawing' ? { ...state, strokes: [] } : state;
    case 'guess.hit':
      if (!byDrawer || !thisTurn || state.phase !== 'drawing' || message.member === state.drawer || state.hits.includes(message.member)) {
        return state;
      }
      return { ...state, hits: [...state.hits, message.member], feed: [...state.feed, { kind: 'hit', member: message.member }] };
    case 'guess.miss':
      if (!byDrawer || !thisTurn || state.phase !== 'drawing' || state.hits.includes(message.member)) {
        return state;
      }
      return { ...state, feed: [...state.feed.slice(-49), { kind: 'miss', member: message.member, text: message.text.slice(0, GUESS_TEXT_MAX) }] };
    case 'guess.end': {
      if (!byHost || !thisTurn || (state.phase !== 'choosing' && state.phase !== 'drawing')) {
        return state;
      }
      // The host's list wins: a drawer's phone may have counted a hit the host received after time was up.
      const hits = message.hits.filter((id, index, all) => id !== state.drawer && all.indexOf(id) === index);
      const turnScores = scoreTurn(state.drawer, hits);
      const feed = state.feed.filter(item => item.kind !== 'hit' || hits.includes(item.member));
      return { ...state, phase: 'reveal', hits, feed, turnScores, scores: addScores(state.scores, turnScores) };
    }
    case 'guess.reveal':
      return byDrawer && thisTurn && state.phase === 'reveal' ? { ...state, word: message.word.slice(0, GUESS_TEXT_MAX) } : state;
    case 'guess.over':
      return byHost && state.phase !== 'idle' ? { ...state, phase: 'over', final: message.scores } : state;
    default:
      return state;
  }
}

/** Highest first; ties share a place (1, 1, 3). Players who scored nothing are still listed. */
export function guessRanking(scores: Record<MemberId, number>): { member: MemberId; score: number; rank: number }[] {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted.map(([member, score]) => ({ member, score, rank: sorted.findIndex(([, other]) => other === score) + 1 }));
}
