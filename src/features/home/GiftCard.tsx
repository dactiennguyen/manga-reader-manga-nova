import { memo, useMemo, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { t, tn } from '../../core/i18n';
import { availableGifts, giftReason } from '../../core/studio/gifts';
import type { Reward } from '../../core/studio/types';
import { useStudio } from '../../state/useStudio';
import { Button, Card, MOTION, Text, haptic } from '../../ui';
import { STUDIO_ART } from '../../ui/studioArt';
import { rewardWhere } from '../studio/parts/rewardText';
import type { HomeData } from './useHomeData';

const ART_SIZE = 88;

/** A gift earned by a streak, a level or daily prompts. It opens right here, with a small reveal. */
export const GiftCard = memo(function GiftCardView({ data }: { data: HomeData }) {
  const reduced = useReducedMotion();
  const { m, studio, today } = data;
  const giftsOpened = studio.giftsOpened;
  const gifts = useMemo(() => availableGifts(m, { giftsOpened }, today), [m, giftsOpened, today]);
  // Kept after opening, when the gift is no longer available, so the reward stays on screen. `count` replays the reveal for the next gift.
  const [opened, setOpened] = useState<{ reward: Reward; count: number; added: number } | null>(null);
  // A second tap before the card re-renders still sees the gift just opened: it must not open it again.
  const lastOpened = useRef('');
  const won = opened?.reward ?? null;

  const gift = gifts[0];
  if (!gift && !won) {
    return null;
  }
  const open = () => {
    if (gift && gift.id !== lastOpened.current) {
      lastOpened.current = gift.id;
      haptic(16);
      const { reward, added } = useStudio.getState().openGift(gift);
      setOpened(previous => ({ reward, count: (previous?.count ?? 0) + 1, added }));
    }
  };
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Animated.View
        key={opened ? `open-${opened.count}` : 'closed'}
        entering={reduced || !opened ? undefined : ZoomIn.duration(MOTION.slow)}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={won ? STUDIO_ART.giftOpen : STUDIO_ART.gift}
          className="rounded-lg bg-paper"
          style={{ width: ART_SIZE, height: ART_SIZE }}
        />
      </Animated.View>
      {won ? (
        <View className="flex-1 gap-1" accessibilityLiveRegion="polite">
          <Text variant="caption" tone="muted">
            {t('You unlocked')}
          </Text>
          <Text variant="heading">{t(won.title)}</Text>
          <Text variant="bodySmall" tone="secondary">
            {rewardWhere(won, opened?.added ?? 0)}
          </Text>
          {!!gift && <Button title={t('Open the next gift')} variant="ghost" small className="self-start px-0" onPress={open} />}
        </View>
      ) : (
        gift && (
          <View className="flex-1 gap-1">
            <Text variant="heading">{gifts.length > 1 ? tn(gifts.length, '{count} gift for you', '{count} gifts for you') : t('A gift for you')}</Text>
            <Text variant="bodySmall" tone="secondary">
              {giftReason(gift)}
            </Text>
            <Button title={t('Open')} small className="mt-1 self-start" onPress={open} />
          </View>
        )
      )}
    </Card>
  );
});
