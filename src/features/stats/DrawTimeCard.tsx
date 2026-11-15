import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { formatFullDate, formatNumber } from '../../core/stats/format';
import type { WeekStart } from '../../core/stats/period';
import {
  HEAT_MIN_DAYS,
  HEAT_MIN_SESSIONS,
  HEAT_SLOT_HOURS,
  HEAT_SLOTS,
  heatLevel,
  heatPeak,
  heatmapOf,
  heatmapReady,
  type DrawSession,
} from '../../core/stats/sessions';
import { dayKey, weekdayName } from '../../core/util/time';
import { Card, ICON, Icon, ProgressBar, Text } from '../../ui';
import { TimeIcon } from '../../ui/icons';

/** Empty, then four steps of the accent ink. Literal strings, so Uniwind sees every class. */
const LEVEL_CLASS = ['bg-overlay', 'bg-accent/20', 'bg-accent/45', 'bg-accent/70', 'bg-accent'] as const;

const pad = (hour: number) => String(hour).padStart(2, '0');

/** "18:00–21:00" for a slot. */
function slotRange(slot: number): { from: string; to: string } {
  return { from: `${pad(slot * HEAT_SLOT_HOURS)}:00`, to: `${pad(((slot + 1) * HEAT_SLOT_HOURS) % 24)}:00` };
}

/**
 * When the person draws, by weekday and time of day. Times were never kept before statistics shipped,
 * so the card says it is collecting until there are enough sessions to show a pattern.
 */
export function DrawTimeCard({ sessions, since, weekStart }: { sessions: DrawSession[]; since: string | null; weekStart: WeekStart }) {
  const ready = heatmapReady(sessions);
  const cells = useMemo(() => heatmapOf(sessions), [sessions]);
  const peak = heatPeak(cells);
  const max = peak?.value ?? 0;
  const weekdays = Array.from({ length: 7 }, (_, index) => (index + weekStart) % 7);
  const days = new Set(sessions.map(session => dayKey(session.start))).size;

  if (!ready || !peak) {
    const progress = Math.min(sessions.length / HEAT_MIN_SESSIONS, days / HEAT_MIN_DAYS);
    return (
      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <Icon icon={TimeIcon} size={ICON.lg} color="accent" weight="duotone" />
          <Text variant="heading" className="flex-1">
            {t('Collecting data')}
          </Text>
        </View>
        <Text variant="bodySmall" tone="secondary">
          {since
            ? t('Manganova started noting when you draw on {date}. The map appears after {sessions} on {days}.', {
                date: formatFullDate(since),
                sessions: tn(HEAT_MIN_SESSIONS, '{count} drawing session', '{count} drawing sessions'),
                days: tn(HEAT_MIN_DAYS, '{count} different day', '{count} different days'),
              })
            : t('Manganova notes when you draw from now on. The map appears after a few sessions.')}
        </Text>
        <ProgressBar value={progress} />
        <Text variant="caption" tone="muted">
          {t('{sessions} so far', { sessions: tn(sessions.length, '{count} drawing session', '{count} drawing sessions') })}
        </Text>
      </Card>
    );
  }

  const range = slotRange(peak.slot);
  const summary = t('Busiest time: {weekday}, {from}–{to}', { weekday: weekdayName(peak.weekday), ...range });
  const basis = tn(sessions.length, 'From {count} drawing session.', 'From {count} drawing sessions.', {
    count: formatNumber(sessions.length),
  });

  return (
    <Card className="gap-3 p-4">
      <Text variant="bodySmall">{summary}</Text>
      <View accessible accessibilityRole="image" accessibilityLabel={`${summary}. ${basis}`} className="gap-1">
        <View className="flex-row gap-1">
          <View className="w-10" />
          {Array.from({ length: HEAT_SLOTS }, (_, slot) => (
            <Text key={slot} variant="caption" tone="muted" className="flex-1 text-center" numberOfLines={1}>
              {slot * HEAT_SLOT_HOURS}
            </Text>
          ))}
        </View>
        {weekdays.map(weekday => (
          <View key={weekday} className="flex-row items-center gap-1">
            <Text variant="caption" tone="muted" className="w-10" numberOfLines={1}>
              {weekdayName(weekday)}
            </Text>
            {cells[weekday].map((value, slot) => (
              <View key={slot} className={`h-6 flex-1 rounded-sm ${LEVEL_CLASS[heatLevel(value, max)]}`} />
            ))}
          </View>
        ))}
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="caption" tone="muted" className="flex-1">
          {basis}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text variant="caption" tone="muted">
            {t('Less|chart')}
          </Text>
          {LEVEL_CLASS.map(level => (
            <View key={level} className={`h-3 w-3 rounded-sm ${level}`} />
          ))}
          <Text variant="caption" tone="muted">
            {t('More|chart')}
          </Text>
        </View>
      </View>
    </Card>
  );
}
