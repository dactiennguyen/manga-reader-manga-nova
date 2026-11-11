import { useState } from 'react';
import { View } from 'react-native';
import { CircleIcon, DoneIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { DAILY_GOALS, bestStreak, currentStreak, goalProgress, lastWeek } from '../../core/story/activity';
import { dayKey, weekdayName } from '../../core/util/time';
import { useActivity } from '../../state/useActivity';
import { useSettings } from '../../state/useSettings';
import { Button, Card, Menu, ProgressBar, Text } from '../../ui';

const BAR_HEIGHT = 48;

function goalLabel(goal: number): string {
  return goal > 0 ? t('{count} strokes a day', { count: goal }) : t('No daily goal');
}

/** How often the person draws: today against the goal, the streak, and the last week. */
export function StreakCard() {
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

      <View
        accessible
        accessibilityLabel={t('Strokes drawn in the last seven days')}
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
      </View>

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
      <Button
        title={goalLabel(goal)}
        variant="secondary"
        small
        onPress={() => setPicking(true)}
        className="self-start"
      />

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
