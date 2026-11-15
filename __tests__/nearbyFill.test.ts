import {
  ARTIST_POINTS,
  BUBBLE_SIZES,
  FILL_BUBBLES_MAX,
  FILL_LINE_MAX,
  INITIAL_FILL,
  SHOW_MS,
  VOTE_POINTS,
  WIN_POINTS,
  bubbleSize,
  asPageBubble,
  cleanBubble,
  cleanBubbles,
  cleanLines,
  everyoneVoted,
  everyoneWrote,
  grabBubble,
  hasWords,
  inkToStrokes,
  moveBubble,
  placeBubble,
  rankedVersions,
  reduceFill,
  resizeBubble,
  revealEndsAt,
  revealIndex,
  scoreFill,
  topVersions,
  validVotes,
  votersOf,
  writersOf,
  type FillBubble,
  type FillContext,
  type FillState,
} from '../src/core/nearby/fill';
import { BOARD_UNITS, INK_STROKES_MAX } from '../src/core/nearby/guess';
import { parseEnvelope } from '../src/core/nearby/schema';
import type { Message } from '../src/core/nearby/types';

const HOST = 'h';
const context: FillContext = { offset: 0, host: HOST };
const BUBBLE: FillBubble = { kind: 'speak', x: 100, y: 100, w: 300, h: 190, tail: { x: 250, y: 380 } };

function run(messages: [Message, string][], start: FillState = INITIAL_FILL, ctx = context): FillState {
  return messages.reduce((state, [message, from]) => reduceFill(state, message, from, ctx), start);
}

/** Artist `a`, panel done with two bubbles, writing open. */
const writing = (): FillState =>
  run([
    [{ t: 'fill.start', rounds: 1, drawSeconds: 60, writeSeconds: 45, order: [HOST, 'a', 'b'] }, HOST],
    [{ t: 'fill.turn', turn: 0, artist: 'a', endsAt: 60000 }, HOST],
    [{ t: 'fill.done', turn: 0, bubbles: [BUBBLE, { ...BUBBLE, kind: 'shout', x: 500 }] }, 'a'],
    [{ t: 'fill.write', turn: 0, endsAt: 105000 }, HOST],
  ]);

const voting = (): FillState =>
  run(
    [
      [
        {
          t: 'fill.reveal',
          turn: 0,
          versions: [
            { id: 'v1', lines: ['hi', 'HEY'] },
            { id: 'v2', lines: ['yo'] },
          ],
          at: 200000,
        },
        HOST,
      ],
      [{ t: 'fill.ballot', turn: 0, endsAt: 250000 }, HOST],
    ],
    writing(),
  );

describe('bubbles and lines', () => {
  it('keeps bubbles on the board and within sizes, three at most', () => {
    const wild = { kind: 'cloud' as never, x: -50, y: 2000, w: 5000, h: 10, tail: { x: -1, y: 99999 } };
    expect(cleanBubble(wild)).toEqual({ kind: 'speak', x: 0, y: 880, w: 600, h: 120, tail: { x: 0, y: BOARD_UNITS } });
    expect(cleanBubble({ ...BUBBLE, x: Number.NaN })).toEqual({ ...BUBBLE, x: 0 });
    expect(cleanBubbles([BUBBLE, BUBBLE, BUBBLE, BUBBLE])).toHaveLength(FILL_BUBBLES_MAX);
  });

  it('places new bubbles apart, each with a tail below it', () => {
    const placed = [0, 1, 2].map(index => placeBubble('speak', index));
    const tops = new Set(placed.map(bubble => `${bubble.x},${bubble.y}`));
    expect(tops.size).toBe(3);
    placed.forEach(bubble => {
      expect(bubble.tail.y).toBeGreaterThan(bubble.y + bubble.h);
      expect(bubble.x + bubble.w).toBeLessThanOrEqual(BOARD_UNITS);
    });
  });

  it('moves a bubble with its tail, and resizes around its centre', () => {
    const moved = moveBubble(BUBBLE, 50, -20);
    expect(moved).toEqual({ ...BUBBLE, x: 150, y: 80, tail: { x: 300, y: 360 } });
    // Never off the board.
    expect(moveBubble(BUBBLE, -500, 0).x).toBe(0);
    const big = resizeBubble(BUBBLE, 'large');
    expect(big.w).toBe(BUBBLE_SIZES.large.w);
    expect(big.x + big.w / 2).toBe(BUBBLE.x + BUBBLE.w / 2);
    expect(bubbleSize(big)).toBe('large');
    expect(bubbleSize(BUBBLE)).toBe('small');
  });

  it('grabs a tail tip before a body, topmost first', () => {
    const second = { ...BUBBLE, x: 200 };
    expect(grabBubble([BUBBLE, second], { x: 250, y: 380 })).toEqual({ index: 1, part: 'tail' });
    expect(grabBubble([BUBBLE, second], { x: 150, y: 150 })).toEqual({ index: 0, part: 'body' });
    expect(grabBubble([BUBBLE, second], { x: 300, y: 150 })).toEqual({ index: 1, part: 'body' });
    expect(grabBubble([BUBBLE], { x: 900, y: 900 })).toBeNull();
  });

  it('turns a board bubble into a lettering bubble inside a square of the page', () => {
    const bubble = asPageBubble({ ...BUBBLE, kind: 'shout' }, 'WOW', 'b1', { x: 50, y: 100, size: 500 });
    expect(bubble).toMatchObject({ id: 'b1', type: 'shout', text: 'WOW', x: 100, y: 150, w: 150, h: 95, tail: { x: 175, y: 290 }, bold: true, rotation: 0 });
    expect(asPageBubble(BUBBLE, '', 'b2', { x: 0, y: 0, size: BOARD_UNITS })).toMatchObject({ x: 100, w: 300, bold: false, fontSize: 34 });
  });

  it('turns the panel strokes into pencil strokes on the page', () => {
    const strokes = inkToStrokes(
      [
        { id: 1, size: 10, color: '#111', points: [0, 0, 1000, 500, 7], done: true },
        { id: 2, size: 10, color: '#111', points: [5], done: true },
      ],
      { x: 100, y: 200, size: 500 },
    );
    expect(strokes).toEqual([{ tool: 'pencil', color: '#111', size: 5, opacity: 1, points: [100, 200, 600, 450] }]);
  });

  it('makes one clean line per bubble', () => {
    expect(cleanLines(['  Hello\n  there ', 'x'.repeat(200)], 3)).toEqual(['Hello there', 'x'.repeat(FILL_LINE_MAX), '']);
    expect(cleanLines(['a', 'b', 'c'], 1)).toEqual(['a']);
    // Counted in characters, so an emoji is never cut in half.
    expect(cleanLines(['😀'.repeat(100)], 1)[0]).toBe('😀'.repeat(FILL_LINE_MAX));
    expect(hasWords(['', ' '])).toBe(false);
    expect(hasWords(['', 'a'])).toBe(true);
  });
});

describe('writing, votes and points', () => {
  const order = [HOST, 'a', 'b', 'c'];

  it('waits only for writers still in the room', () => {
    const state = { order, artist: 'a', wrote: ['b'] };
    expect(writersOf(state, order)).toEqual([HOST, 'b', 'c']);
    expect(everyoneWrote(state, order)).toBe(false);
    expect(everyoneWrote({ ...state, wrote: ['b', HOST] }, [HOST, 'a', 'b'])).toBe(true);
    // Nobody left to write: nothing to wait for.
    expect(everyoneWrote({ ...state, wrote: [] }, ['a'])).toBe(true);
    // Someone who joined mid-game does not write.
    expect(writersOf(state, [...order, 'late'])).not.toContain('late');
  });

  it('lets everyone vote who has a version that is not their own, the artist too', () => {
    const authors = { v1: 'b', v2: 'c' };
    expect(votersOf(order, authors, order)).toEqual(order);
    // With one version, its author has nothing to vote for.
    expect(votersOf(order, { v1: 'b' }, order)).toEqual([HOST, 'a', 'c']);
    expect(votersOf(order, authors, [...order, 'late'])).not.toContain('late');
  });

  it('counts no self votes, no votes from outside the game and none for unknown versions', () => {
    const authors = { v1: 'b', v2: 'c' };
    const votes = { b: 'v1', c: 'v1', a: 'v2', late: 'v1', h: 'nope' };
    expect(validVotes(order, authors, votes)).toEqual({ c: 'v1', a: 'v2' });
  });

  it('knows when every voter still here has voted', () => {
    const authors = { v1: 'b', v2: 'c' };
    const votes = { b: 'v2', c: 'v1', a: 'v1' };
    expect(everyoneVoted(order, authors, votes, order)).toBe(false);
    expect(everyoneVoted(order, authors, votes, ['a', 'b', 'c'])).toBe(true);
    // A self vote does not count as voting.
    expect(everyoneVoted(order, authors, { ...votes, h: 'v1', b: 'v1' }, order)).toBe(false);
  });

  it('gives votes and the win to authors, ties sharing the win, and the artist a share per version', () => {
    const authors = { v1: 'b', v2: 'c', v3: HOST };
    expect(scoreFill('a', authors, { b: 'v2', c: 'v1', a: 'v1', h: 'v2' })).toEqual({
      b: VOTE_POINTS * 2 + WIN_POINTS,
      c: VOTE_POINTS * 2 + WIN_POINTS,
      a: ARTIST_POINTS * 3,
    });
    expect(topVersions(authors, { b: 'v2', c: 'v1', a: 'v1', h: 'v2' })).toEqual(['v1', 'v2']);
    // Nobody voted: no winner, the artist still earns.
    expect(topVersions(authors, {})).toEqual([]);
    expect(scoreFill('a', authors, {})).toEqual({ a: ARTIST_POINTS * 3 });
    expect(scoreFill('a', {}, {})).toEqual({});
  });

  it('shows each version in turn during the reveal, then opens the vote', () => {
    const state = { revealAt: 1000, versions: [{ id: 'x', lines: [] }, { id: 'y', lines: [] }, { id: 'z', lines: [] }] };
    expect(revealIndex(state, 0)).toBe(0);
    expect(revealIndex(state, 1000 + SHOW_MS - 1)).toBe(0);
    expect(revealIndex(state, 1000 + SHOW_MS)).toBe(1);
    expect(revealIndex(state, 1000 + 99 * SHOW_MS)).toBe(2);
    expect(revealEndsAt(state)).toBe(1000 + 3 * SHOW_MS);
    expect(revealIndex({ revealAt: 0, versions: [] }, 5000)).toBe(0);
  });

  it('ranks versions by votes, keeping the reveal order on a tie', () => {
    const state = {
      versions: [
        { id: 'x', lines: [] },
        { id: 'y', lines: [] },
        { id: 'z', lines: [] },
      ],
      votes: { a: 'z', b: 'y', c: 'z' },
    };
    expect(rankedVersions(state).map(item => [item.version.id, item.votes])).toEqual([
      ['z', 2],
      ['y', 1],
      ['x', 0],
    ]);
  });
});

describe('following a game', () => {
  it('starts, opens the drawing on this phone clock and draws strokes in pieces', () => {
    const state = run(
      [
        [{ t: 'fill.start', rounds: 2, drawSeconds: 60, writeSeconds: 45, order: [HOST, 'a', HOST] }, HOST],
        [{ t: 'fill.turn', turn: 0, artist: 'a', endsAt: 61000 }, HOST],
        [{ t: 'fill.ink', turn: 0, id: 1, size: 12, color: '#111', points: [1, 2, 3, 4], done: false }, 'a'],
        [{ t: 'fill.ink', turn: 0, id: 1, size: 12, color: '#111', points: [5, 6], done: true }, 'a'],
        [{ t: 'fill.ink', turn: 0, id: 2, size: 12, color: '#111', points: [9, 9], done: true }, 'a'],
      ],
      INITIAL_FILL,
      { offset: 1000, host: HOST },
    );
    expect(state.order).toEqual([HOST, 'a']);
    expect(state.scores).toEqual({ [HOST]: 0, a: 0 });
    expect(state.phase).toBe('drawing');
    expect(state.endsAt).toBe(60000);
    expect(state.strokes).toEqual([
      { id: 1, size: 12, color: '#111', points: [1, 2, 3, 4, 5, 6], done: true },
      { id: 2, size: 12, color: '#111', points: [9, 9], done: true },
    ]);
    expect(run([[{ t: 'fill.undo', turn: 0 }, 'a']], state).strokes).toHaveLength(1);
    expect(run([[{ t: 'fill.clear', turn: 0 }, 'a']], state).strokes).toHaveLength(0);
  });

  it('only lets the host run the clock and only the artist draw and send the panel', () => {
    const state = run([
      [{ t: 'fill.start', rounds: 1, drawSeconds: 60, writeSeconds: 45, order: [HOST, 'a', 'b'] }, HOST],
      [{ t: 'fill.turn', turn: 0, artist: 'a', endsAt: 60000 }, HOST],
    ]);
    expect(run([[{ t: 'fill.start', rounds: 1, drawSeconds: 60, writeSeconds: 45, order: ['b'] }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'fill.turn', turn: 1, artist: 'b', endsAt: 0 }, 'a']], state)).toBe(state);
    expect(run([[{ t: 'fill.ink', turn: 0, id: 1, size: 5, color: '#000', points: [1, 1], done: true }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'fill.done', turn: 0, bubbles: [BUBBLE] }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'fill.skip', turn: 0 }, 'a']], state)).toBe(state);
    expect(run([[{ t: 'fill.over', scores: { b: 999 } }, 'b']], state)).toBe(state);
    // Writing opens only once the panel is there.
    expect(run([[{ t: 'fill.write', turn: 0, endsAt: 1 }, HOST]], state)).toBe(state);
    // A panel needs a bubble.
    expect(run([[{ t: 'fill.done', turn: 0, bubbles: [] }, 'a']], state)).toBe(state);
  });

  it('freezes the panel once it is sent', () => {
    const state = writing();
    expect(state.phase).toBe('writing');
    expect(state.panelDone).toBe(true);
    expect(state.bubbles).toHaveLength(2);
    expect(state.endsAt).toBe(105000);
    expect(run([[{ t: 'fill.ink', turn: 0, id: 9, size: 5, color: '#000', points: [1, 1], done: true }, 'a']], state)).toBe(state);
    expect(run([[{ t: 'fill.clear', turn: 0 }, 'a']], state)).toBe(state);
    expect(run([[{ t: 'fill.done', turn: 0, bubbles: [BUBBLE] }, 'a']], state)).toBe(state);
  });

  it('notes who has written, once, never the artist or someone outside the game', () => {
    const state = run(
      [
        [{ t: 'fill.wrote', turn: 0, member: 'b' }, HOST],
        [{ t: 'fill.wrote', turn: 0, member: 'b' }, HOST],
        [{ t: 'fill.wrote', turn: 0, member: 'a' }, HOST],
        [{ t: 'fill.wrote', turn: 0, member: 'late' }, HOST],
        [{ t: 'fill.wrote', turn: 0, member: HOST }, 'b'],
      ],
      writing(),
    );
    expect(state.wrote).toEqual(['b']);
  });

  it('reveals versions without names, one line per bubble, each id once', () => {
    const state = run(
      [
        [
          {
            t: 'fill.reveal',
            turn: 0,
            versions: [
              { id: 'v1', lines: ['hi', 'HEY', 'extra'] },
              { id: 'v1', lines: ['copy'] },
              { id: 'v2', lines: ['yo'] },
            ],
            at: 200000,
          },
          HOST,
        ],
      ],
      writing(),
      { offset: 500, host: HOST },
    );
    expect(state.phase).toBe('reveal');
    expect(state.revealAt).toBe(199500);
    expect(state.versions).toEqual([
      { id: 'v1', lines: ['hi', 'HEY'] },
      { id: 'v2', lines: ['yo', ''] },
    ]);
    expect(state.authors).toEqual({});
  });

  it('takes one vote per player, for a version that exists, only while voting', () => {
    const state = run(
      [
        [{ t: 'fill.vote', turn: 0, version: 'v1' }, 'a'],
        [{ t: 'fill.vote', turn: 0, version: 'v2' }, 'a'],
        [{ t: 'fill.vote', turn: 0, version: 'nope' }, 'b'],
        [{ t: 'fill.vote', turn: 0, version: 'v1' }, 'late'],
        [{ t: 'fill.vote', turn: 1, version: 'v1' }, HOST],
      ],
      voting(),
    );
    expect(state.phase).toBe('vote');
    expect(state.votes).toEqual({ a: 'v1' });
    expect(run([[{ t: 'fill.vote', turn: 0, version: 'v1' }, 'b']], writing())).toEqual(writing());
  });

  it("scores the turn from the host's authors and votes, leaving out self votes", () => {
    const state = run(
      [
        [
          {
            t: 'fill.result',
            turn: 0,
            authors: [
              { version: 'v1', member: 'b' },
              { version: 'v2', member: HOST },
              // Not a version that was shown, and the artist never writes.
              { version: 'ghost', member: 'b' },
            ],
            votes: [
              { member: 'a', version: 'v1' },
              { member: 'b', version: 'v1' },
              { member: HOST, version: 'v1' },
              { member: HOST, version: 'v2' },
            ],
          },
          HOST,
        ],
      ],
      voting(),
    );
    expect(state.phase).toBe('result');
    expect(state.authors).toEqual({ v1: 'b', v2: HOST });
    expect(state.votes).toEqual({ a: 'v1', [HOST]: 'v1' });
    expect(state.winners).toEqual(['v1']);
    expect(state.turnScores).toEqual({ b: VOTE_POINTS * 2 + WIN_POINTS, a: ARTIST_POINTS * 2 });
    expect(state.scores).toEqual({ [HOST]: 0, a: ARTIST_POINTS * 2, b: VOTE_POINTS * 2 + WIN_POINTS });
    // Only the host names authors.
    expect(run([[{ t: 'fill.result', turn: 0, authors: [], votes: [] }, 'a']], voting())).toEqual(voting());
  });

  it('ends a turn with nobody writing straight from the writing', () => {
    const state = run([[{ t: 'fill.result', turn: 0, authors: [], votes: [] }, HOST]], writing());
    expect(state.phase).toBe('result');
    expect(state.turnScores).toEqual({});
  });

  it('skips a turn with no panel, and starts the next one clean', () => {
    const drawing = run([
      [{ t: 'fill.start', rounds: 1, drawSeconds: 60, writeSeconds: 45, order: [HOST, 'a', 'b'] }, HOST],
      [{ t: 'fill.turn', turn: 0, artist: 'a', endsAt: 60000 }, HOST],
      [{ t: 'fill.ink', turn: 0, id: 1, size: 5, color: '#000', points: [1, 1], done: true }, 'a'],
    ]);
    const skipped = run([[{ t: 'fill.skip', turn: 0 }, HOST]], drawing);
    expect(skipped.phase).toBe('result');
    expect(skipped.skipped).toBe(true);
    // Too late once the panel is in.
    expect(run([[{ t: 'fill.skip', turn: 0 }, HOST]], writing()).phase).toBe('writing');

    const next = run([[{ t: 'fill.turn', turn: 1, artist: 'b', endsAt: 120000 }, HOST]], skipped);
    expect(next).toMatchObject({ phase: 'drawing', artist: 'b', strokes: [], bubbles: [], skipped: false, panelDone: false, wrote: [], votes: {} });
  });

  it('ignores messages from another turn', () => {
    const state = writing();
    expect(run([[{ t: 'fill.wrote', turn: 1, member: 'b' }, HOST]], state)).toBe(state);
    expect(run([[{ t: 'fill.turn', turn: 0, artist: 'b', endsAt: 0 }, HOST]], state)).toBe(state);
    expect(run([[{ t: 'fill.reveal', turn: 3, versions: [], at: 0 }, HOST]], state)).toBe(state);
  });

  it('caps the number of strokes', () => {
    let state = run([
      [{ t: 'fill.start', rounds: 1, drawSeconds: 60, writeSeconds: 45, order: [HOST, 'a'] }, HOST],
      [{ t: 'fill.turn', turn: 0, artist: 'a', endsAt: 60000 }, HOST],
    ]);
    for (let id = 0; id < INK_STROKES_MAX + 5; id++) {
      state = reduceFill(state, { t: 'fill.ink', turn: 0, id, size: 5, color: '#000', points: [1, 1], done: true }, 'a', context);
    }
    expect(state.strokes).toHaveLength(INK_STROKES_MAX);
  });

  it('ends with the host scores and ignores everything while idle', () => {
    const over = run([[{ t: 'fill.over', scores: { a: 10 } }, HOST]], writing());
    expect(over.phase).toBe('over');
    expect(over.final).toEqual({ a: 10 });
    expect(run([[{ t: 'fill.over', scores: {} }, HOST]])).toBe(INITIAL_FILL);
    expect(run([[{ t: 'fill.turn', turn: 0, artist: 'a', endsAt: 0 }, HOST]])).toBe(INITIAL_FILL);
  });
});

describe('fill messages on the wire', () => {
  const line = (m: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ m, ...extra });

  it('accepts every fill message', () => {
    const messages: Message[] = [
      { t: 'fill.start', rounds: 2, drawSeconds: 90, writeSeconds: 60, order: ['a', 'b'] },
      { t: 'fill.turn', turn: 0, artist: 'a', endsAt: 1 },
      { t: 'fill.ink', turn: 0, id: 1, size: 5, color: '#000', points: [1, 2], done: false },
      { t: 'fill.undo', turn: 0 },
      { t: 'fill.clear', turn: 0 },
      { t: 'fill.done', turn: 0, bubbles: [BUBBLE] },
      { t: 'fill.write', turn: 0, endsAt: 2 },
      { t: 'fill.lines', turn: 0, id: 'v1', lines: ['hi', ''] },
      { t: 'fill.wrote', turn: 0, member: 'b' },
      { t: 'fill.reveal', turn: 0, versions: [{ id: 'v1', lines: ['hi'] }], at: 3 },
      { t: 'fill.ballot', turn: 0, endsAt: 4 },
      { t: 'fill.vote', turn: 0, version: 'v1' },
      { t: 'fill.result', turn: 0, authors: [{ version: 'v1', member: 'b' }], votes: [{ member: 'a', version: 'v1' }] },
      { t: 'fill.skip', turn: 0 },
      { t: 'fill.over', scores: { a: 1 } },
    ];
    for (const message of messages) {
      const parsed = parseEnvelope(line(message, { to: 'h' }));
      expect(parsed).toEqual({ ok: true, envelope: { m: message, to: 'h' } });
    }
  });

  it('refuses long lines, too many bubbles or versions, bubbles off the board and runaway strokes', () => {
    const refused = [
      { t: 'fill.lines', turn: 0, id: 'v1', lines: ['x'.repeat(FILL_LINE_MAX + 1)] },
      { t: 'fill.lines', turn: 0, id: 'v1', lines: ['a', 'b', 'c', 'd'] },
      { t: 'fill.done', turn: 0, bubbles: [BUBBLE, BUBBLE, BUBBLE, BUBBLE] },
      { t: 'fill.done', turn: 0, bubbles: [] },
      { t: 'fill.done', turn: 0, bubbles: [{ ...BUBBLE, x: 5000 }] },
      { t: 'fill.done', turn: 0, bubbles: [{ ...BUBBLE, kind: 'sfx' }] },
      { t: 'fill.reveal', turn: 0, versions: Array.from({ length: 17 }, (_, index) => ({ id: `v${index}`, lines: [] })), at: 0 },
      { t: 'fill.ink', turn: 0, id: 1, size: 5, color: '#000', points: Array.from({ length: 2001 }, () => 1), done: true },
      { t: 'fill.start', rounds: 9, drawSeconds: 60, writeSeconds: 45, order: [] },
      { t: 'fill.start', rounds: 1, drawSeconds: 60, writeSeconds: 1, order: [] },
      { t: 'fill.vote', turn: 0, version: '' },
    ];
    for (const message of refused) {
      expect(parseEnvelope(line(message))).toEqual({ ok: false, reason: 'shape' });
    }
  });
});
