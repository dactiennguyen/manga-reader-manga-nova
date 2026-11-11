import { memo, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { t } from '../../core/i18n';
import { BADGES, badgeProgress, earnedBadges } from '../../core/studio/badges';
import type { Badge as StudioBadge, BadgeTier } from '../../core/studio/types';
import { useAppNavigation } from '../../state/navigation';
import { Badge, Button, Pressable, SectionHeader } from '../../ui';
import { BadgeChip } from '../studio/parts';
import type { HomeData } from './useHomeData';

const SHOWN = 3;
const TIER_RANK: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2 };

type Shown = { badge: StudioBadge; earned: boolean; fresh: boolean; progress: number };

/**
 * Badges do not record when they were won, so the latest are taken to be the ones not announced yet, then
 * the highest tier. With none earned, the badges closest to done show what comes next.
 */
function badgesToShow(earned: StudioBadge[], seen: string[], progressOf: (badge: StudioBadge) => number): Shown[] {
  if (!earned.length) {
    return BADGES.map(badge => ({ badge, earned: false, fresh: false, progress: progressOf(badge) }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, SHOWN);
  }
  const shown = new Set(seen);
  return earned
    .map((badge, index) => ({ badge, index, fresh: !shown.has(badge.id) }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || TIER_RANK[b.badge.tier] - TIER_RANK[a.badge.tier] || b.index - a.index)
    .slice(0, SHOWN)
    .map(({ badge, fresh }) => ({ badge, earned: true, fresh, progress: 1 }));
}

/** The latest badges won, new ones marked, or the next few to win. */
export const BadgesCard = memo(function BadgesCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { m, studio } = data;
  const seen = studio.badgesSeen;
  const earned = useMemo(() => earnedBadges(m), [m]);
  const shown = useMemo(() => badgesToShow(earned, seen, badge => badgeProgress(badge, m)), [earned, seen, m]);
  const open = () => navigation.navigate('Journey');

  return (
    <View className="gap-2">
      <SectionHeader right={<Button title={t('See all')} variant="ghost" small onPress={open} />}>
        {earned.length ? t('Badges') : t('Next badges')}
      </SectionHeader>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-1 pr-4 pt-2">
        {shown.map(item => (
          <Pressable
            key={item.badge.id}
            accessibilityLabel={item.fresh ? `${t(item.badge.title)}, ${t('New')}` : t(item.badge.title)}
            onPress={open}
            className={`w-52 flex-row rounded-lg ${item.fresh ? 'border-2 border-accent' : ''}`}
          >
            <BadgeChip badge={item.badge} earned={item.earned} progress={item.progress} />
            {item.fresh && (
              <View className="absolute -top-2.5 left-3 rounded-full bg-surface">
                <Badge text={t('New')} />
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});
