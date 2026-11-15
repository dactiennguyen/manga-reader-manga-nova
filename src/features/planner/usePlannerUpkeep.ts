import { useEffect } from 'react';
import { AppState } from 'react-native';

import { usePlanner } from '../../state/usePlanner';
import { syncReminder } from '../profile/reminder';

/**
 * Keeps the planner current while the app runs: today's planned pages are noted when the app comes back
 * (it may be a new day), and the reminder text follows the plans. It is set again when the app leaves, so
 * the pages finished today are in it.
 */
export function usePlannerUpkeep(): void {
  useEffect(() => {
    const sync = () => {
      syncReminder().catch(() => undefined);
    };
    const appState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        usePlanner.getState().noteToday();
      } else {
        sync();
      }
    });
    const plans = usePlanner.subscribe((state, previous) => {
      if (state.plans !== previous.plans) {
        sync();
      }
    });
    return () => {
      appState.remove();
      plans();
    };
  }, []);
}
