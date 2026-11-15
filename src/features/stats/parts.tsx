import { View } from 'react-native';

import { msg, t } from '../../core/i18n';
import { formatPeriod } from '../../core/stats/format';
import type { Period, PeriodKind } from '../../core/stats/period';
import { Card, ICON, Icon, IconButton, Text, type IconGlyph } from '../../ui';
import { CaretLeftIcon, CaretRightIcon } from '../../ui/icons';

export const PERIOD_TABS: readonly { key: PeriodKind; label: string }[] = [
  { key: 'week', label: msg('Week') },
  { key: 'month', label: msg('Month') },
  { key: 'year', label: msg('Year') },
  { key: 'all', label: msg('All time') },
];

const PREVIOUS: Record<PeriodKind, string> = {
  week: msg('Previous week'),
  month: msg('Previous month'),
  year: msg('Previous year'),
  all: '',
};

const NEXT: Record<PeriodKind, string> = {
  week: msg('Next week'),
  month: msg('Next month'),
  year: msg('Next year'),
  all: '',
};

/** The period on show, with steps back and forward. Forward stops at the current period. */
export function PeriodNavigator({
  period,
  offset,
  firstDay,
  onChange,
}: {
  period: Period;
  offset: number;
  /** The oldest day with data. Back stops at the period that holds it. */
  firstDay: string | undefined;
  onChange: (offset: number) => void;
}) {
  const label = formatPeriod(period);
  if (period.kind === 'all') {
    return (
      <Text variant="label" tone="secondary" className="py-3 text-center">
        {label}
      </Text>
    );
  }
  return (
    <View className="flex-row items-center gap-1">
      <IconButton
        icon={CaretLeftIcon}
        accessibilityLabel={t(PREVIOUS[period.kind])}
        disabled={!firstDay || period.start <= firstDay}
        onPress={() => onChange(offset - 1)}
      />
      <Text
        variant="label"
        className="flex-1 text-center"
        numberOfLines={1}
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
      >
        {label}
      </Text>
      <IconButton
        icon={CaretRightIcon}
        accessibilityLabel={t(NEXT[period.kind])}
        disabled={offset >= 0}
        onPress={() => onChange(Math.min(0, offset + 1))}
      />
    </View>
  );
}

/** One number with its name, tappable for its chart. */
export function StatTile({
  icon,
  label,
  value,
  note,
  onPress,
}: {
  icon: IconGlyph;
  label: string;
  value: string;
  note?: string;
  onPress?: () => void;
}) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[`${label}: ${value}`, note].filter(Boolean).join('. ')}
      className="min-h-24 min-w-[45%] flex-1 basis-[45%] gap-1 p-3 md:min-w-[30%] md:basis-[30%]"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={icon} size={ICON.sm} color="text-secondary" />
        <Text variant="caption" tone="secondary" numberOfLines={2} className="flex-1">
          {label}
        </Text>
        {!!onPress && <Icon icon={CaretRightIcon} size={ICON.sm} color="text-muted" />}
      </View>
      <Text variant="title" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {!!note && (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {note}
        </Text>
      )}
    </Card>
  );
}
