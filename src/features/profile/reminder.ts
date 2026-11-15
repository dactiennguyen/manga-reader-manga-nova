import { t } from '../../core/i18n';
import { chapterName, chapterNumber } from '../../core/model/selectors';
import { planViews } from '../../core/planner/data';
import { addDays } from '../../core/planner/days';
import { planReminderText } from '../../core/planner/words';
import { dayKey } from '../../core/util/time';
import { cancelReminder, scheduleReminder } from '../../native/reminder';
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
 * The notification body. With a chapter plan it names the next reminder's pages or a deadline close to it;
 * otherwise the usual streak line.
 */
function reminderBody(hour: number, now = new Date()): string {
  const today = dayKey(now.getTime());
  const fireDay = now.getHours() < hour ? today : addDays(today, 1);
  const state = useStory.getState();
  const items = planViews(usePlanner.getState(), state, today);
  const nameOf = (chapterId: string) => {
    const chapter = state.chapters[chapterId];
    return chapter ? chapterName(chapter.title, chapterNumber(state.projects[chapter.projectId], chapterId)) : '';
  };
  return planReminderText(items, nameOf, fireDay, today) ?? t('A few strokes today keep your streak going.');
}

/**
 * Makes the system reminder match the settings. The notification text is fixed when it is scheduled,
 * so this also runs at startup, after a language change, when a plan changes and when the app goes to the
 * background, to keep the text in the right language and on today's plan.
 */
export async function syncReminder(ask = false): Promise<boolean> {
  const { reminderOn, reminderHour } = useSettings.getState();
  if (!reminderOn) {
    scheduled = '';
    cancelReminder();
    return true;
  }
  const text = { title: t('Time to draw'), body: reminderBody(reminderHour) };
  const key = `${reminderHour}|${text.title}|${text.body}`;
  if (!ask && key === scheduled) {
    return true;
  }
  const ok = await scheduleReminder({ hour: reminderHour, minute: 0 }, text, ask);
  scheduled = ok ? key : '';
  return ok;
}
