import { memo } from 'react';

import { t, tn } from '../../core/i18n';
import { currentStreak, goalProgress } from '../../core/story/activity';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { Card, ICON, Icon, ProgressBar, Text } from '../../ui';
import { StreakIcon } from '../../ui/icons';
import type { HomeData } from './useHomeData';

/** The drawing streak and today's strokes against the daily goal. The full chart and the goal live in Profile. */
export const StreakMiniCard = memo(function StreakMiniCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const goal = useSettings(s => s.dailyGoal);
  const { activity, today } = data;
  const streak = currentStreak(activity, today);
  const drawn = activity.days[today] ?? 0;
  const met = goal > 0 && drawn >= goal;
  const days = tn(streak, '{count} day', '{count} days');
  const todayText = goal > 0 ? t('{drawn}/{goal} today', { drawn, goal }) : tn(drawn, '{count} stroke today', '{count} strokes today');

  return (
    <Card
      accessibilityLabel={`${t('Drawing streak')}: ${days}. ${todayText}`}
      onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
      className="w-32 gap-1 p-3"
    >
      <Icon icon={StreakIcon} size={ICON.lg} color={drawn > 0 ? 'accent' : 'text-muted'} weight={drawn > 0 ? 'fill' : 'regular'} />
      <Text variant="title" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
        {days}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={2} className="flex-1">
        {t('Drawing streak')}
      </Text>
      {goal > 0 && <ProgressBar value={goalProgress(activity, today, goal)} tone={met ? 'success' : 'accent'} />}
      <Text variant="caption" tone={met ? 'success' : 'secondary'} numberOfLines={2}>
        {todayText}
      </Text>
    </Card>
  );
});
