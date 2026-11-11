import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { BADGES, badgeProgress, earnedBadges } from '../../core/studio/badges';
import { levelProgress } from '../../core/studio/journey';
import { useMetrics } from '../../state/useMetrics';
import { useStudio } from '../../state/useStudio';
import { ArtBanner, SectionHeader, Text } from '../../ui';
import { STUDIO_ART } from '../../ui/studioArt';
import { GiftsSection } from './journey/GiftsSection';
import { CurrentLevelCard, LevelPath } from './journey/LevelPath';
import { PointsCard } from './journey/PointsCard';
import { BadgeChip } from './parts';
import { StudioPage } from './StudioPage';

/** The mangaka journey: level, the path ahead, Studio points, every badge and gifts to open. */
export function JourneyScreen() {
  const metrics = useMetrics();
  const opened = useStudio(s => s.giftsOpened);
  const progress = useMemo(() => levelProgress(metrics), [metrics]);
  const earned = useMemo(() => new Set(earnedBadges(metrics).map(badge => badge.id)), [metrics]);
  // Earned badges first, so what is done reads before what is left.
  const badges = useMemo(() => [...BADGES].sort((a, b) => Number(earned.has(b.id)) - Number(earned.has(a.id))), [earned]);
  const earnedKey = [...earned].join(',');

  // Seeing this screen is the celebration, so the level and badges count as shown.
  useEffect(() => {
    const { markBadgesSeen, setLevelSeen } = useStudio.getState();
    if (earnedKey) {
      markBadgesSeen(earnedKey.split(','));
    }
    setLevelSeen(progress.level.index);
  }, [earnedKey, progress.level.index]);

  return (
    <StudioPage title={t('Mangaka journey')}>
      <ArtBanner source={STUDIO_ART.journey} ratio={2}>
        <View className="absolute bottom-3 left-4 right-4">
          <Text variant="heading" tone="onPaper" numberOfLines={2}>
            {t('From rookie to anime: one finished page at a time.')}
          </Text>
        </View>
      </ArtBanner>
      <CurrentLevelCard progress={progress} />
      <GiftsSection metrics={metrics} opened={opened} />
      <PointsCard metrics={metrics} />
      <LevelPath current={progress.level.index} />
      <View className="gap-2">
        <SectionHeader
          right={
            <Text variant="caption" tone="muted">
              {t('{earned} of {total}', { earned: earned.size, total: BADGES.length })}
            </Text>
          }
        >
          {t('Badges')}
        </SectionHeader>
        <View className="flex-row flex-wrap gap-3">
          {badges.map(badge => (
            <View key={badge.id} className="min-w-[45%] flex-1 basis-[45%] md:basis-[30%] md:min-w-[30%]">
              <BadgeChip badge={badge} earned={earned.has(badge.id)} progress={badgeProgress(badge, metrics)} />
            </View>
          ))}
        </View>
      </View>
    </StudioPage>
  );
}
