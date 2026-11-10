import { t } from '../../core/i18n';
import { cancelReminder, scheduleReminder } from '../../native/reminder';
import { useSettings } from '../../state/useSettings';

export const REMINDER_TIMES = [8, 12, 18, 20, 21, 22];

export function timeLabel(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Makes the system reminder match the settings. The notification text is fixed when it is scheduled,
 * so this also runs at startup and after a language change to keep the text in the right language.
 */
export async function syncReminder(ask = false): Promise<boolean> {
  const { reminderOn, reminderHour } = useSettings.getState();
  if (!reminderOn) {
    cancelReminder();
    return true;
  }
  return scheduleReminder(
    { hour: reminderHour, minute: 0 },
    { title: t('Time to draw'), body: t('A few strokes today keep your streak going.') },
    ask,
  );
}
