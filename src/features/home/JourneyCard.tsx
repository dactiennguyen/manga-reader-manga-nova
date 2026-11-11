import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { levelProgress, requirementText } from '../../core/studio/journey';
import { studioPoints } from '../../core/studio/points';
import { useAppNavigation } from '../../state/navigation';
import { Badge, Card, ICON, Icon, ProgressBar, Text } from '../../ui';
import { CaretRightIcon, StarIcon } from '../../ui/icons';
import { LevelBadge } from '../studio/parts/LevelBadge';
import type { HomeData } from './useHomeData';

/** The current journey level, how close the next one is and the one step nearest to done. */
export const JourneyCard = memo(function JourneyCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { m, levelIndex, studio } = data;
  const journey = useMemo(() => levelProgress(m), [m]);
  const points = useMemo(() => studioPoints(m), [m]);
  // The unmet step with the most done: the one a little more work finishes.
  const step = useMemo(
    () =>
      journey.steps
        .filter(item => item.have < item.need.count)
        .sort((a, b) => b.have / b.need.count - a.have / a.need.count)[0],
    [journey],
  );
  // The journey screen marks a level as celebrated once it is seen there.
  const celebrate = levelIndex > studio.levelSeen;
  const title = t(journey.level.title);
  const heading = celebrate ? t('You reached {level}!', { level: title }) : title;
  const pointsText = tn(points, '{count} Studio point', '{count} Studio points');
  const stepText = step ? `${requirementText(step.need)} · ${Math.min(step.have, step.need.count)}/${step.need.count}` : '';

  return (
    <Card accessibilityLabel={`${t('Mangaka journey')}: ${heading}. ${stepText} ${pointsText}`} onPress={() => navigation.navigate('Journey')} className="gap-3 p-3">
      <View className="flex-row items-center gap-3">
        <LevelBadge level={journey.level} size={celebrate ? 80 : 64} showTitle={false} />
        <View className="flex-1 gap-1">
          {celebrate ? (
            <Badge text={t('New level')} tone="success" />
          ) : (
            <Text variant="caption" tone="muted">
              {t('Mangaka journey')}
            </Text>
          )}
          <Text variant="heading" numberOfLines={2}>
            {heading}
          </Text>
          {celebrate ? (
            <Text variant="bodySmall" tone="secondary" numberOfLines={3}>
              {t(journey.level.blurb)}
            </Text>
          ) : journey.next ? (
            <>
              <ProgressBar value={journey.progress} />
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {t('Next: {level}', { level: t(journey.next.title) })}
              </Text>
            </>
          ) : (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {t('The last level. Every page from here is a victory lap.')}
            </Text>
          )}
        </View>
      </View>
      {!!step && !celebrate && (
        <View className="rounded-md bg-overlay px-3 py-2">
          <Text variant="label" numberOfLines={2}>
            {stepText}
          </Text>
        </View>
      )}
      <View className="flex-row items-center gap-1.5">
        <Icon icon={StarIcon} size={ICON.sm} color="warning" weight="fill" />
        <Text variant="label" className="flex-1" style={{ fontVariant: ['tabular-nums'] }}>
          {pointsText}
        </Text>
        <Text variant="label" tone="accent">
          {t('See journey')}
        </Text>
        <Icon icon={CaretRightIcon} size={ICON.sm} color="accent" />
      </View>
    </Card>
  );
});
