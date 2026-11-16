import { t } from '../../core/i18n';
import { chapterName, chapterNumber } from '../../core/model/selectors';
import { planViews } from '../../core/planner/data';
import { addDays } from '../../core/planner/days';
import { deadlineReminders, dueNear, planReminderText } from '../../core/planner/words';
import { dayKey } from '../../core/util/time';
import { cancelReminder, replaceOnceReminders, scheduleReminder, type OnceReminder } from '../../native/reminder';
import { usePlanner } from '../../state/usePlanner';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';

export const REMINDER_TIMES = [8, 12, 18, 20, 21, 22];

export function timeLabel(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** What was last handed to the system, so a sync with nothing new does not schedule again. */
let scheduled = '';

/**
 * The daily notification body and the one-off notices for the day before each deadline. With a chapter
 * plan the body names the next reminder's pages or a deadline close to it; otherwise the usual streak
 * line. A deadline the daily body already names gets no one-off on that day.
 */
function reminderTexts(hour: number, minute: number, now = new Date()): { body: string; once: OnceReminder[] } {
  const today = dayKey(now.getTime());
  const fireDay = now.getHours() * 60 + now.getMinutes() < hour * 60 + minute ? today : addDays(today, 1);
  const state = useStory.getState();
  const items = planViews(usePlanner.getState(), state, today);
  const nameOf = (chapterId: string) => {
    const chapter = state.chapters[chapterId];
    return chapter ? chapterName(chapter.title, chapterNumber(state.projects[chapter.projectId], chapterId)) : '';
  };
  const named = dueNear(items, fireDay);
  const title = t('Time to draw');
  const once = deadlineReminders(items, nameOf, {
    now: now.getTime(),
    hour,
    minute,
    skip: named ? { day: fireDay, chapterId: named.plan.chapterId } : undefined,
  }).map(item => ({ id: item.id, at: item.at, title, body: item.body }));
  return { body: planReminderText(items, nameOf, fireDay, today) ?? t('A few strokes today keep your streak going.'), once };
}

/**
 * Makes the system reminders match the settings: the daily one, and a one-off the day before each chapter
 * deadline. The notification text is fixed when it is scheduled, so this also runs at startup, after a
 * language change, when a plan changes and when the app goes to the background, to keep the text in the
 * right language and on today's plan.
 */
export async function syncReminder(ask = false): Promise<boolean> {
  const { reminderOn, reminderHour } = useSettings.getState();
  if (!reminderOn) {
    scheduled = '';
    cancelReminder();
    await replaceOnceReminders([]);
    return true;
  }
  const minute = 0;
  const { body, once } = reminderTexts(reminderHour, minute);
  const text = { title: t('Time to draw'), body };
  const key = JSON.stringify([reminderHour, minute, text, once]);
  if (!ask && key === scheduled) {
    return true;
  }
  const ok = await scheduleReminder({ hour: reminderHour, minute }, text, ask);
  // The one-offs follow the daily reminder: set only once notifications are allowed.
  const onceOk = ok && (await replaceOnceReminders(once));
  scheduled = ok && onceOk ? key : '';
  return ok;
}
