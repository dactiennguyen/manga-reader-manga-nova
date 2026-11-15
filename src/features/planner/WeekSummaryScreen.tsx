import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { weekSummary, type WeekSummary } from '../../core/planner/calendar';
import { addDays, isDayKey, weekStartOf, weekdayOf } from '../../core/planner/days';
import { weekLine } from '../../core/planner/words';
import { dayKeyToDate, formatDate, weekdayName } from '../../core/util/time';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { usePlanner } from '../../state/usePlanner';
import { Button, Card, IconButton, SectionHeader, Text } from '../../ui';
import { CalendarIcon, CaretLeftIcon, CaretRightIcon } from '../../ui/icons';
import { StudioPage } from '../studio/StudioPage';
import { MoriNote, PlanCard } from './PlanParts';
import { usePlannerContext } from './usePlannerData';

const BAR_HEIGHT = 56;

/** How many weeks back the summary goes: the planned pages kept on the device. */
const WEEKS_BACK = 16;

function shortDate(day: string): string {
  return formatDate(dayKeyToDate(day).getTime());
}

function weekName(start: string, current: string): string {
  if (start === current) {
    return t('This week');
  }
  if (start === addDays(current, -7)) {
    return t('Last week');
  }
  return `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <Card className="flex-1 items-center gap-0.5 px-1 py-3">
      <Text variant="display" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2} className="text-center">
        {label}
      </Text>
      {!!note && (
        <Text variant="caption" tone="muted" numberOfLines={2} className="text-center">
          {note}
        </Text>
      )}
    </Card>
  );
}

/** Strokes each day as bars, with the pages finished under each day. */
function WeekBars({ summary, today }: { summary: WeekSummary; today: string }) {
  const tallest = Math.max(1, ...summary.days.map(info => info.strokes));
  return (
    <Card className="gap-2 p-4">
      <View
        accessible
        accessibilityLabel={`${t('Strokes drawn each day of the week')}. ${summary.days
          .map(info => `${weekdayName(weekdayOf(info.day))}: ${info.strokes}`)
          .join(', ')}`}
        className="flex-row items-end gap-2"
      >
        {summary.days.map(info => (
          <View key={info.day} className="flex-1 items-center gap-1">
            <View className="w-full justify-end rounded-sm bg-overlay" style={{ height: BAR_HEIGHT }}>
              <View
                className={`w-full rounded-sm ${info.day === today ? 'bg-accent' : 'bg-accent/50'}`}
                style={{ height: Math.round((info.strokes / tallest) * BAR_HEIGHT) }}
              />
            </View>
            <Text variant="caption" tone={info.day === today ? 'text' : 'muted'} numberOfLines={1}>
              {weekdayName(weekdayOf(info.day))}
            </Text>
            <Text variant="caption" tone={info.done ? 'success' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
              {info.done ? `+${info.done}` : '–'}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="muted">
        {t('Bars show strokes. The numbers under them are pages finished.')}
      </Text>
    </Card>
  );
}

/** A week at the desk: pages finished against the plan, days drawn, and the deadlines coming closest. */
export function WeekSummaryScreen() {
  const navigation = useAppNavigation();
  const asked = useAppRoute<'WeekSummary'>().params?.week;
  const { context, state } = usePlannerContext();
  const { today } = context;
  const current = weekStartOf(today);
  const [start, setStart] = useState(() => (isDayKey(asked) && asked <= current ? weekStartOf(asked) : current));
  const summary = useMemo(() => weekSummary(context, start), [context, start]);

  // Seeing any summary puts this week's Home card away.
  useEffect(() => {
    usePlanner.getState().markSummarySeen(current);
  }, [current]);

  const planned = summary.pagesPlanned;
  return (
    <StudioPage title={t('Weekly summary')} subtitle={`${shortDate(summary.start)} – ${shortDate(summary.end)}`}>
      <View className="flex-row items-center gap-1">
        <IconButton
          icon={CaretLeftIcon}
          accessibilityLabel={t('Previous week')}
          disabled={start <= addDays(current, -7 * WEEKS_BACK)}
          onPress={() => setStart(addDays(start, -7))}
        />
        <Text variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite" className="flex-1 text-center">
          {weekName(start, current)}
        </Text>
        <IconButton
          icon={CaretRightIcon}
          accessibilityLabel={t('Next week')}
          disabled={start >= current}
          onPress={() => setStart(addDays(start, 7))}
        />
      </View>

      <MoriNote text={weekLine(summary)} />

      <View className="flex-row gap-3">
        <Stat
          value={String(summary.pagesDone)}
          label={t('pages done')}
          note={planned ? t('of {planned} planned', { planned }) : undefined}
        />
        <Stat value={`${summary.daysDrawn}/7`} label={t('days drawn')} />
        <Stat value={String(summary.strokes)} label={tn(summary.strokes, 'stroke', 'strokes')} />
      </View>

      <WeekBars summary={summary} today={today} />

      <View className="gap-2">
        <SectionHeader>{t('Closest deadlines')}</SectionHeader>
        {summary.closest.length ? (
          summary.closest.map(item => <PlanCard key={item.plan.chapterId} item={item} state={state} />)
        ) : (
          <Text tone="muted">{t('No open deadlines.')}</Text>
        )}
      </View>
      <Button title={t('Creation calendar')} icon={CalendarIcon} variant="secondary" onPress={() => navigation.navigate('Calendar')} />
    </StudioPage>
  );
}
