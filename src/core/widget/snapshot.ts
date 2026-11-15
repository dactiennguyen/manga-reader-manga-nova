/**
 * What the home screen widget shows. The widget cannot run JavaScript, so the app works everything out here,
 * in the language in use, and hands it over as one JSON text. The widget also has to be right after midnight
 * without the app, so the snapshot carries three versions: the day it was made, the next day, and any later
 * day. The widget picks one by comparing its own date with `day`.
 */
import { msg, t, tn } from '../i18n';
import type { StoryData } from '../model/types';
import { currentStreak, shiftDay, type Activity } from '../story/activity';
import { dailyPrompt } from '../studio/prompts';

export const WIDGET_SNAPSHOT_VERSION = 1;

export type WidgetTheme = 'system' | 'light' | 'dark';

/** One day as the widget shows it. Empty text means the widget leaves that line out. */
export type WidgetDay = {
  streak: number;
  /** "5 days" */
  streakText: string;
  drawn: number;
  /** 0 when the daily goal is off. */
  goal: number;
  /** Today's strokes against the goal, 0 to 1. */
  progress: number;
  goalMet: boolean;
  /** "40/100 today", or "40 strokes today" without a goal. */
  progressText: string;
  /** A short push to draw, shown while nothing is drawn yet that day. */
  nudge: string;
  /** Today's prompt. Empty when it is not known (more than a day after the snapshot). */
  prompt: string;
  /** "Done for today" once the prompt is marked done. */
  promptDone: string;
};

export type WidgetSnapshot = {
  version: number;
  /** The day the snapshot was made, as a day key (2026-11-15). */
  day: string;
  /** The app's theme choice. `system` follows the phone. */
  theme: WidgetTheme;
  streakTitle: string;
  promptTitle: string;
  /** Stands in for the prompt when it is not known. */
  promptMissing: string;
  today: WidgetDay;
  tomorrow: WidgetDay;
  later: WidgetDay;
};

export type WidgetInput = {
  state: StoryData;
  activity: Activity;
  /** Strokes to draw each day. 0 turns the goal off. */
  goal: number;
  /** True when a prompt is marked done on `today`. */
  promptDone: boolean;
  today: string;
  theme: WidgetTheme;
};

const KEEP_GOING = msg('A few strokes today keep your streak going.');
const FRESH_START = msg('Fresh start today. One small drawing begins a new streak.');

function dayOf(streak: number, drawn: number, goal: number, prompt: string, promptDone: boolean): WidgetDay {
  const safeGoal = Math.max(0, Math.floor(goal));
  return {
    streak,
    streakText: tn(streak, '{count} day', '{count} days'),
    drawn,
    goal: safeGoal,
    progress: safeGoal > 0 ? Math.min(1, drawn / safeGoal) : 0,
    goalMet: safeGoal > 0 && drawn >= safeGoal,
    progressText: safeGoal > 0 ? t('{drawn}/{goal} today', { drawn, goal: safeGoal }) : tn(drawn, '{count} stroke today', '{count} strokes today'),
    nudge: drawn > 0 ? '' : t(streak > 0 ? KEEP_GOING : FRESH_START),
    prompt,
    promptDone: promptDone ? t('Done for today') : '',
  };
}

export function widgetSnapshot({ state, activity, goal, promptDone, today, theme }: WidgetInput): WidgetSnapshot {
  const drawn = activity.days[today] ?? 0;
  const streak = currentStreak(activity, today);
  // Not drawing today breaks the streak at midnight; drawing today carries it into tomorrow.
  const tomorrowStreak = drawn > 0 ? streak : 0;
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    day: today,
    theme,
    streakTitle: t('Drawing streak'),
    promptTitle: t("Today's prompt"),
    promptMissing: t("Open Manganova for today's prompt."),
    today: dayOf(streak, drawn, goal, dailyPrompt(state, today).text, promptDone),
    tomorrow: dayOf(tomorrowStreak, 0, goal, dailyPrompt(state, shiftDay(today, 1)).text, false),
    later: dayOf(0, 0, goal, '', false),
  };
}

/** Which of the snapshot's days to show on `now` (a day key). A clock set back shows the snapshot's own day. */
export function widgetDayFor(snapshot: WidgetSnapshot, now: string): WidgetDay {
  if (now <= snapshot.day) {
    return snapshot.today;
  }
  return now === shiftDay(snapshot.day, 1) ? snapshot.tomorrow : snapshot.later;
}
