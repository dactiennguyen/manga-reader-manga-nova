import { CHOOSE_MS, DRAWER_POINTS, PICK_GRACE_MS, REVEAL_MS, displayWord, maskWord } from '../src/core/nearby/guess';
import { GuessSession, type GuessWord } from '../src/core/nearby/guessSession';
import { createLoopbackPhones } from '../src/core/nearby/loopback';
import type { Clock } from '../src/core/nearby/transport';

/** Hand-advanced timers for turns; the loopback itself uses real zero-delay timers. */
function manualClock() {
  let now = 1_000_000;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: id => {
      timers.delete(id as number);
    },
    setInterval: () => 0,
    clearInterval: () => {},
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= now && timers.has(id)) {
        timers.delete(id);
        timer.fn();
      }
    }
  };
  return { clock, advance };
}

const WORDS: GuessWord[] = [
  { entry: 'con mèo|mèo', english: 'cat' },
  { entry: 'cái ô', english: 'umbrella' },
  { entry: 'mặt trăng', english: 'moon' },
  { entry: 'cây cầu', english: 'bridge' },
];

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach(run => run());
});

async function game() {
  const loop = createLoopbackPhones(3);
  const [host, ken, lan] = loop.phones;
  const address = await host.getState().hostRoom('Mai');
  await ken.getState().joinRoom(address, 'Ken');
  await lan.getState().joinRoom(address, 'Lan');
  await loop.flush();
  const ids = [host, ken, lan].map(phone => phone.getState().me!.id);
  const { clock, advance } = manualClock();
  const sessions = [host, ken, lan].map(phone => new GuessSession(phone, () => WORDS, clock).start());
  const end = () => {
    sessions.forEach(session => session.stop());
    [host, ken, lan].forEach(phone => phone.getState().leaveRoom());
  };
  cleanups.push(end);
  return { ...loop, host, ken, lan, ids, sessions, clock, advance, end };
}

describe('a guess-the-drawing game across three phones', () => {
  it('keeps the word on the drawer, judges guesses there and reveals the word at the end', async () => {
    const { sessions, ids, flush, advance, end } = await game();
    const [mai, ken, lan] = sessions;
    mai.begin(1, 60);
    await flush();

    expect(mai.getSnapshot().state.drawer).toBe(ids[0]);
    expect(mai.getSnapshot().choices).toHaveLength(3);
    expect(ken.getSnapshot().choices).toEqual([]);

    const word = mai.getSnapshot().choices[0];
    mai.pick(word);
    await flush();
    for (const session of sessions) {
      expect(session.getSnapshot().state.phase).toBe('drawing');
      expect(session.getSnapshot().state.mask).toBe(maskWord(displayWord(word.entry)));
    }
    expect(mai.getSnapshot().secret).toBe(word);
    expect(ken.getSnapshot().secret).toBeNull();

    // A stroke reaches everyone, in two pieces.
    mai.ink(1, [10.4, 20.6, 30, 40], 8, '#111', false);
    mai.ink(1, [50, 60], 8, '#111', true);
    await flush();
    expect(lan.getSnapshot().state.strokes).toEqual([{ id: 1, size: 8, color: '#111', points: [10, 21, 30, 40, 50, 60], done: true }]);

    ken.guess('not it at all');
    await flush();
    expect(lan.getSnapshot().state.feed).toEqual([{ kind: 'miss', member: ids[1], text: 'not it at all' }]);

    // The English key counts too; nobody but the drawer ever sees the right answer as text.
    ken.guess(word.english.toUpperCase());
    await flush();
    expect(lan.getSnapshot().state.hits).toEqual([ids[1]]);
    expect(JSON.stringify(lan.getSnapshot().state.feed)).not.toContain(word.english.toUpperCase());
    expect(lan.getSnapshot().state.phase).toBe('drawing');

    lan.guess(displayWord(word.entry));
    await flush();
    for (const session of sessions) {
      const state = session.getSnapshot().state;
      expect(state.phase).toBe('reveal');
      expect(state.word).toBe(displayWord(word.entry));
      expect(state.scores).toEqual({ [ids[0]]: DRAWER_POINTS * 2, [ids[1]]: 100, [ids[2]]: 80 });
    }

    advance(REVEAL_MS);
    await flush();
    expect(lan.getSnapshot().state.turn).toBe(1);
    expect(lan.getSnapshot().state.drawer).toBe(ids[1]);
    expect(ken.getSnapshot().choices).toHaveLength(3);
    // The drawer is never offered the word already drawn this game.
    expect(ken.getSnapshot().choices.map(choice => choice.english)).not.toContain(word.english);
    end();
  });

  it('nudges only the guesser who is one letter off', async () => {
    const { sessions, flush, end } = await game();
    const [mai, ken, lan] = sessions;
    mai.begin(1, 60);
    await flush();
    const word = mai.getSnapshot().choices.find(choice => displayWord(choice.english).length >= 4) ?? mai.getSnapshot().choices[0];
    mai.pick(word);
    await flush();
    // A long word, so one letter off counts as close (the English key may list other forms after |).
    const answer = displayWord(word.english).length >= 4 ? displayWord(word.english) : 'umbrella';
    ken.guess(`${answer.slice(0, -1)}x`);
    await flush();
    expect(ken.getSnapshot().closeAt).toBeGreaterThan(0);
    expect(lan.getSnapshot().closeAt).toBe(0);
    expect(ken.getSnapshot().state.hits).toEqual([]);
    end();
  });

  it('picks for a drawer who does not choose, and ends the turn when time is up', async () => {
    const { sessions, flush, advance, end } = await game();
    const [mai, , lan] = sessions;
    mai.begin(1, 60);
    await flush();
    const first = mai.getSnapshot().choices[0];
    advance(CHOOSE_MS);
    await flush();
    expect(mai.getSnapshot().secret).toBe(first);
    expect(lan.getSnapshot().state.phase).toBe('drawing');

    advance(60000);
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('reveal');
    expect(lan.getSnapshot().state.word).toBe(displayWord(first.entry));
    expect(lan.getSnapshot().state.turnScores).toEqual({});
    end();
  });

  it('moves on when the drawer leaves, and finishes with the same scores everywhere', async () => {
    const { sessions, flush, advance, ids, ken: kenPhone, end } = await game();
    const [mai, ken, lan] = sessions;
    mai.begin(1, 60);
    await flush();
    mai.pick(mai.getSnapshot().choices[0]);
    await flush();
    lan.guess(mai.getSnapshot().secret!.english);
    await flush();
    advance(60000);
    await flush();
    advance(REVEAL_MS);
    await flush();
    expect(lan.getSnapshot().state.drawer).toBe(ids[1]);

    // Ken, the drawer now, leaves before picking: the host skips the turn after the grace.
    ken.stop();
    kenPhone.getState().leaveRoom();
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('reveal');
    expect(lan.getSnapshot().state.word).toBeNull();

    advance(REVEAL_MS);
    await flush();
    // Only Mai and Lan are left; Lan draws the last turn.
    expect(lan.getSnapshot().state.drawer).toBe(ids[2]);
    advance(CHOOSE_MS + PICK_GRACE_MS + 60000);
    await flush();
    advance(REVEAL_MS);
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('over');
    expect(lan.getSnapshot().state.final).toEqual(mai.getSnapshot().state.final);
    expect(mai.getSnapshot().state.final).toEqual({ [ids[0]]: DRAWER_POINTS, [ids[1]]: 0, [ids[2]]: 100 });
    end();
  });
});
