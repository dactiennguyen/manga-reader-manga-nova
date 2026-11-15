import { memo } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { addMonths, monthGrid, weekdayOrder, type Month } from '../../core/planner/days';
import { deadlineText, monthTitle } from '../../core/planner/words';
import { weekdayName } from '../../core/util/time';
import { ICON, Icon, IconButton, Pressable, Text } from '../../ui';
import { CaretLeftIcon, CaretRightIcon, DeadlineIcon } from '../../ui/icons';

export type DayMarks = { planned?: boolean; drawn?: boolean; deadline?: boolean; overdue?: boolean };

/** The month name with buttons to the months around it. */
export function MonthHeader({
  month,
  onChange,
  canBack = true,
  canForward = true,
}: {
  month: Month;
  onChange: (month: Month) => void;
  canBack?: boolean;
  canForward?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <IconButton icon={CaretLeftIcon} disabled={!canBack} accessibilityLabel={t('Previous month')} onPress={() => onChange(addMonths(month, -1))} />
      <Text variant="heading" accessibilityRole="header" className="flex-1 text-center" accessibilityLiveRegion="polite">
        {monthTitle(month)}
      </Text>
      <IconButton icon={CaretRightIcon} disabled={!canForward} accessibilityLabel={t('Next month')} onPress={() => onChange(addMonths(month, 1))} />
    </View>
  );
}

function marksLabel(marks: DayMarks | null): string {
  if (!marks) {
    return '';
  }
  const parts = [
    marks.overdue ? t('Overdue') : marks.deadline ? t('Deadline') : '',
    marks.planned ? t('Pages planned') : '',
    marks.drawn ? t('Drawn') : '',
  ];
  return parts.filter(Boolean).join(', ');
}

function DayCell({
  day,
  today,
  selected,
  disabled,
  marks,
  onSelect,
}: {
  day: string;
  today: boolean;
  selected: boolean;
  disabled: boolean;
  marks: DayMarks | null;
  onSelect: (day: string) => void;
}) {
  const extra = marksLabel(marks);
  const label = `${today ? `${t('Today')}, ` : ''}${deadlineText(day)}${extra ? `, ${extra}` : ''}`;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onSelect(day)}
      className={`h-[52px] flex-1 items-center justify-center gap-0.5 rounded-md ${
        selected ? 'bg-accent' : today ? 'bg-accent/15' : ''
      }`}
    >
      <Text
        variant={selected || today ? 'heading' : 'label'}
        tone={selected ? 'onAccent' : today ? 'accent' : 'text'}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {Number(day.slice(8))}
      </Text>
      <View className="h-3.5 flex-row items-center gap-0.5">
        {!!marks?.deadline && (
          <Icon icon={DeadlineIcon} size={ICON.xs} color={selected ? 'on-accent' : marks.overdue ? 'danger' : 'accent'} weight="fill" />
        )}
        {!!marks?.planned && <View className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-on-accent' : 'bg-accent'}`} />}
        {!!marks?.drawn && <View className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-on-accent' : 'bg-success'}`} />}
      </View>
    </Pressable>
  );
}

/** A month of days, Monday first. Days outside `min`..`max` cannot be chosen. */
export const MonthGrid = memo(function MonthGridView({
  month,
  today,
  selected,
  onSelect,
  min,
  max,
  marks,
}: {
  month: Month;
  today: string;
  selected: string | null;
  onSelect: (day: string) => void;
  min?: string;
  max?: string;
  marks?: (day: string) => DayMarks | null;
}) {
  const rows = monthGrid(month);
  return (
    <View className="gap-1">
      <View className="flex-row" importantForAccessibility="no-hide-descendants">
        {weekdayOrder().map(weekday => (
          <Text key={weekday} variant="caption" tone="muted" numberOfLines={1} className="flex-1 text-center">
            {weekdayName(weekday)}
          </Text>
        ))}
      </View>
      {rows.map(row => (
        <View key={row.find(Boolean) ?? ''} className="flex-row">
          {row.map((day, index) =>
            day ? (
              <DayCell
                key={day}
                day={day}
                today={day === today}
                selected={day === selected}
                disabled={(!!min && day < min) || (!!max && day > max)}
                marks={marks?.(day) ?? null}
                onSelect={onSelect}
              />
            ) : (
              <View key={`empty-${index}`} className="h-[52px] flex-1" />
            ),
          )}
        </View>
      ))}
    </View>
  );
});

/** What the marks under a day mean. */
export function MonthLegend() {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
      <View className="flex-row items-center gap-1.5">
        <View className="h-2 w-2 rounded-full bg-accent" />
        <Text variant="caption" tone="secondary">
          {t('Pages planned')}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="h-2 w-2 rounded-full bg-success" />
        <Text variant="caption" tone="secondary">
          {t('Drawn')}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={DeadlineIcon} size={ICON.xs} color="accent" weight="fill" />
        <Text variant="caption" tone="secondary">
          {t('Deadline')}
        </Text>
      </View>
    </View>
  );
}
