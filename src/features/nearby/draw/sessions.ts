/**
 * The drawing activities listen to the room from the moment the app loads, not from when their screen
 * opens: the host starts a relay or a battle and the first message is already on its way while the
 * guests' screens are still opening. The screens only read these.
 */
import { useSyncExternalStore } from 'react';

import { BattleSession, type BattleSnapshot } from '../../../core/nearby/battleSession';
import { GuessSession, type GuessSnapshot } from '../../../core/nearby/guessSession';
import { RelaySession, type RelaySnapshot } from '../../../core/nearby/relaySession';
import { ScriptSession, type ScriptSnapshot } from '../../../core/nearby/scriptSession';
import { realClock } from '../../../core/nearby/transport';
import { useRoom } from '../../../state/useRoom';
import { CoDrawSession, type CoDrawSnapshot } from '../codraw/coDrawSession';
import { guessWords } from '../guess/guessWords';

export const relaySession = new RelaySession(useRoom).start();
// The room measures the host clock against ours on every ping, so everyone starts the timer together.
export const battleSession = new BattleSession(useRoom, realClock, () => useRoom.getState().clockOffset ?? undefined).start();
export const coDrawSession = new CoDrawSession(useRoom).start();
export const guessSession = new GuessSession(useRoom, guessWords).start();
export const scriptSession = new ScriptSession(useRoom).start();

// Leaving the room, or the room moving on to something else, forgets the finished activity.
useRoom.subscribe((state, previous) => {
  const left = state.status === 'idle' && previous.status !== 'idle';
  const was = previous.room?.activity;
  const now = state.room?.activity;
  if (left || (was === 'relay' && now !== 'relay')) {
    relaySession.reset();
  }
  if (left || (was === 'battle' && now !== 'battle')) {
    battleSession.reset();
  }
  if (left || (was === 'codraw' && now !== 'codraw')) {
    coDrawSession.reset();
  }
  if (left || (was === 'guess' && now !== 'guess')) {
    guessSession.reset();
  }
  if (left || (was === 'script' && now !== 'script')) {
    scriptSession.reset();
  }
});

export function useRelay(): RelaySnapshot {
  return useSyncExternalStore(relaySession.subscribe, relaySession.getSnapshot);
}

export function useBattle(): BattleSnapshot {
  return useSyncExternalStore(battleSession.subscribe, battleSession.getSnapshot);
}

export function useCoDraw(): CoDrawSnapshot {
  return useSyncExternalStore(coDrawSession.subscribe, coDrawSession.getSnapshot);
}

export function useGuess(): GuessSnapshot {
  return useSyncExternalStore(guessSession.subscribe, guessSession.getSnapshot);
}

export function useScriptTogether(): ScriptSnapshot {
  return useSyncExternalStore(scriptSession.subscribe, scriptSession.getSnapshot);
}
