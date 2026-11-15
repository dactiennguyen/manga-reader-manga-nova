import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { Locale } from '../../core/i18n';
import { dayKey, dayKeyToDate } from '../../core/util/time';
import { widgetSnapshot } from '../../core/widget/snapshot';
import { updateWidget } from '../../native/widget';
import { useActivity } from '../../state/useActivity';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { useStudio } from '../../state/useStudio';

/** Every pen lift changes the stores, so updates wait for a pause in the stream. */
const PUSH_DELAY_MS = 3000;

let lastPushed = '';

function buildSnapshot(): string {
  const today = dayKey();
  const settings = useSettings.getState();
  return JSON.stringify(
    widgetSnapshot({
      state: useStory.getState(),
      activity: useActivity.getState(),
      goal: settings.dailyGoal,
      promptDone: !!useStudio.getState().promptDays[today],
      today,
      theme: settings.themeMode,
    }),
  );
}

function push(): void {
  const next = buildSnapshot();
  if (next !== lastPushed) {
    lastPushed = next;
    updateWidget(next);
  }
}

function msUntilTomorrow(): number {
  const tomorrow = dayKeyToDate(dayKey());
  tomorrow.setDate(tomorrow.getDate() + 1);
  // A second past midnight, so dayKey() already gives the new day.
  return Math.max(1000, tomorrow.getTime() - Date.now() + 1000);
}

/**
 * Keeps the home screen widget in step with the streak, today's strokes, the daily goal, today's prompt, the
 * theme and the language. Starts again when the language changes, because the widget's text is made here.
 */
export function useWidgetSync(locale: Locale): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let midnight: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      timer ??= setTimeout(() => {
        timer = null;
        push();
      }, PUSH_DELAY_MS);
    };
    const now = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      push();
    };
    const armMidnight = () => {
      midnight = setTimeout(() => {
        now();
        armMidnight();
      }, msUntilTomorrow());
    };
    now();
    armMidnight();
    const unsubscribe = [useStory, useActivity, useSettings, useStudio].map(store => store.subscribe(later));
    // Leaving the app pushes at once, so the widget is current when the home screen shows; coming back may be a
    // new day.
    const appState = AppState.addEventListener('change', now);
    return () => {
      unsubscribe.forEach(stop => stop());
      appState.remove();
      if (timer) {
        clearTimeout(timer);
      }
      if (midnight) {
        clearTimeout(midnight);
      }
    };
  }, [locale]);
}
