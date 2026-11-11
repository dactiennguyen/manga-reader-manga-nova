import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { badgeText } from '../../../core/studio/badges';
import type { Badge, BadgeTier } from '../../../core/studio/types';
import { Icon, ProgressBar, Text, type ColorToken } from '../../../ui';
import { LockIcon, MarkDoneIcon } from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';

const TIER: Record<BadgeTier, { box: string; icon: ColorToken }> = {
  bronze: { box: 'bg-accent/15', icon: 'accent' },
  silver: { box: 'bg-overlay', icon: 'text-secondary' },
  gold: { box: 'bg-warning/15', icon: 'warning' },
};

/**
 * One badge: its seal, title and what it asks for. Earned shows a filled seal in the tier's ink; locked
 * shows a lock and how far along the person is, so the state never rests on colour alone.
 */
export function BadgeChip({ badge, earned, progress }: { badge: Badge; earned: boolean; progress: number }) {
  const tier = TIER[badge.tier];
  const tierName = tierText(badge.tier);
  return (
    <View
      accessible
      accessibilityLabel={`${t(badge.title)}, ${tierName}. ${badgeText(badge)}. ${earned ? t('Earned') : t('{percent}% there', { percent: Math.round(progress * 100) })}`}
      className="flex-1 gap-2 rounded-lg bg-surface p-3"
    >
      <View className="flex-row items-center gap-2">
        <View className={`h-10 w-10 items-center justify-center rounded-full ${earned ? tier.box : 'bg-overlay'}`}>
          <Icon icon={earned ? MarkDoneIcon : LockIcon} size={ICON.md} color={earned ? tier.icon : 'text-muted'} weight={earned ? 'fill' : 'regular'} />
        </View>
        <View className="flex-1">
          <Text variant="label" tone={earned ? 'text' : 'secondary'} numberOfLines={2}>
            {t(badge.title)}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {tierName}
          </Text>
        </View>
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {badgeText(badge)}
      </Text>
      {!earned && <ProgressBar value={progress} />}
    </View>
  );
}

function tierText(tier: BadgeTier): string {
  return tier === 'gold' ? t('Gold') : tier === 'silver' ? t('Silver') : t('Bronze');
}
