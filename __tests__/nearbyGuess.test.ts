import {
  DRAWER_POINTS,
  INITIAL_GUESS,
  INK_STROKES_MAX,
  displayWord,
  everyoneGuessed,
  guessRanking,
  judgeGuess,
  maskWord,
  nextTurn,
  normalizeGuess,
  pickChoices,
  reduceGuess,
  roundOf,
  scoreTurn,
  totalTurns,
  wordForms,
  type GuessContext,
  type GuessState,
} from '../src/core/nearby/guess';
import { parseEnvelope } from '../src/core/nearby/schema';
import type { Message } from '../src/core/nearby/types';

const HOST = 'h';
const context: GuessContext = { offset: 0, members: [HOST, 'a', 'b'], host: HOST };

function run(messages: [Message, string][], start: GuessState = INITIAL_GUESS, ctx = context): GuessState {
  return messages.reduce((state, [message, from]) => reduceGuess(state, message, from, ctx), start);
}

const started = (): GuessState =>
  run([
    [{ t: 'guess.start', rounds: 2, seconds: 60, order: [HOST, 'a', 'b'] }, HOST],
    [{ t: 'guess.turn', turn: 0, drawer: 'a', chooseUntil: 15000 }, HOST],
    [{ t: 'guess.draw', turn: 0, mask: '___', endsAt: 75000 }, HOST],
  ]);

describe('words', () => {
  it('splits alternatives and shows the first', () => {
    expect(wordForms(' cat | kitten |')).toEqual(['cat', 'kitten']);
    expect(displayWord('猫|ねこ|ネコ')).toBe('猫');
  });

  it('ignores accents, case, spaces and punctuation, and reads katakana as hiragana', () => {
    expect(normalizeGuess('Con Mèo!')).toBe('conmeo');
    expect(normalizeGuess('đèn lồng')).toBe('denlong');
    expect(normalizeGuess('ネコ')).toBe('ねこ');
    expect(normalizeGuess('ＣＡＴ')).toBe('cat');
    expect(normalizeGuess('  ')).toBe('');
  });

  it('judges right, close and wrong', () => {
    const answers = ['con mèo|mèo', 'cat'].flatMap(wordForms);
    expect(judgeGuess('con meo', answers)).toBe('right');
    expect(judgeGuess('MÈO', answers)).toBe('right');
    expect(judgeGuess('cat', answers)).toBe('right');
    expect(judgeGuess('con mao', answers)).toBe('close');
    expect(judgeGuess('dog', answers)).toBe('wrong');
    // Too short to call one letter off "close".
    expect(judgeGuess('cot', answers)).toBe('wrong');
    expect(judgeGuess('', answers)).toBe('wrong');
  });

  it('masks letters and keeps the gaps', () => {
    expect(maskWord('con mèo')).toBe('___ ___');
    expect(maskWord('ice-cream  cone')).toBe('___-_____ ____');
    expect(maskWord('猫')).toBe('_');
  });

  it('picks different unused words, and reuses words once all are spent', () => {
    const words = ['a', 'b', 'c', 'd'];
    let n = 0;
    const random = () => [0, 0, 0.3, 0.6, 0.9][n++ % 5];
    const picked = pickChoices(words, new Set(['d']), 3, random);
    expect(new Set(picked).size).toBe(3);
    expect(picked).not.toContain('d');
    expect(pickChoices(words, new Set(words), 3).length).toBe(3);
    expect(pickChoices(['only'], new Set(), 3)).toEqual(['only']);
  });
});

describe('turns and points', () => {
  it('goes through every player once per round, skipping those who left', () => {
    const state = { order: [HOST, 'a', 'b'], rounds: 2, turn: -1 };
    expect(totalTurns(state)).toBe(6);
    expect(nextTurn(state, [HOST, 'a', 'b'])).toEqual({ turn: 0, drawer: HOST });
    expect(nextTurn({ ...state, turn: 0 }, [HOST, 'b'])).toEqual({ turn: 2, drawer: 'b' });
    expect(nextTurn({ ...state, turn: 5 }, [HOST, 'a', 'b'])).toBeNull();
    expect(nextTurn(state, [HOST])).toBeNull();
    expect(roundOf({ order: [HOST, 'a', 'b'], turn: 4 })).toBe(2);
  });

  it('gives guessers points by their place and the drawer points per right guess', () => {
    expect(scoreTurn('a', ['b', HOST, 'c', 'd', 'e'])).toEqual({ b: 100, h: 80, c: 60, d: 50, e: 50, a: DRAWER_POINTS * 5 });
    expect(scoreTurn('a', [])).toEqual({});
  });

  it('knows when everyone but the drawer has guessed', () => {
    expect(everyoneGuessed({ drawer: 'a', hits: [HOST, 'b'] }, [HOST, 'a', 'b'])).toBe(true);
    expect(everyoneGuessed({ drawer: 'a', hits: ['b'] }, [HOST, 'a', 'b'])).toBe(false);
    expect(everyoneGuessed({ drawer: 'a', hits: [] }, ['a'])).toBe(false);
  });

  it('ranks with shared places', () => {
    expect(guessRanking({ a: 100, b: 100, c: 30 }).map(item => item.rank)).toEqual([1, 1, 3]);
  });
});

describe('following a game', () => {
  it('starts, opens the drawing on this phone clock and draws strokes in pieces', () => {
    const offset = { ...context, offset: 1000 };
    const state = run(
      [
        [{ t: 'guess.start', rounds: 1, seconds: 60, order: [HOST, 'a', HOST] }, HOST],
        [{ t: 'guess.turn', turn: 0, drawer: 'a', chooseUntil: 16000 }, HOST],
        [{ t: 'guess.draw', turn: 0, mask: '___', endsAt: 76000 }, HOST],
        [{ t: 'guess.ink', turn: 0, id: 1, size: 8, color: '#111', points: [1, 2, 3, 4], done: false }, 'a'],
        [{ t: 'guess.ink', turn: 0, id: 1, size: 8, color: '#111', points: [5, 6], done: true }, 'a'],
        [{ t: 'guess.ink', turn: 0, id: 2, size: 8, color: '#111', points: [9, 9], done: true }, 'a'],
      ],
      INITIAL_GUESS,
      offset,
    );
    expect(state.order).toEqual([HOST, 'a']);
    expect(state.scores).toEqual({ h: 0, a: 0 });
    expect(state.phase).toBe('drawing');
    expect(state.chooseUntil).toBe(15000);
    expect(state.endsAt).toBe(75000);
    expect(state.strokes.map(item => item.points)).toEqual([[1, 2, 3, 4, 5, 6], [9, 9]]);
    expect(run([[{ t: 'guess.undo', turn: 0 }, 'a']], state).strokes).toHaveLength(1);
    expect(run([[{ t: 'guess.clear', turn: 0 }, 'a']], state).strokes).toHaveLength(0);
  });

  it('only lets the host run the clock and only the drawer draw, judge and reveal', () => {
    const state = started();
    expect(run([[{ t: 'guess.turn', turn: 1, drawer: 'b', chooseUntil: 0 }, 'a']], state)).toBe(state);
    expect(run([[{ t: 'guess.end', turn: 0, hits: [] }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'guess.ink', turn: 0, id: 1, size: 8, color: '#000', points: [1, 1], done: true }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'guess.hit', turn: 0, member: 'b' }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'guess.over', scores: { b: 999 } }, 'b']], state)).toBe(state);
    expect(run([[{ t: 'guess.start', rounds: 1, seconds: 60, order: ['b'] }, 'b']], state)).toBe(state);
  });

  it('ignores a message from another turn', () => {
    const state = started();
    expect(run([[{ t: 'guess.hit', turn: 1, member: 'b' }, 'a']], state)).toBe(state);
    expect(run([[{ t: 'guess.turn', turn: 0, drawer: 'b', chooseUntil: 0 }, HOST]], state)).toBe(state);
  });

  it('records each right guess once, never the drawer, and scores the turn when it ends', () => {
    const state = run(
      [
        [{ t: 'guess.miss', turn: 0, member: 'b', text: 'dog' }, 'a'],
        [{ t: 'guess.hit', turn: 0, member: 'b' }, 'a'],
        [{ t: 'guess.hit', turn: 0, member: 'b' }, 'a'],
        [{ t: 'guess.hit', turn: 0, member: 'a' }, 'a'],
        [{ t: 'guess.miss', turn: 0, member: 'b', text: 'late' }, 'a'],
        [{ t: 'guess.hit', turn: 0, member: HOST }, 'a'],
        [{ t: 'guess.end', turn: 0, hits: ['b', HOST] }, HOST],
        [{ t: 'guess.reveal', turn: 0, word: 'cat' }, 'a'],
      ],
      started(),
    );
    expect(state.hits).toEqual(['b', HOST]);
    expect(state.feed).toEqual([
      { kind: 'miss', member: 'b', text: 'dog' },
      { kind: 'hit', member: 'b' },
      { kind: 'hit', member: HOST },
    ]);
    expect(state.phase).toBe('reveal');
    expect(state.word).toBe('cat');
    expect(state.turnScores).toEqual({ b: 100, h: 80, a: 50 });
    expect(state.scores).toEqual({ h: 80, a: 50, b: 100 });

    const next = run([[{ t: 'guess.turn', turn: 1, drawer: 'b', chooseUntil: 0 }, HOST]], state);
    expect(next.phase).toBe('choosing');
    expect(next.strokes).toEqual([]);
    expect(next.hits).toEqual([]);
    expect(next.word).toBeNull();
    expect(next.scores).toEqual(state.scores);
  });

  it("scores the turn from the host's list of hits, not this phone's", () => {
    // The drawer's phone saw a late hit from 'b' that the host received after time was up.
    const state = run(
      [
        [{ t: 'guess.hit', turn: 0, member: 'b' }, 'a'],
        [{ t: 'guess.end', turn: 0, hits: [] }, HOST],
      ],
      started(),
    );
    expect(state.hits).toEqual([]);
    expect(state.turnScores).toEqual({});
    expect(state.feed).toEqual([]);
  });

  it('caps the number of strokes', () => {
    let state = started();
    for (let id = 0; id < INK_STROKES_MAX + 5; id++) {
      state = reduceGuess(state, { t: 'guess.ink', turn: 0, id, size: 4, color: '#000', points: [0, 0], done: true }, 'a', context);
    }
    expect(state.strokes).toHaveLength(INK_STROKES_MAX);
  });

  it('ends with the host scores', () => {
    const state = run([[{ t: 'guess.over', scores: { a: 10 } }, HOST]], started());
    expect(state.phase).toBe('over');
    expect(state.final).toEqual({ a: 10 });
  });
});

describe('guess messages on the wire', () => {
  const line = (m: unknown) => JSON.stringify({ m, from: 'a' });

  it('accepts every guess message', () => {
    const messages: Message[] = [
      { t: 'guess.start', rounds: 2, seconds: 90, order: ['a', 'b'] },
      { t: 'guess.turn', turn: 0, drawer: 'a', chooseUntil: 1 },
      { t: 'guess.picked', turn: 0, mask: '___' },
      { t: 'guess.draw', turn: 0, mask: '___', endsAt: 2 },
      { t: 'guess.ink', turn: 0, id: 3, size: 8, color: '#000', points: [1, 2], done: false },
      { t: 'guess.undo', turn: 0 },
      { t: 'guess.clear', turn: 0 },
      { t: 'guess.try', turn: 0, text: 'cat' },
      { t: 'guess.hit', turn: 0, member: 'b' },
      { t: 'guess.miss', turn: 0, member: 'b', text: 'dog' },
      { t: 'guess.close', turn: 0 },
      { t: 'guess.end', turn: 0, hits: ['b'] },
      { t: 'guess.reveal', turn: 0, word: 'cat' },
      { t: 'guess.over', scores: { a: 1 } },
    ];
    messages.forEach(m => expect(parseEnvelope(line(m))).toEqual({ ok: true, envelope: { m, from: 'a' } }));
  });

  it('refuses oversized guesses and strokes', () => {
    expect(parseEnvelope(line({ t: 'guess.try', turn: 0, text: 'x'.repeat(61) })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'guess.ink', turn: 0, id: 1, size: 1, color: '#000', points: new Array(2001).fill(0), done: true })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'guess.start', rounds: 9, seconds: 60, order: [] })).ok).toBe(false);
  });
});
