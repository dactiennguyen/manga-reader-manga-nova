import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { plannerContext, weekSummary } from '../../core/planner/calendar';
import { planViews } from '../../core/planner/data';
import { addDays, weekStartOf } from '../../core/planner/days';
import { todayText } from '../../core/planner/words';
import { pagesText } from '../../core/studio/castUtil';
import { useAppNavigation } from '../../state/navigation';
import { usePlanner } from '../../state/usePlanner';
import { Button, Card, ICON, Icon, IconButton, Text } from '../../ui';
import { CalendarIcon, CaretRightIcon, CloseIcon, StatsIcon } from '../../ui/icons';
import type { HomeData } from '../home/useHomeData';
import { chapterTitles, useNoteToday, usePlannerFields } from './usePlannerData';

const ROWS = 3;

/** Today's pages for each chapter with a plan, shown on Home while a plan is open. */
export const TodayPlanCard = memo(function TodayPlanCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const planner = usePlannerFields();
  const { state, today } = data;
  useNoteToday(today);
  const items = useMemo(() => planViews(planner, state, today).filter(item => item.status !== 'done'), [planner, state, today]);
  if (!items.length) {
    return null;
  }
  const rows = items.slice(0, ROWS).map(item => ({ item, title: chapterTitles(state, item.plan.chapterId).chapter, text: todayText(item) }));
  return (
    <Card
      accessibilityLabel={`${t("Today's plan")}. ${rows.map(row => `${row.title}: ${row.text}`).join('. ')}`}
      onPress={() => navigation.navigate('Calendar')}
      className="gap-3 p-3"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={CalendarIcon} color="accent" />
        <Text variant="heading" className="flex-1">
          {t("Today's plan")}
        </Text>
      </View>
      {rows.map(({ item, title, text }) => (
        <View key={item.plan.chapterId} className="gap-0.5">
          <Text variant="label" numberOfLines={1}>
            {title}
          </Text>
          <Text
            variant="caption"
            tone={item.status === 'overdue' ? 'danger' : item.todayPlanned > 0 && item.todayLeft === 0 ? 'success' : 'secondary'}
            numberOfLines={1}
          >
            {text}
          </Text>
        </View>
      ))}
      <View className="flex-row items-center justify-end gap-1">
        {items.length > ROWS && (
          <Text variant="caption" tone="muted" className="flex-1">
            {tn(items.length - ROWS, '{count} more chapter', '{count} more chapters')}
          </Text>
        )}
        <Text variant="label" tone="accent">
          {t('Open calendar')}
        </Text>
        <Icon icon={CaretRightIcon} size={ICON.sm} color="accent" />
      </View>
    </Card>
  );
});

/** Once a week, from the first visit of the week until it is opened or put away: how last week went. */
export const WeekSummaryCard = memo(function WeekSummaryCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const planner = usePlannerFields();
  const { state, activity, today } = data;
  const current = weekStartOf(today);
  const last = addDays(current, -7);
  const summary = useMemo(
    () => (planner.summarySeen === current ? null : weekSummary(plannerContext(planner, state, activity, today), last)),
    [planner, state, activity, today, current, last],
  );
  if (!summary || (!summary.strokes && !summary.pagesDone && !summary.pagesPlanned)) {
    return null;
  }
  const text = t('Last week: {pages} finished, {days} drawn.', {
    pages: pagesText(summary.pagesDone),
    days: tn(summary.daysDrawn, '{count} day', '{count} days'),
  });
  return (
    <Card className="gap-3 p-3">
      <View className="flex-row items-center gap-2">
        <Icon icon={StatsIcon} color="accent" />
        <Text variant="heading" className="flex-1">
          {t('Your week in review')}
        </Text>
        <IconButton
          icon={CloseIcon}
          size={ICON.md}
          accessibilityLabel={t('Put away until next week')}
          onPress={() => usePlanner.getState().markSummarySeen(current)}
        />
      </View>
      <Text tone="secondary">{text}</Text>
      <Button title={t('See the summary')} variant="secondary" small className="self-start" onPress={() => navigation.navigate('WeekSummary', { week: last })} />
    </Card>
  );
});
