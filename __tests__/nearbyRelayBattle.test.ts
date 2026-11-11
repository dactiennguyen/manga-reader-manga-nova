import {
  INITIAL_BATTLE,
  SUBMIT_GRACE_MS,
  START_LEAD_MS,
  VOTE_MS,
  battlePhase,
  battlePrompts,
  offsetFromPing,
  offsetFromStart,
  ranking,
  reduceBattle,
  tally,
  votingDone,
} from '../src/core/nearby/battle';
import { BattleSession } from '../src/core/nearby/battleSession';
import { base64ToJson, jsonToBase64 } from '../src/core/nearby/drawPayload';
import { createLoopbackPhones } from '../src/core/nearby/loopback';
import {
  INITIAL_RELAY,
  RELAY_GRACE_MS,
  drawerFor,
  previousPanel,
  readRelaySetup,
  reduceRelay,
  relayCredits,
  type RelaySetup,
} from '../src/core/nearby/relay';
import { RelaySession } from '../src/core/nearby/relaySession';
import type { Clock } from '../src/core/nearby/transport';

/** Real zero-delay timers (the loopback needs them), hand-advanced long ones (turns, votes). */
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

async function room3() {
  const loop = createLoopbackPhones(3);
  const [host, ken, lan] = loop.phones;
  const address = await host.getState().hostRoom('Mai');
  await ken.getState().joinRoom(address, 'Ken');
  await lan.getState().joinRoom(address, 'Lan');
  await loop.flush();
  const ids = [host, ken, lan].map(phone => phone.getState().me!.id);
  return { ...loop, host, ken, lan, ids };
}

describe('relay rules', () => {
  const setup: RelaySetup = { templateId: 'g3-rows', order: ['a', 'b'], seconds: 60 };

  it('goes round the order and passes over someone who left', () => {
    expect(drawerFor(setup, 0, ['a', 'b'])).toBe('a');
    expect(drawerFor(setup, 2, ['a', 'b'])).toBe('a');
    expect(drawerFor(setup, 1, ['a'])).toBe('a');
    expect(drawerFor(setup, 1, [])).toBeNull();
  });

  it('only takes the picture of the person whose turn it is', () => {
    let state = reduceRelay(INITIAL_RELAY, { t: 'relay.turn', member: 'a', panelIndex: 0, deadline: 1 }, 'host');
    state = reduceRelay(state, { t: 'relay.done', from: 'b', panelIndex: 0, blobId: 'x' }, 'b');
    expect(state.done).toEqual({});
    state = reduceRelay(state, { t: 'relay.done', from: 'a', panelIndex: 0, blobId: 'x' }, 'a');
    expect(state.done[0]).toEqual({ from: 'a', blobId: 'x' });
  });

  it('shows the last finished panel, skipping a missing one', () => {
    const state = { ...INITIAL_RELAY, done: { 0: { from: 'a', blobId: 'p0' } } };
    expect(previousPanel(state, 2)).toEqual({ from: 'a', blobId: 'p0', panelIndex: 0 });
    expect(previousPanel(state, 0)).toBeNull();
    expect(relayCredits(state, 3)).toEqual(['a', null, null]);
  });

  it('refuses a malformed setup', () => {
    expect(readRelaySetup({ relay: { templateId: 'nope', order: ['a'] } })).toBeNull();
    expect(readRelaySetup({ relay: { templateId: 'g2-rows', order: [] } })).toBeNull();
    expect(readRelaySetup({ relay: { templateId: 'g2-rows', order: ['a', 'a'], seconds: 7 } })).toEqual({
      templateId: 'g2-rows',
      order: ['a'],
      seconds: 120,
    });
  });
});

describe('relay on three phones', () => {
  it('runs every turn, skips a drawer who runs out of time, and reveals on every phone', async () => {
    const { host, ken, lan, ids, flush } = await room3();
    const { clock, advance } = manualClock();
    const sessions = [host, ken, lan].map(phone => new RelaySession(phone, clock).start());
    const setup: RelaySetup = { templateId: 'g4-grid', order: [ids[1], ids[2], ids[0]], seconds: 60 };
    sessions[0].begin(setup);
    await flush();
    sessions.forEach(session => expect(session.getSnapshot().state.turn?.member).toBe(ids[1]));
    expect(sessions[1].getSnapshot().deadline).toBe(clock.now() + 60000);

    await sessions[1].submit(0, 'AAAA');
    await flush();
    sessions.forEach(session => expect(session.getSnapshot().state.turn).toMatchObject({ member: ids[2], panelIndex: 1 }));
    // The next drawer has the picture of panel 0 before their turn begins.
    const seen = previousPanel(sessions[2].getSnapshot().state, 1)!;
    expect(sessions[2].getSnapshot().images[seen.blobId]).toBe('AAAA');

    // Lan never finishes: after the deadline and the grace, the host moves on to Mai.
    advance(60000 + RELAY_GRACE_MS);
    await flush();
    sessions.forEach(session => expect(session.getSnapshot().state.turn).toMatchObject({ member: ids[0], panelIndex: 2 }));

    await sessions[0].submit(2, 'BBBB');
    await flush();
    expect(sessions[0].getSnapshot().state.turn).toMatchObject({ member: ids[1], panelIndex: 3 });

    // Ken leaves in the middle of his turn: nobody else is due, so Lan takes the last panel.
    ken.getState().leaveRoom();
    await flush();
    expect(sessions[0].getSnapshot().state.turn).toMatchObject({ member: ids[2], panelIndex: 3 });
    await sessions[2].submit(3, 'CCCC');
    await flush();
    for (const index of [0, 2]) {
      const snap = sessions[index].getSnapshot();
      expect(snap.state.phase).toBe('reveal');
      expect(relayCredits(snap.state, 4)).toEqual([ids[1], null, ids[0], ids[2]]);
      expect(Object.values(snap.images).sort()).toEqual(['AAAA', 'BBBB', 'CCCC']);
    }
    sessions.forEach(session => session.stop());
    host.getState().leaveRoom();
    lan.getState().leaveRoom();
  });
});

describe('battle rules', () => {
  const started = reduceBattle(
    INITIAL_BATTLE,
    { t: 'battle.start', prompt: '  Draw a cat  ', seconds: 180, startsAt: 5000 + START_LEAD_MS },
    'h',
    { receivedAt: 2000, members: ['h', 'a', 'b'] },
  );

  it('starts on this phone at the same moment as on the host', () => {
    // Host clock is 3000 ms ahead: its "now" was 5000 when ours was 2000.
    expect(offsetFromStart(5000 + START_LEAD_MS, 2000)).toBe(3000);
    expect(started.startsAt).toBe(2000 + START_LEAD_MS);
    expect(started.endsAt).toBe(started.startsAt + 180000);
    expect(started.prompt).toBe('Draw a cat');
    expect(offsetFromPing(100, 3150, 200)).toEqual({ offset: 3000, rtt: 100 });
  });

  it('moves through the phases with time', () => {
    expect(battlePhase(started, started.startsAt - 1)).toBe('countdown');
    expect(battlePhase(started, started.startsAt)).toBe('drawing');
    expect(battlePhase(started, started.endsAt + 1)).toBe('sending');
    expect(battlePhase(started, started.endsAt + SUBMIT_GRACE_MS)).toBe('voting');
    // Everyone sent early: voting starts at once, not when the clock runs out.
    const allIn = { ...started, submissions: { h: '1', a: '2', b: '3' } };
    expect(battlePhase(allIn, started.startsAt + 1000)).toBe('voting');
  });

  it('refuses a vote for yourself or for a drawing that never came', () => {
    let state = reduceBattle(started, { t: 'battle.submit', from: 'a', blobId: 'x' }, 'a', { receivedAt: 0, members: [] });
    state = reduceBattle(state, { t: 'battle.vote', from: 'a', for: 'a' }, 'a', { receivedAt: 0, members: [] });
    state = reduceBattle(state, { t: 'battle.vote', from: 'h', for: 'b' }, 'h', { receivedAt: 0, members: [] });
    expect(state.votes).toEqual({});
    state = reduceBattle(state, { t: 'battle.vote', from: 'h', for: 'a' }, 'h', { receivedAt: 0, members: [] });
    expect(state.votes).toEqual({ h: 'a' });
  });

  it('tallies votes and shares places on a tie', () => {
    const scores = tally({ submissions: { a: '1', b: '2', c: '3', d: '4' }, votes: { a: 'b', b: 'a', c: 'a', d: 'b' } });
    expect(scores).toEqual({ a: 2, b: 2, c: 0, d: 0 });
    expect(ranking(scores)).toEqual([
      { member: 'a', score: 2, rank: 1 },
      { member: 'b', score: 2, rank: 1 },
      { member: 'c', score: 0, rank: 3 },
      { member: 'd', score: 0, rank: 3 },
    ]);
  });

  it('knows when everyone who can vote has voted', () => {
    const state = { ...started, submissions: { a: '1' }, votes: { h: 'a', b: 'a' } };
    // Only Aki drew, so Aki has nothing to vote for and is not waited on.
    expect(votingDone(state)).toBe(true);
    expect(votingDone({ ...state, votes: { h: 'a' } })).toBe(false);
  });

  it('offers only prompts with nothing left to fill in', () => {
    expect(battlePrompts().length).toBeGreaterThan(5);
    battlePrompts().forEach(prompt => expect(prompt).not.toContain('{'));
  });
});

describe('battle on three phones', () => {
  it('starts together, gathers drawings, closes the vote and agrees on the scores', async () => {
    const { host, ken, lan, ids, flush } = await room3();
    const { clock, advance } = manualClock();
    const sessions = [host, ken, lan].map(phone => new BattleSession(phone, clock).start());
    sessions[0].begin('Draw a door that should not be opened.', 3);
    await flush();
    const starts = sessions.map(session => session.getSnapshot().state.startsAt);
    expect(new Set(starts).size).toBe(1);
    expect(battlePhase(sessions[1].getSnapshot().state, clock.now())).toBe('countdown');

    advance(START_LEAD_MS + 180000);
    await Promise.all([sessions[0].submit('H'), sessions[1].submit('K'), sessions[2].submit('L')]);
    await flush();
    const state = sessions[2].getSnapshot().state;
    expect(battlePhase(state, clock.now())).toBe('voting');
    expect(Object.keys(state.submissions).sort()).toEqual([...ids].sort());
    expect(Object.values(sessions[2].getSnapshot().images).sort()).toEqual(['H', 'K', 'L']);

    expect(sessions[1].vote(ids[1])).toBe(false);
    sessions[0].vote(ids[1]);
    sessions[1].vote(ids[0]);
    await flush();
    expect(sessions[0].getSnapshot().state.scores).toBeNull();
    sessions[2].vote(ids[1]);
    await flush();
    for (const session of sessions) {
      expect(session.getSnapshot().state.scores).toEqual({ [ids[0]]: 1, [ids[1]]: 2, [ids[2]]: 0 });
    }
    sessions.forEach(session => session.stop());
    [host, ken, lan].forEach(phone => phone.getState().leaveRoom());
  });

  it('closes the vote on time when someone never votes', async () => {
    const { host, ken, lan, ids, flush } = await room3();
    const { clock, advance } = manualClock();
    const sessions = [host, ken, lan].map(phone => new BattleSession(phone, clock).start());
    sessions[0].begin('Draw a cat', 3);
    await flush();
    advance(START_LEAD_MS + 180000);
    await sessions[1].submit('K');
    await flush();
    advance(SUBMIT_GRACE_MS + 100);
    sessions[0].vote(ids[1]);
    await flush();
    expect(sessions[0].getSnapshot().state.scores).toBeNull();
    advance(VOTE_MS);
    await flush();
    expect(sessions[1].getSnapshot().state.scores).toEqual({ [ids[1]]: 1 });
    sessions.forEach(session => session.stop());
    [host, ken, lan].forEach(phone => phone.getState().leaveRoom());
  });
});

describe('page payloads', () => {
  it('round-trips text in any language through base64', async () => {
    const value = { name: 'Mai 🌸 Tiếng Việt 日本語', points: [1.5, 2, 3] };
    expect(await base64ToJson(await jsonToBase64(value))).toEqual(value);
    expect(await base64ToJson('not base64!')).toBeNull();
  });
});
