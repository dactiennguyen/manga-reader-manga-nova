import { ARTIST_POINTS, DONE_GRACE_MS, LINES_GRACE_MS, RESULT_MS, SHOW_MS, SKIP_MS, VOTE_MS, VOTE_POINTS, WIN_POINTS } from '../src/core/nearby/fill';
import { FillSession } from '../src/core/nearby/fillSession';
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

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach(run => run());
});

async function game(count = 3) {
  const loop = createLoopbackPhones(count);
  const phones = loop.phones;
  const address = await phones[0].getState().hostRoom('Mai');
  for (const [index, phone] of phones.slice(1, 3).entries()) {
    await phone.getState().joinRoom(address, ['Ken', 'Lan'][index]);
  }
  await loop.flush();
  const { clock, advance } = manualClock();
  let n = 0;
  // Version ids per phone, so a test can tell whose is whose; no shuffle, so the reveal keeps arrival order.
  const sessions = phones.map((phone, index) => new FillSession(phone, { clock, newId: () => `v${index}-${++n}`, random: () => 0.999 }).start());
  const ids = () => phones.map(phone => phone.getState().me?.id ?? '');
  const end = () => {
    sessions.forEach(session => session.stop());
    phones.forEach(phone => phone.getState().leaveRoom());
  };
  cleanups.push(end);
  return { ...loop, address, phones, sessions, ids, advance, end };
}

/** Turn 0 with the host drawing: the panel goes out at once, nobody writes, and the result moves on to turn 1. */
async function quietTurn(sessions: FillSession[], flush: () => Promise<void>, advance: (ms: number) => void) {
  sessions[0].finish();
  await flush();
  advance(45000 + LINES_GRACE_MS);
  await flush();
  advance(RESULT_MS);
  await flush();
}

describe('a fill-the-bubbles game across three phones', () => {
  it('plays a whole turn: panel, private lines, an anonymous reveal, a vote and the same scores everywhere', async () => {
    const { sessions, ids, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    const [maiId, kenId, lanId] = ids();
    mai.begin(1, 60, 45);
    await flush();
    for (const session of sessions) {
      expect(session.getSnapshot().state.phase).toBe('drawing');
      expect(session.getSnapshot().state.artist).toBe(maiId);
    }

    // Mai draws and places two bubbles; strokes reach everyone, bubbles stay on her phone until she is done.
    mai.ink(1, [10.4, 20.6, 30, 40], 12, '#111', true);
    expect(mai.addBubble('speak')).toBe(0);
    expect(mai.addBubble('shout')).toBe(1);
    expect(ken.addBubble('speak')).toBe(-1);
    await flush();
    expect(lan.getSnapshot().state.strokes).toEqual([{ id: 1, size: 12, color: '#111', points: [10, 21, 30, 40], done: true }]);
    expect(lan.getSnapshot().state.bubbles).toEqual([]);

    mai.finish();
    await flush();
    for (const session of sessions) {
      const state = session.getSnapshot().state;
      expect(state.phase).toBe('writing');
      expect(state.bubbles.map(bubble => bubble.kind)).toEqual(['speak', 'shout']);
    }
    // No more strokes once the panel is sent.
    mai.ink(2, [1, 1], 5, '#111', true);
    await flush();
    expect(ken.getSnapshot().state.strokes).toHaveLength(1);

    // The artist does not write.
    mai.setLine(0, 'mine');
    expect(mai.submit()).toBe(false);

    ken.setLine(0, 'Is that my lunch?');
    ken.setLine(1, 'IT WAS!');
    expect(ken.submit()).toBe(true);
    await flush();
    // Everyone sees that Ken wrote, nobody but the host's session sees what.
    expect(lan.getSnapshot().state.wrote).toEqual([kenId]);
    expect(JSON.stringify(lan.getSnapshot())).not.toContain('lunch');
    expect(lan.getSnapshot().state.phase).toBe('writing');

    lan.setLine(0, 'Nice hat');
    expect(lan.submit()).toBe(true);
    await flush();
    // Everyone has written: the reveal starts without waiting for the clock.
    const kenVersion = ken.getSnapshot().mine!;
    const lanVersion = lan.getSnapshot().mine!;
    for (const session of sessions) {
      const state = session.getSnapshot().state;
      expect(state.phase).toBe('reveal');
      expect(state.versions).toEqual(
        expect.arrayContaining([
          { id: kenVersion, lines: ['Is that my lunch?', 'IT WAS!'] },
          { id: lanVersion, lines: ['Nice hat', ''] },
        ]),
      );
      expect(state.authors).toEqual({});
      expect(JSON.stringify(state.versions)).not.toContain(kenId);
    }

    advance(2 * SHOW_MS);
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('vote');

    // Nobody votes for their own version, and a vote is final.
    expect(ken.vote(kenVersion)).toBe(false);
    expect(ken.vote(lanVersion)).toBe(true);
    await flush();
    expect(ken.vote(kenVersion)).toBe(false);
    expect(lan.vote(kenVersion)).toBe(true);
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('vote');
    expect(mai.vote(kenVersion)).toBe(true);
    await flush();

    const expected = {
      [maiId]: ARTIST_POINTS * 2,
      [kenId]: VOTE_POINTS * 2 + WIN_POINTS,
      [lanId]: VOTE_POINTS,
    };
    for (const session of sessions) {
      const state = session.getSnapshot().state;
      expect(state.phase).toBe('result');
      expect(state.authors).toEqual({ [kenVersion]: kenId, [lanVersion]: lanId });
      expect(state.winners).toEqual([kenVersion]);
      expect(state.scores).toEqual(expected);
    }

    advance(RESULT_MS);
    await flush();
    expect(lan.getSnapshot().state.turn).toBe(1);
    expect(lan.getSnapshot().state.artist).toBe(kenId);
    expect(lan.getSnapshot().state.strokes).toEqual([]);
    expect(lan.getSnapshot().draft).toEqual([]);
  });

  it('sends the panel and the typed lines when time runs out, and closes the vote on time', async () => {
    const { sessions, ids, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    const [, kenId] = ids();
    mai.begin(1, 60, 45);
    await flush();

    // Mai never presses done and never placed a bubble: her phone sends the panel with one bubble.
    advance(60000);
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('writing');
    expect(lan.getSnapshot().state.bubbles).toHaveLength(1);

    // Ken types but never presses send; Lan writes nothing.
    ken.setLine(0, 'Typed in time');
    advance(45000);
    await flush();
    expect(mai.getSnapshot().state.wrote).toEqual([kenId]);
    expect(mai.getSnapshot().state.phase).toBe('writing');
    advance(LINES_GRACE_MS);
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('reveal');
    expect(lan.getSnapshot().state.versions).toEqual([{ id: ken.getSnapshot().mine, lines: ['Typed in time'] }]);

    // One version: Ken has nothing to vote for, Mai and Lan do.
    advance(SHOW_MS);
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('vote');
    expect(lan.vote(ken.getSnapshot().mine!)).toBe(true);
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('vote');
    advance(VOTE_MS);
    await flush();
    expect(ken.getSnapshot().state.phase).toBe('result');
    expect(ken.getSnapshot().state.turnScores[kenId]).toBe(VOTE_POINTS + WIN_POINTS);
  });

  it('skips the turn when the artist leaves while drawing, and the next artist plays', async () => {
    const { sessions, phones, ids, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    const [, kenId, lanId] = ids();
    mai.begin(1, 60, 45);
    await flush();
    mai.finish();
    await flush();
    ken.setLine(0, 'a');
    ken.submit();
    lan.setLine(0, 'b');
    lan.submit();
    await flush();
    advance(2 * SHOW_MS);
    await flush();
    mai.vote(ken.getSnapshot().mine!);
    ken.vote(lan.getSnapshot().mine!);
    lan.vote(ken.getSnapshot().mine!);
    await flush();
    advance(RESULT_MS);
    await flush();
    expect(lan.getSnapshot().state.artist).toBe(kenId);

    ken.stop();
    phones[1].getState().leaveRoom();
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('result');
    expect(lan.getSnapshot().state.skipped).toBe(true);

    advance(SKIP_MS);
    await flush();
    expect(lan.getSnapshot().state.artist).toBe(lanId);
    expect(lan.getSnapshot().state.phase).toBe('drawing');
  });

  it('skips an artist whose panel never arrives', async () => {
    const { sessions, ids, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    mai.begin(1, 60, 45);
    await flush();
    await quietTurn(sessions, flush, advance);
    expect(lan.getSnapshot().state.artist).toBe(ids()[1]);
    // Ken's phone freezes: it never sends the panel, so the host moves on after the grace.
    ken.stop();
    advance(60000);
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('drawing');
    advance(DONE_GRACE_MS);
    await flush();
    expect(lan.getSnapshot().state.skipped).toBe(true);
    expect(mai.getSnapshot().state.phase).toBe('result');
  });

  it('does not wait for a writer who leaves', async () => {
    const { sessions, phones, flush } = await game();
    const [mai, ken, lan] = sessions;
    mai.begin(1, 60, 45);
    await flush();
    mai.finish();
    await flush();
    ken.setLine(0, 'Still here');
    ken.submit();
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('writing');

    lan.stop();
    phones[2].getState().leaveRoom();
    await flush();
    expect(ken.getSnapshot().state.phase).toBe('reveal');
    expect(ken.getSnapshot().state.versions).toHaveLength(1);
  });

  it('closes the vote when someone who has not voted leaves', async () => {
    const { sessions, phones, ids, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    const [, kenId] = ids();
    mai.begin(1, 60, 45);
    await flush();
    mai.finish();
    await flush();
    ken.setLine(0, 'one');
    ken.submit();
    lan.setLine(0, 'two');
    lan.submit();
    await flush();
    advance(2 * SHOW_MS);
    await flush();
    mai.vote(ken.getSnapshot().mine!);
    lan.vote(ken.getSnapshot().mine!);
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('vote');

    ken.stop();
    phones[1].getState().leaveRoom();
    await flush();
    const state = lan.getSnapshot().state;
    expect(state.phase).toBe('result');
    // Ken left, but his version was written and voted for: it still counts.
    expect(state.turnScores[kenId]).toBe(VOTE_POINTS * 2 + WIN_POINTS);
  });

  it('keeps going when the artist leaves after the panel is sent', async () => {
    const { sessions, phones, ids, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    const [maiId, kenId, lanId] = ids();
    mai.begin(1, 60, 45);
    await flush();
    await quietTurn(sessions, flush, advance);
    ken.addBubble('think');
    ken.finish();
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('writing');

    ken.stop();
    phones[1].getState().leaveRoom();
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('writing');
    mai.setLine(0, 'from the host');
    mai.submit();
    lan.setLine(0, 'from Lan');
    lan.submit();
    await flush();
    expect(lan.getSnapshot().state.phase).toBe('reveal');
    advance(2 * SHOW_MS);
    await flush();
    mai.vote(lan.getSnapshot().mine!);
    lan.vote(mai.getSnapshot().mine!);
    await flush();
    const state = mai.getSnapshot().state;
    expect(state.phase).toBe('result');
    expect(state.winners).toHaveLength(2);
    expect(state.turnScores).toEqual({ [maiId]: VOTE_POINTS + WIN_POINTS, [lanId]: VOTE_POINTS + WIN_POINTS, [kenId]: ARTIST_POINTS * 2 });
  });

  it('lets a late joiner watch without writing or voting, and ends the game the same everywhere', async () => {
    const { sessions, phones, address, ids, flush, advance } = await game(4);
    const [mai, ken, lan, late] = sessions;
    const [maiId, kenId, lanId] = ids();
    mai.begin(1, 60, 45);
    await flush();
    await phones[3].getState().joinRoom(address, 'Late');
    await flush();
    const lateId = phones[3].getState().me!.id;
    expect(mai.getSnapshot().state.order).toEqual([maiId, kenId, lanId]);

    mai.finish();
    await flush();
    // The late phone tries anyway, straight through the room: the host ignores it.
    phones[3].getState().send({ t: 'fill.lines', turn: 0, id: 'sneaky', lines: ['let me in'] }, maiId);
    ken.setLine(0, 'k');
    ken.submit();
    lan.setLine(0, 'l');
    lan.submit();
    await flush();
    expect(mai.getSnapshot().state.versions.map(version => version.id)).not.toContain('sneaky');
    expect(mai.getSnapshot().state.wrote).not.toContain(lateId);
    expect(late.getSnapshot().state.phase).toBe('idle');

    advance(2 * SHOW_MS);
    await flush();
    phones[3].getState().send({ t: 'fill.vote', turn: 0, version: ken.getSnapshot().mine! });
    await flush();
    expect(mai.getSnapshot().state.votes).toEqual({});
    mai.vote(lan.getSnapshot().mine!);
    ken.vote(lan.getSnapshot().mine!);
    lan.vote(ken.getSnapshot().mine!);
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('result');

    // Ken's and Lan's turns, with nobody doing anything: panels go out alone, nobody writes, turns move on.
    for (let turn = 1; turn < 3; turn++) {
      advance(RESULT_MS);
      await flush();
      expect(mai.getSnapshot().state.turn).toBe(turn);
      advance(60000);
      await flush();
      advance(45000 + LINES_GRACE_MS);
      await flush();
      expect(mai.getSnapshot().state.phase).toBe('result');
      expect(mai.getSnapshot().state.versions).toEqual([]);
    }
    advance(RESULT_MS);
    await flush();
    for (const session of [mai, ken, lan]) {
      expect(session.getSnapshot().state.phase).toBe('over');
      expect(session.getSnapshot().state.final).toEqual({
        [maiId]: ARTIST_POINTS * 2,
        [kenId]: VOTE_POINTS,
        [lanId]: VOTE_POINTS * 2 + WIN_POINTS,
      });
    }
  });

  it('ends the game when fewer than two players are left', async () => {
    const { sessions, phones, flush, advance } = await game();
    const [mai, ken, lan] = sessions;
    mai.begin(2, 60, 45);
    await flush();
    ken.stop();
    lan.stop();
    phones[1].getState().leaveRoom();
    phones[2].getState().leaveRoom();
    await flush();
    mai.finish();
    await flush();
    // No writers left: the writing ends at once with no versions, and the next turn finds nobody to play.
    expect(mai.getSnapshot().state.phase).toBe('result');
    advance(RESULT_MS);
    await flush();
    expect(mai.getSnapshot().state.phase).toBe('over');
  });
});
