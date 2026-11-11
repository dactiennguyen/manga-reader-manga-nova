import { useRef, useState } from 'react';
import { Image, View } from 'react-native';

import { t } from '../../../core/i18n';
import { availableGifts, giftReason } from '../../../core/studio/gifts';
import type { Gift, Metrics, Reward } from '../../../core/studio/types';
import { dayKey } from '../../../core/util/time';
import { useAppNavigation } from '../../../state/navigation';
import { useStudio } from '../../../state/useStudio';
import { Button, Card, Dialog, SectionHeader, Text } from '../../../ui';
import { STUDIO_ART } from '../../../ui/studioArt';
import { rewardWhere } from '../parts/rewardText';

/** Gifts earned by streaks, levels and prompts, waiting to be opened, and the reveal of what was inside. */
export function GiftsSection({ metrics, opened }: { metrics: Metrics; opened: string[] }) {
  const navigation = useAppNavigation();
  const [won, setWon] = useState<{ reward: Reward; added: number } | null>(null);
  const reward = won?.reward ?? null;
  // Gifts opened here, so a second tap before the list re-renders does not open one again.
  const openedHere = useRef(new Set<string>());
  const gifts = availableGifts(metrics, { giftsOpened: opened }, dayKey());

  const onOpen = (gift: Gift) => {
    if (openedHere.current.has(gift.id)) {
      return;
    }
    openedHere.current.add(gift.id);
    setWon(useStudio.getState().openGift(gift));
  };

  return (
    <View className="gap-2">
      <SectionHeader>{t('Gifts')}</SectionHeader>
      {gifts.length > 0 ? (
        gifts.map(gift => (
          <Card key={gift.id} className="flex-row items-center gap-3 p-3">
            <Image accessibilityIgnoresInvertColors source={STUDIO_ART.gift} style={{ width: 64, height: 64 }} className="rounded-md" />
            <View className="flex-1 gap-0.5">
              <Text variant="label">{t('A gift is waiting')}</Text>
              <Text variant="caption" tone="secondary">
                {giftReason(gift)}
              </Text>
            </View>
            <Button title={t('Open')} small onPress={() => onOpen(gift)} />
          </Card>
        ))
      ) : (
        <Card className="p-4">
          <Text variant="bodySmall" tone="secondary">
            {t('Gifts come with drawing streaks, new levels and every ten daily prompts.')}
          </Text>
        </Card>
      )}
      <Dialog
        visible={!!reward}
        onClose={() => setWon(null)}
        actions={
          reward?.kind === 'cardFrame'
            ? [
                { label: t('Later'), onPress: () => setWon(null) },
                {
                  label: t('See cards'),
                  variant: 'primary',
                  onPress: () => {
                    setWon(null);
                    navigation.navigate('Cards');
                  },
                },
              ]
            : [{ label: t('Nice'), variant: 'primary', onPress: () => setWon(null) }]
        }
      >
        {!!reward && (
          <View className="items-center gap-2">
            <Image accessibilityIgnoresInvertColors source={STUDIO_ART.giftOpen} style={{ width: 160, height: 160 }} className="rounded-xl" />
            <Text variant="caption" tone="secondary">
              {t('Inside the gift')}
            </Text>
            <Text variant="title" accessibilityRole="header" className="text-center">
              {t(reward.title)}
            </Text>
            <Text variant="bodySmall" tone="secondary" className="text-center">
              {rewardWhere(reward, won?.added ?? 0)}
            </Text>
          </View>
        )}
      </Dialog>
    </View>
  );
}
