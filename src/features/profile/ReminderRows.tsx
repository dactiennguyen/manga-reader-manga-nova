import { useState } from 'react';
import { CircleIcon, DoneIcon, ReminderIcon, TimeIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { useSettings } from '../../state/useSettings';
import { ListItem, Menu, SwitchRow, Text, toast } from '../../ui';
import { REMINDER_TIMES, syncReminder, timeLabel } from './reminder';

/** The daily drawing reminder: a local notification, set on the device with no server. */
export function ReminderRows() {
  const on = useSettings(s => s.reminderOn);
  const hour = useSettings(s => s.reminderHour);
  const [picking, setPicking] = useState(false);

  const apply = async (patch: { reminderOn?: boolean; reminderHour?: number }) => {
    useSettings.getState().set(patch);
    if (!(await syncReminder(true)) && useSettings.getState().reminderOn) {
      useSettings.getState().set({ reminderOn: false });
      toast(t('Notifications are off for Manganova. Allow them in the system settings, then try again.'));
    }
  };

  return (
    <>
      <SwitchRow
        icon={ReminderIcon}
        title={t('Daily drawing reminder')}
        subtitle={t('One notification a day, set on this device')}
        value={on}
        onValueChange={value => apply({ reminderOn: value })}
      />
      {on && (
        <ListItem
          icon={TimeIcon}
          title={t('Reminder time')}
          right={<Text tone="muted">{timeLabel(hour)}</Text>}
          chevron
          onPress={() => setPicking(true)}
        />
      )}
      <Menu
        visible={picking}
        onClose={() => setPicking(false)}
        title={t('Reminder time')}
        items={REMINDER_TIMES.map(option => ({
          label: timeLabel(option),
          icon: option === hour ? DoneIcon : CircleIcon,
          onPress: () => apply({ reminderHour: option }),
        }))}
      />
    </>
  );
}
