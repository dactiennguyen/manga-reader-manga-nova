import { useState } from 'react';
import { View } from 'react-native';
import { CircleIcon, DoneIcon, StatsIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { DAILY_GOALS, bestStreak, currentStreak, goalProgress, lastWeek } from '../../core/story/activity';
import { dayKey, weekdayName } from '../../core/util/time';
import { useAppNavigation } from '../../state/navigation';
import { useActivity } from '../../state/useActivity';
import { useSettings } from '../../state/useSettings';
import { Button, Card, Menu, ProgressBar, Pressable, Text } from '../../ui';

const BAR_HEIGHT = 48;

function goalLabel(goal: number): string {
  return goal > 0 ? t('{count} strokes a day', { count: goal }) : t('No daily goal');
}

/** How often the person draws: today against the goal, the streak, and the last week. */
export function StreakCard() {
  const navigation = useAppNavigation();
  const activity = useActivity();
  const goal = useSettings(s => s.dailyGoal);
  const [picking, setPicking] = useState(false);
  const today = dayKey();
  const drawn = activity.days[today] ?? 0;
  const streak = currentStreak(activity, today);
  const week = lastWeek(activity, today);
  const tallest = Math.max(goal, ...week.map(bar => bar.strokes), 1);

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text variant="caption" tone="secondary">
            {t('Drawing streak')}
          </Text>
          <Text variant="display">{tn(streak, '{count} day', '{count} days')}</Text>
        </View>
        <View className="items-end">
          <Text variant="caption" tone="muted">
            {t('Best: {days}', { days: tn(bestStreak(activity), '{count} day', '{count} days') })}
          </Text>
          <Text variant="caption" tone="muted">
            {tn(activity.total, '{count} stroke in all', '{count} strokes in all')}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel={t('Strokes drawn in the last seven days')}
        accessibilityHint={t('Opens the chart with the numbers per day')}
        onPress={() => navigation.navigate('StatsMetric', { metric: 'strokes', period: 'week' })}
        className="flex-row items-end gap-2"
      >
        {week.map(bar => (
          <View key={bar.day} className="flex-1 items-center gap-1">
            <View className="w-full justify-end rounded-sm bg-overlay" style={{ height: BAR_HEIGHT }}>
              <View
                className={`w-full rounded-sm ${bar.day === today ? 'bg-accent' : 'bg-accent/50'}`}
                style={{ height: Math.round((bar.strokes / tallest) * BAR_HEIGHT) }}
              />
            </View>
            <Text variant="caption" tone={bar.day === today ? 'text' : 'muted'} numberOfLines={1}>
              {weekdayName(bar.weekday)}
            </Text>
          </View>
        ))}
      </Pressable>

      {goal > 0 && (
        <View className="gap-1">
          <ProgressBar value={goalProgress(activity, today, goal)} tone={drawn >= goal ? 'success' : 'accent'} />
          <Text variant="caption" tone="secondary">
            {drawn >= goal
              ? t("Today's goal is done: {drawn} strokes", { drawn })
              : t('Today: {drawn} of {goal} strokes', { drawn, goal })}
          </Text>
        </View>
      )}
      <View className="flex-row flex-wrap gap-2">
        <Button title={goalLabel(goal)} variant="secondary" small onPress={() => setPicking(true)} />
        <Button title={t('All statistics')} icon={StatsIcon} variant="ghost" small onPress={() => navigation.navigate('Stats')} />
      </View>

      <Menu
        visible={picking}
        onClose={() => setPicking(false)}
        title={t('Daily goal')}
        items={DAILY_GOALS.map(option => ({
          label: goalLabel(option),
          icon: option === goal ? DoneIcon : CircleIcon,
          onPress: () => useSettings.getState().set({ dailyGoal: option }),
        }))}
      />
    </Card>
  );
}
