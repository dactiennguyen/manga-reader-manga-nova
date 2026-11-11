import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { snapshotCard, snapshotCharacter, type CardSnapshot, type SavedCard } from '../../../core/nearby/cardSwap';
import { Icon, Text } from '../../../ui';
import { CardsIcon } from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';
import { FlipCard } from '../../studio/cards/FlipCard';
import { CARD_RATIO, CharacterCardView } from '../../studio/parts';

/** A friend's card as the shared card view draws it. `face` is a saved image path. */
export function FriendCardFront({ card, compact }: { card: CardSnapshot & { face?: string }; compact?: boolean }) {
  return <CharacterCardView card={snapshotCard(card)} character={snapshotCharacter(card)} compact={compact} />;
}

/** The back of an arriving card: who it is from, printed on the same cream paper. */
function CardBackFrom({ card }: { card: CardSnapshot }) {
  return (
    <View className="w-full overflow-hidden rounded-xl border border-on-paper/20 bg-paper p-3" style={{ aspectRatio: CARD_RATIO }}>
      <View className="flex-1 items-center justify-center gap-3 rounded-lg border border-dashed border-on-paper/40 p-3">
        <Icon icon={CardsIcon} size={ICON.xxl} color="on-paper" weight="duotone" />
        <Text variant="title" tone="onPaper" className="text-center" maxFontSizeMultiplier={1.2}>
          {t('A card from {name}', { name: card.owner || t('a friend') })}
        </Text>
        {!!card.story && (
          <Text variant="caption" tone="onPaper" className="text-center opacity-75" numberOfLines={2} maxFontSizeMultiplier={1.2}>
            {card.story}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Shows the back first, then turns the card over once, so a received card is revealed like a real one. */
export function ArrivingCard({ card, width }: { card: CardSnapshot & { face?: string }; width: number }) {
  const [flipped, setFlipped] = useState(true);
  useEffect(() => {
    setFlipped(true);
    const timer = setTimeout(() => setFlipped(false), 600);
    return () => clearTimeout(timer);
  }, [card.key]);
  return <FlipCard width={width} flipped={flipped} front={<FriendCardFront card={card} />} back={<CardBackFrom card={card} />} />;
}

export type { SavedCard };
