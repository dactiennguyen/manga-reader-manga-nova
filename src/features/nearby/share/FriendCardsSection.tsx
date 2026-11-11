import { useState } from 'react';
import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { snapshotCard, snapshotCharacter } from '../../../core/nearby/cardSwap';
import { formatDate } from '../../../core/util/time';
import { useNearbyShare } from '../../../state/useNearbyShare';
import { Button, Pressable, SectionHeader, Sheet, Text, confirm } from '../../../ui';
import { DeleteIcon } from '../../../ui/icons';
import { cardLabel } from '../../studio/parts';
import { FriendCardFront } from './FriendCardViews';

/** "Friends' cards" in the Cards screen: cards kept from card swaps, each with who gave it and when. */
export function FriendCardsSection({ cardWidth, gap, bigWidth }: { cardWidth: number; gap: number; bigWidth: number }) {
  const cards = useNearbyShare(s => s.cards);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = cards.find(card => card.key === openKey);
  if (cards.length === 0) {
    return null;
  }

  const onRemove = async () => {
    if (!open) {
      return;
    }
    const ok = await confirm(t('Remove this card?'), t('It goes from your collection. Your friend can offer it again.'), {
      confirmText: t('Remove'),
      destructive: true,
    });
    if (ok) {
      useNearbyShare.getState().removeCard(open.key);
      setOpenKey(null);
    }
  };

  return (
    <View className="gap-2">
      <SectionHeader>{t("Friends' cards")}</SectionHeader>
      <View className="flex-row flex-wrap" style={{ gap }}>
        {cards.map(card => (
          <Pressable
            key={card.key}
            accessibilityRole="button"
            accessibilityLabel={`${cardLabel(snapshotCard(card), snapshotCharacter(card))} ${t('From {name}', { name: card.owner })}`}
            accessibilityHint={t('Opens the card')}
            onPress={() => setOpenKey(card.key)}
            style={{ width: cardWidth }}
            className="gap-1"
          >
            <FriendCardFront card={card} compact={cardWidth < 200} />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {t('From {name}', { name: card.owner || t('a friend') })}
            </Text>
          </Pressable>
        ))}
      </View>
      <Sheet visible={!!open} onClose={() => setOpenKey(null)} title={t("Friend's card")}>
        {!!open && (
          <View className="items-center gap-3 px-4 pb-2">
            <View style={{ width: bigWidth }}>
              <FriendCardFront card={open} />
            </View>
            <Text variant="bodySmall" tone="secondary" className="text-center">
              {open.story
                ? t('From {name}, {date}. In the story “{story}”.', {
                    name: open.owner || t('a friend'),
                    date: formatDate(open.receivedAt),
                    story: open.story,
                  })
                : t('From {name}, {date}.', { name: open.owner || t('a friend'), date: formatDate(open.receivedAt) })}
            </Text>
            <Button title={t('Remove from my cards')} icon={DeleteIcon} variant="danger" className="w-full" onPress={onRemove} />
          </View>
        )}
      </Sheet>
    </View>
  );
}
