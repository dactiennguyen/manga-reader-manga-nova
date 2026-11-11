import { View } from 'react-native';

import { t, tn } from '../../../core/i18n';
import type { Character, StoryData } from '../../../core/model/types';
import { profileCompleteness } from '../../../core/studio/cards';
import type { CharacterCard } from '../../../core/studio/types';
import { Button, Icon, Text } from '../../../ui';
import { CircleIcon, EditIcon } from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';
import { CARD_RATIO, rarityText } from '../parts';
import { FRAME_LOOK, RARITY_LOOK, frameIdOf } from '../parts/cardLook';
import { missingProfileParts, nextRarity } from './cardProfile';

const SHOWN_PARTS = 4;

/** The back of a card: how complete the profile is and what to fill in to raise the rarity. */
export function CardBack({
  card,
  character,
  state,
  onEdit,
}: {
  card: CharacterCard;
  character: Character;
  state: StoryData;
  onEdit: () => void;
}) {
  const look = FRAME_LOOK[frameIdOf(card.frame)];
  const percent = Math.round(profileCompleteness(state, character) * 100);
  const missing = missingProfileParts(state, character);
  const next = nextRarity(state, character);
  return (
    <View className={`w-full overflow-hidden rounded-xl bg-paper p-3 ${look.outer}`} style={{ aspectRatio: CARD_RATIO }}>
      {!!look.band && <View className={`absolute inset-0 ${look.band}`} />}
      <View className={`flex-1 gap-2 rounded-lg bg-paper p-3 ${look.edge}`}>
        <Text variant="caption" tone="onPaper" className="opacity-75">
          {t('Profile')}
        </Text>
        <Text variant="display" tone="onPaper" maxFontSizeMultiplier={1.2}>
          {t('{percent}%', { percent })}
        </Text>
        <View className="h-1.5 overflow-hidden rounded-full bg-on-paper/15">
          <View className="h-full rounded-full bg-on-paper" style={{ width: `${percent}%` }} />
        </View>
        <Text variant="bodySmall" tone="onPaper" maxFontSizeMultiplier={1.2}>
          {next
            ? tn(next.parts, 'Now {rarity}. Fill in {count} more to make it {next}.', 'Now {rarity}. Fill in {count} more to make it {next}.', {
                rarity: rarityText(card),
                next: t(RARITY_LOOK[next.rarity].label),
              })
            : t('{rarity}: the rarest a card can be.', { rarity: rarityText(card) })}
        </Text>
        <View className="flex-1 gap-1 overflow-hidden">
          {missing.slice(0, SHOWN_PARTS).map(label => (
            <View key={label} className="flex-row items-center gap-1.5">
              <Icon icon={CircleIcon} size={ICON.xs} color="on-paper" />
              <Text variant="caption" tone="onPaper" numberOfLines={1} className="flex-1" maxFontSizeMultiplier={1.2}>
                {t(label)}
              </Text>
            </View>
          ))}
          {missing.length > SHOWN_PARTS && (
            <Text variant="caption" tone="onPaper" className="opacity-75" maxFontSizeMultiplier={1.2}>
              {tn(missing.length - SHOWN_PARTS, 'and {count} more', 'and {count} more')}
            </Text>
          )}
        </View>
        <Button title={t('Fill in the profile')} icon={EditIcon} small onPress={onEdit} />
      </View>
    </View>
  );
}
