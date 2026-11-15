/**
 * Fill the bubbles: each round one player (the artist) draws a panel with no words and places one to three
 * empty speech bubbles on it. Everyone else then writes the lines for those bubbles, privately. The
 * versions are shown one by one with their authors hidden, everyone votes for the funniest one that is
 * not their own, and the next player draws.
 *
 * Who knows what: the panel (strokes and bubbles) goes to the whole room. Lines go to the host alone
 * (`to`), so nobody sees another player's lines before the reveal. The host shows every version at once,
 * shuffled and without names, and names the authors only in the result, after the vote. Each writer's
 * phone picks a random id for its version, so it knows which one is its own without anyone else knowing.
 *
 * Who decides when: the host runs the clock. It starts each turn, opens the writing when the artist is
 * done, reveals the versions when time is up or everyone has written, opens and closes the vote, and
 * announces the final scores. Points follow from the host's list of authors and votes, so every phone
 * counts the same.
 */
import type { Bubble, Stroke } from '../model/types';
import { BOARD_UNITS, INK_POINTS_MAX, INK_STROKES_MAX, type InkStroke } from './guess';
import type { MemberId, Message } from './types';

export const FILL_ROUNDS = [1, 2, 3] as const;
export const FILL_DRAW_SECONDS = [60, 90, 120] as const;
export const FILL_WRITE_SECONDS = [45, 60, 90] as const;
/** At least one bubble, at most this many, on every panel. */
export const FILL_BUBBLES_MAX = 3;
/** Characters per line: a speech bubble, not a paragraph. */
export const FILL_LINE_MAX = 80;
/** One version per player, and a room holds at most 16 people. */
export const FILL_VERSIONS_MAX = 16;
/** The host skips an artist whose panel has not arrived this long after the drawing time (their phone is gone). */
export const DONE_GRACE_MS = 5000;
/** Writers' phones send what they typed when time is up; the host waits this long for those before the reveal. */
export const LINES_GRACE_MS = 2000;
/** Each version stays on screen this long during the reveal. */
export const SHOW_MS = 7000;
/** The vote closes when everyone has voted, or after this long. */
export const VOTE_MS = 30000;
/** The result stays on screen this long before the next turn. */
export const RESULT_MS = 10000;
/** A skipped turn (the artist left) is shown this long. */
export const SKIP_MS = 4000;

/** Per vote a version gets, to its author. */
export const VOTE_POINTS = 100;
/** To the author of the version with the most votes; tied versions all get it. */
export const WIN_POINTS = 50;
/** To the artist for each version written on their panel, so a panel that sets up a joke pays. */
export const ARTIST_POINTS = 25;

export type BubbleKind = 'speak' | 'think' | 'shout';
export const BUBBLE_KINDS: readonly BubbleKind[] = ['speak', 'think', 'shout'];

/** A bubble on the board, in board units (0 to BOARD_UNITS). The tail tip points at whoever speaks. */
export type FillBubble = { kind: BubbleKind; x: number; y: number; w: number; h: number; tail: { x: number; y: number } };

/** Bubble sizes the artist can pick, in board units. */
export const BUBBLE_SIZES = { small: { w: 300, h: 190 }, large: { w: 420, h: 260 } } as const;
const BUBBLE_MIN = 120;
const BUBBLE_MAX = 600;

/** One player's lines for the panel, one per bubble, under the id their phone picked. */
export type FillVersion = { id: string; lines: string[] };

export type FillPhase = 'idle' | 'drawing' | 'writing' | 'reveal' | 'vote' | 'result' | 'over';

export type FillState = {
  phase: FillPhase;
  rounds: number;
  drawSeconds: number;
  writeSeconds: number;
  /** Who draws, in turn order: the members in the room when the game started. */
  order: MemberId[];
  turn: number;
  /** Null between the start and the first turn. */
  artist: MemberId | null;
  /** When drawing, writing or the vote ends, on this phone's clock. */
  endsAt: number;
  strokes: InkStroke[];
  /** The artist's bubbles, once the panel is done. */
  bubbles: FillBubble[];
  /** The artist sent the panel: no more strokes this turn. */
  panelDone: boolean;
  /** Players who have sent lines this turn (who, never what). */
  wrote: MemberId[];
  /** Every version, shuffled, authors hidden until the result. */
  versions: FillVersion[];
  /** When the reveal started, on this phone's clock. */
  revealAt: number;
  /** Who voted for which version. */
  votes: Record<MemberId, string>;
  /** Version id to author: only in the result. */
  authors: Record<string, MemberId>;
  /** The version ids with the most votes (more than one on a tie, none when nobody voted). */
  winners: string[];
  /** The turn ended with no panel: the artist left or never finished. */
  skipped: boolean;
  scores: Record<MemberId, number>;
  /** What each person earned in the turn that just ended. */
  turnScores: Record<MemberId, number>;
  /** The host's final scores, when the game is over. */
  final: Record<MemberId, number> | null;
};

export const INITIAL_FILL: FillState = {
  phase: 'idle',
  rounds: 0,
  drawSeconds: 0,
  writeSeconds: 0,
  order: [],
  turn: -1,
  artist: null,
  endsAt: 0,
  strokes: [],
  bubbles: [],
  panelDone: false,
  wrote: [],
  versions: [],
  revealAt: 0,
  votes: {},
  authors: {},
  winners: [],
  skipped: false,
  scores: {},
  turnScores: {},
  final: null,
};

// ---------------------------------------------------------------- bubbles and lines

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/** A bubble kept on the board and within sensible sizes, whatever arrived. */
export function cleanBubble(bubble: FillBubble): FillBubble {
  const kind = BUBBLE_KINDS.includes(bubble.kind) ? bubble.kind : 'speak';
  const w = clamp(finite(bubble.w, BUBBLE_SIZES.small.w), BUBBLE_MIN, BUBBLE_MAX);
  const h = clamp(finite(bubble.h, BUBBLE_SIZES.small.h), BUBBLE_MIN, BUBBLE_MAX);
  const x = clamp(finite(bubble.x, 0), 0, BOARD_UNITS - w);
  const y = clamp(finite(bubble.y, 0), 0, BOARD_UNITS - h);
  const tail = { x: clamp(finite(bubble.tail?.x, x + w / 2), 0, BOARD_UNITS), y: clamp(finite(bubble.tail?.y, y + h), 0, BOARD_UNITS) };
  return { kind, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), tail: { x: Math.round(tail.x), y: Math.round(tail.y) } };
}

export function cleanBubbles(bubbles: readonly FillBubble[]): FillBubble[] {
  return bubbles.slice(0, FILL_BUBBLES_MAX).map(cleanBubble);
}

/**
 * A new bubble for the `index`-th place: the first top left, the second top right, the third lower down,
 * so a fresh bubble never hides the one before. The tail points down towards the middle of the panel.
 */
export function placeBubble(kind: BubbleKind, index: number, size: keyof typeof BUBBLE_SIZES = 'small'): FillBubble {
  const { w, h } = BUBBLE_SIZES[size];
  const spots = [
    { x: 40, y: 40 },
    { x: BOARD_UNITS - w - 40, y: 60 },
    { x: (BOARD_UNITS - w) / 2, y: BOARD_UNITS * 0.42 },
  ];
  const spot = spots[index % spots.length];
  const towards = spot.x + w / 2 < BOARD_UNITS / 2 ? 1 : -1;
  return cleanBubble({ kind, ...spot, w, h, tail: { x: spot.x + w / 2 + towards * w * 0.2, y: spot.y + h + 90 } });
}

/** Moves a bubble, its tail with it, staying on the board. */
export function moveBubble(bubble: FillBubble, dx: number, dy: number): FillBubble {
  const x = clamp(bubble.x + dx, 0, BOARD_UNITS - bubble.w);
  const y = clamp(bubble.y + dy, 0, BOARD_UNITS - bubble.h);
  return cleanBubble({ ...bubble, x, y, tail: { x: bubble.tail.x + (x - bubble.x), y: bubble.tail.y + (y - bubble.y) } });
}

/** Switches between the small and the large size, keeping the bubble's centre where it was. */
export function resizeBubble(bubble: FillBubble, size: keyof typeof BUBBLE_SIZES): FillBubble {
  const { w, h } = BUBBLE_SIZES[size];
  const cx = bubble.x + bubble.w / 2;
  const cy = bubble.y + bubble.h / 2;
  return cleanBubble({ ...bubble, w, h, x: cx - w / 2, y: cy - h / 2 });
}

export function bubbleSize(bubble: Pick<FillBubble, 'w'>): keyof typeof BUBBLE_SIZES {
  return bubble.w >= (BUBBLE_SIZES.small.w + BUBBLE_SIZES.large.w) / 2 ? 'large' : 'small';
}

/** What a touch at `p` grabs: the tail tip of a bubble, a bubble's body, or nothing. Topmost first. */
export function grabBubble(bubbles: readonly FillBubble[], p: { x: number; y: number }, reach = 60): { index: number; part: 'tail' | 'body' } | null {
  for (let index = bubbles.length - 1; index >= 0; index--) {
    const bubble = bubbles[index];
    if (Math.hypot(p.x - bubble.tail.x, p.y - bubble.tail.y) <= reach) {
      return { index, part: 'tail' };
    }
  }
  for (let index = bubbles.length - 1; index >= 0; index--) {
    const bubble = bubbles[index];
    if (p.x >= bubble.x && p.x <= bubble.x + bubble.w && p.y >= bubble.y && p.y <= bubble.y + bubble.h) {
      return { index, part: 'body' };
    }
  }
  return null;
}

/** Letters in a bubble, in board units: big enough to read on a phone; long lines are shrunk to fit. */
export const BUBBLE_FONT = 34;

/**
 * A board bubble as the lettering code draws it, with its line, placed in a square `box` of a page
 * (the whole board on screen, or the square the panel picture fills on a saved page).
 */
export function asPageBubble(bubble: FillBubble, text: string, id: string, box: { x: number; y: number; size: number }): Bubble {
  const k = box.size / BOARD_UNITS;
  return {
    id,
    type: bubble.kind,
    text,
    x: box.x + bubble.x * k,
    y: box.y + bubble.y * k,
    w: bubble.w * k,
    h: bubble.h * k,
    rotation: 0,
    tail: { x: box.x + bubble.tail.x * k, y: box.y + bubble.tail.y * k },
    fontSize: Math.round(BUBBLE_FONT * k),
    font: 'hand',
    bold: bubble.kind === 'shout',
  };
}

/** The panel's strokes as pencil strokes in a square `box` of a page, so a saved panel can be drawn on further. */
export function inkToStrokes(strokes: readonly InkStroke[], box: { x: number; y: number; size: number }): Stroke[] {
  const k = box.size / BOARD_UNITS;
  return strokes
    .filter(stroke => stroke.points.length >= 2)
    .map(stroke => ({
      tool: 'pencil',
      color: stroke.color,
      size: stroke.size * k,
      opacity: 1,
      points: stroke.points.slice(0, stroke.points.length - (stroke.points.length % 2)).map((value, index) => (index % 2 === 0 ? box.x : box.y) + value * k),
    }));
}

/** One line per bubble: no line breaks or runs of spaces, at most FILL_LINE_MAX characters. */
export function cleanLines(lines: readonly string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    Array.from((lines[index] ?? '').replace(/\s+/g, ' ').trim())
      .slice(0, FILL_LINE_MAX)
      .join(''),
  );
}

/** A version says something: at least one bubble has words. */
export function hasWords(lines: readonly string[]): boolean {
  return lines.some(line => line.trim().length > 0);
}

// ---------------------------------------------------------------- turns, votes and points

/** Players who write this turn and are still here: everyone in the game but the artist. */
export function writersOf(state: Pick<FillState, 'order' | 'artist'>, present: readonly MemberId[]): MemberId[] {
  return present.filter(id => id !== state.artist && state.order.includes(id));
}

/** Every writer still here has sent lines. True when none are left, so a room that emptied never waits. */
export function everyoneWrote(state: Pick<FillState, 'order' | 'artist' | 'wrote'>, present: readonly MemberId[]): boolean {
  return writersOf(state, present).every(id => state.wrote.includes(id));
}

/** Players still here who have a version to vote for: one that is not their own. The artist votes too. */
export function votersOf(order: readonly MemberId[], authors: Record<string, MemberId>, present: readonly MemberId[]): MemberId[] {
  const versions = Object.keys(authors);
  return present.filter(id => order.includes(id) && versions.some(version => authors[version] !== id));
}

/** Votes that count: by a player, for a known version, not their own. */
export function validVotes(order: readonly MemberId[], authors: Record<string, MemberId>, votes: Record<MemberId, string>): Record<MemberId, string> {
  return Object.fromEntries(Object.entries(votes).filter(([voter, version]) => order.includes(voter) && authors[version] !== undefined && authors[version] !== voter));
}

/** Every voter still here has cast a vote that counts. */
export function everyoneVoted(order: readonly MemberId[], authors: Record<string, MemberId>, votes: Record<MemberId, string>, present: readonly MemberId[]): boolean {
  const counted = validVotes(order, authors, votes);
  return votersOf(order, authors, present).every(id => id in counted);
}

export function voteCounts(votes: Record<MemberId, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  Object.values(votes).forEach(version => {
    counts[version] = (counts[version] ?? 0) + 1;
  });
  return counts;
}

/** The versions with the most votes: all of them on a tie, none when nobody voted. */
export function topVersions(authors: Record<string, MemberId>, votes: Record<MemberId, string>): string[] {
  const counts = voteCounts(votes);
  const best = Math.max(0, ...Object.keys(authors).map(version => counts[version] ?? 0));
  return best > 0 ? Object.keys(authors).filter(version => (counts[version] ?? 0) === best) : [];
}

/** Points from a turn: votes and the win to each author, and the artist's share per version written. */
export function scoreFill(artist: MemberId | null, authors: Record<string, MemberId>, votes: Record<MemberId, string>): Record<MemberId, number> {
  const earned: Record<MemberId, number> = {};
  const add = (member: MemberId, points: number) => {
    earned[member] = (earned[member] ?? 0) + points;
  };
  Object.values(votes).forEach(version => {
    const author = authors[version];
    if (author) {
      add(author, VOTE_POINTS);
    }
  });
  topVersions(authors, votes).forEach(version => add(authors[version], WIN_POINTS));
  const written = Object.keys(authors).length;
  if (artist && written) {
    add(artist, ARTIST_POINTS * written);
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

/** The version on screen during the reveal, from the time the reveal started. */
export function revealIndex(state: Pick<FillState, 'revealAt' | 'versions'>, now: number): number {
  if (!state.versions.length) {
    return 0;
  }
  return clamp(Math.floor((now - state.revealAt) / SHOW_MS), 0, state.versions.length - 1);
}

/** When the reveal is over and the vote opens, on this phone's clock. */
export function revealEndsAt(state: Pick<FillState, 'revealAt' | 'versions'>): number {
  return state.revealAt + state.versions.length * SHOW_MS;
}

/** Versions as shown in the result: most votes first, then in the order they were revealed. */
export function rankedVersions(state: Pick<FillState, 'versions' | 'votes'>): { version: FillVersion; votes: number }[] {
  const counts = voteCounts(state.votes);
  return state.versions
    .map((version, index) => ({ version, votes: counts[version.id] ?? 0, index }))
    .sort((a, b) => b.votes - a.votes || a.index - b.index)
    .map(({ version, votes }) => ({ version, votes }));
}

/** Host clock to this phone's clock. `offset` is the host's clock minus ours (0 on the host). */
const local = (hostTime: number, offset: number) => hostTime - offset;

export type FillContext = { offset: number; host: MemberId | null };

/**
 * Every phone follows the game through this. `from` is the sender as the host saw it, never a claim in
 * the message: only the host runs the clock and names authors, only the artist draws, only players vote.
 */
export function reduceFill(state: FillState, message: Message, from: MemberId, context: FillContext): FillState {
  const byHost = from === context.host;
  const byArtist = from === state.artist && state.artist !== null;
  const thisTurn = 'turn' in message && message.turn === state.turn;
  const drawing = state.phase === 'drawing' && !state.panelDone && thisTurn;
  switch (message.t) {
    case 'fill.start': {
      if (!byHost) {
        return state;
      }
      const order = message.order.filter((id, index, all) => all.indexOf(id) === index);
      return {
        ...INITIAL_FILL,
        phase: 'drawing',
        rounds: message.rounds,
        drawSeconds: message.drawSeconds,
        writeSeconds: message.writeSeconds,
        order,
        scores: Object.fromEntries(order.map(id => [id, 0])),
      };
    }
    case 'fill.turn':
      if (!byHost || state.phase === 'idle' || state.phase === 'over' || message.turn <= state.turn) {
        return state;
      }
      return {
        ...state,
        phase: 'drawing',
        turn: message.turn,
        artist: message.artist,
        endsAt: local(message.endsAt, context.offset),
        strokes: [],
        bubbles: [],
        panelDone: false,
        wrote: [],
        versions: [],
        revealAt: 0,
        votes: {},
        authors: {},
        winners: [],
        skipped: false,
        turnScores: {},
      };
    case 'fill.ink': {
      if (!byArtist || !drawing) {
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
    case 'fill.undo':
      return byArtist && drawing ? { ...state, strokes: state.strokes.slice(0, -1) } : state;
    case 'fill.clear':
      return byArtist && drawing ? { ...state, strokes: [] } : state;
    case 'fill.done': {
      const bubbles = cleanBubbles(message.bubbles);
      if (!byArtist || !drawing || !bubbles.length) {
        return state;
      }
      return { ...state, bubbles, panelDone: true };
    }
    case 'fill.write':
      if (!byHost || !thisTurn || state.phase !== 'drawing' || !state.panelDone) {
        return state;
      }
      return { ...state, phase: 'writing', endsAt: local(message.endsAt, context.offset) };
    case 'fill.wrote':
      if (!byHost || !thisTurn || state.phase !== 'writing' || message.member === state.artist || !state.order.includes(message.member) || state.wrote.includes(message.member)) {
        return state;
      }
      return { ...state, wrote: [...state.wrote, message.member] };
    case 'fill.reveal': {
      if (!byHost || !thisTurn || state.phase !== 'writing') {
        return state;
      }
      const seen = new Set<string>();
      const versions = message.versions
        .filter(version => !seen.has(version.id) && seen.add(version.id))
        .slice(0, FILL_VERSIONS_MAX)
        .map(version => ({ id: version.id, lines: cleanLines(version.lines, state.bubbles.length) }));
      return { ...state, phase: 'reveal', versions, revealAt: local(message.at, context.offset) };
    }
    case 'fill.ballot':
      if (!byHost || !thisTurn || state.phase !== 'reveal') {
        return state;
      }
      return { ...state, phase: 'vote', endsAt: local(message.endsAt, context.offset) };
    case 'fill.vote':
      // Whether it is the voter's own version only the host knows; the result leaves such a vote out.
      if (!thisTurn || state.phase !== 'vote' || !state.order.includes(from) || from in state.votes || !state.versions.some(version => version.id === message.version)) {
        return state;
      }
      return { ...state, votes: { ...state.votes, [from]: message.version } };
    case 'fill.result': {
      if (!byHost || !thisTurn || (state.phase !== 'writing' && state.phase !== 'reveal' && state.phase !== 'vote')) {
        return state;
      }
      const known = new Set(state.versions.map(version => version.id));
      const authors: Record<string, MemberId> = {};
      message.authors.forEach(({ version, member }) => {
        if (known.has(version) && member !== state.artist && state.order.includes(member)) {
          authors[version] = member;
        }
      });
      // The host's list wins: a vote this phone saw may have reached the host after the vote closed.
      const cast: Record<MemberId, string> = {};
      message.votes.forEach(({ member, version }) => {
        if (!(member in cast)) {
          cast[member] = version;
        }
      });
      const votes = validVotes(state.order, authors, cast);
      const turnScores = scoreFill(state.artist, authors, votes);
      return { ...state, phase: 'result', authors, votes, winners: topVersions(authors, votes), turnScores, scores: addScores(state.scores, turnScores) };
    }
    case 'fill.skip':
      if (!byHost || !thisTurn || state.phase !== 'drawing') {
        return state;
      }
      return { ...state, phase: 'result', skipped: true, turnScores: {} };
    case 'fill.over':
      return byHost && state.phase !== 'idle' ? { ...state, phase: 'over', final: message.scores } : state;
    default:
      return state;
  }
}
