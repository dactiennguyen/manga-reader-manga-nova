import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { compareMonths, monthOf, type Month } from '../../core/planner/days';
import { Sheet } from '../../ui';
import { MonthGrid, MonthHeader } from './MonthGrid';

/**
 * Picks one day from a month grid, in the app with no system date picker. Choosing a day closes the sheet
 * and hands the day over once it is closed.
 */
export function DatePickerSheet({
  visible,
  onClose,
  title,
  value,
  today,
  min,
  max,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: string;
  today: string;
  min: string;
  max: string;
  onPick: (day: string) => void;
}) {
  const [month, setMonth] = useState<Month>(() => monthOf(value));
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setMonth(monthOf(value));
      setPicked(null);
    }
  }, [visible, value]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        if (picked) {
          onPick(picked);
        }
      }}
      title={title}
    >
      <View className="gap-2 px-2 pb-2">
        <MonthHeader
          month={month}
          onChange={setMonth}
          canBack={compareMonths(month, monthOf(min)) > 0}
          canForward={compareMonths(month, monthOf(max)) < 0}
        />
        <MonthGrid
          month={month}
          today={today}
          selected={picked ?? value}
          min={min}
          max={max}
          onSelect={day => {
            setPicked(day);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
