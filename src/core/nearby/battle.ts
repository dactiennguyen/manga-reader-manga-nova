/**
 * Speed battle: one prompt, one timer, everyone draws, then everyone votes for a drawing that is not
 * their own. Every phone follows the same messages through `reduceBattle`; the host also closes the vote
 * and announces the scores.
 */
import { GENERIC_PROMPTS } from '../studio/promptLines';
import type { MemberId, Message } from './types';

export const BATTLE_MINUTES = [3, 5, 10] as const;
/** The 3-2-1 before the clock starts, so every phone can be ready at the same moment. */
export const START_LEAD_MS = 3500;
/** Drawings are sent when time is up; slow phones get this long before voting starts without them. */
export const SUBMIT_GRACE_MS = 12000;
/** Voting closes when everyone has voted, or after this long. */
export const VOTE_MS = 90000;

export type BattlePhase = 'idle' | 'countdown' | 'drawing' | 'sending' | 'voting' | 'results';

export type BattleState = {
  started: boolean;
  prompt: string;
  seconds: number;
  /** On this phone's clock. */
  startsAt: number;
  endsAt: number;
  /** Who was in the room when it started: the ones expected to draw and vote. */
  players: MemberId[];
  submissions: Record<MemberId, string>;
  votes: Record<MemberId, MemberId>;
  scores: Record<MemberId, number> | null;
};

export const INITIAL_BATTLE: BattleState = {
  started: false,
  prompt: '',
  seconds: 0,
  startsAt: 0,
  endsAt: 0,
  players: [],
  submissions: {},
  votes: {},
  scores: null,
};

/** Drawing prompts from the studio's generic set, before any {placeholder} is filled. */
export function battlePrompts(): string[] {
  return GENERIC_PROMPTS.filter(line => line.kind === 'draw' && !line.text.includes('{')).map(line => line.text);
}

export function cleanPrompt(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * The host's clock minus ours, from one start message: the host set `startsAt` START_LEAD_MS after it
 * sent the message, and on a local network the message arrives within a few milliseconds. A better
 * offset from a ping round trip, when the room has one, replaces this estimate.
 */
export function offsetFromStart(startsAt: number, receivedAt: number): number {
  return startsAt - START_LEAD_MS - receivedAt;
}

/** Keeps the sample with the shortest round trip: its middle is the closest to the host's moment. */
export function offsetFromPing(sentAt: number, hostAt: number, receivedAt: number): { offset: number; rtt: number } {
  return { offset: hostAt - (sentAt + receivedAt) / 2, rtt: receivedAt - sentAt };
}

export function startMessage(prompt: string, minutes: number, hostNow: number): Message {
  return { t: 'battle.start', prompt: cleanPrompt(prompt), seconds: minutes * 60, startsAt: hostNow + START_LEAD_MS };
}

export function reduceBattle(
  state: BattleState,
  message: Message,
  from: MemberId,
  context: { receivedAt: number; offset?: number; members: MemberId[] },
): BattleState {
  switch (message.t) {
    case 'battle.start': {
      const offset = context.offset ?? offsetFromStart(message.startsAt, context.receivedAt);
      const startsAt = message.startsAt - offset;
      return {
        ...INITIAL_BATTLE,
        started: true,
        prompt: cleanPrompt(message.prompt),
        seconds: message.seconds,
        startsAt,
        endsAt: startsAt + message.seconds * 1000,
        players: context.members,
      };
    }
    case 'battle.submit':
      if (!state.started || !state.players.includes(from) || state.scores) {
        return state;
      }
      return { ...state, submissions: { ...state.submissions, [from]: message.blobId } };
    case 'battle.vote':
      if (!canVoteFor(state, from, message.for) || state.scores) {
        return state;
      }
      return { ...state, votes: { ...state.votes, [from]: message.for } };
    case 'battle.result':
      return state.started ? { ...state, scores: message.scores } : state;
    case 'bye':
      return state.started ? { ...state, players: state.players.filter(id => id !== from) } : state;
    default:
      return state;
  }
}

/** Not for yourself, and only for a drawing that arrived. */
export function canVoteFor(state: BattleState, voter: MemberId, target: MemberId): boolean {
  return voter !== target && state.players.includes(voter) && !!state.submissions[target];
}

/** Someone can vote when there is at least one drawing that is not theirs. */
export function hasChoice(state: BattleState, voter: MemberId): boolean {
  return Object.keys(state.submissions).some(id => id !== voter);
}

export function battlePhase(state: BattleState, now: number): BattlePhase {
  if (!state.started) {
    return 'idle';
  }
  if (state.scores) {
    return 'results';
  }
  if (now < state.startsAt) {
    return 'countdown';
  }
  // Everyone has sent: no point waiting for the clock.
  const everyone = state.players.length > 0 && state.players.every(id => state.submissions[id]);
  if (everyone || now >= state.endsAt + SUBMIT_GRACE_MS) {
    return 'voting';
  }
  return now < state.endsAt ? 'drawing' : 'sending';
}

/** Every player who can vote has voted: the host may close the vote early. */
export function votingDone(state: BattleState): boolean {
  return state.players.filter(id => hasChoice(state, id)).every(id => state.votes[id]);
}

/** One point per vote; every drawing is listed, with nothing if nobody picked it. */
export function tally(state: Pick<BattleState, 'submissions' | 'votes'>): Record<MemberId, number> {
  const scores: Record<MemberId, number> = {};
  Object.keys(state.submissions).forEach(id => {
    scores[id] = 0;
  });
  Object.entries(state.votes).forEach(([voter, target]) => {
    if (voter !== target && target in scores) {
      scores[target] += 1;
    }
  });
  return scores;
}

export type Placing = { member: MemberId; score: number; rank: number };

/** Highest first. Ties share a place and the next place is skipped: 1, 1, 3. */
export function ranking(scores: Record<MemberId, number>): Placing[] {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted.map(([member, score]) => ({
    member,
    score,
    rank: sorted.findIndex(([, other]) => other === score) + 1,
  }));
}
