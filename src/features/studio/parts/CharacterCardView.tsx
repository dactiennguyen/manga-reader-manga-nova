import { Image, View } from 'react-native';

import { t } from '../../../core/i18n';
import { ROLE_LABEL } from '../../../core/model/constants';
import type { Character } from '../../../core/model/types';
import type { CharacterCard } from '../../../core/studio/types';
import { fileUri } from '../../../core/util/paths';
import { Icon, Text } from '../../../ui';
import { StarIcon } from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';
import { FRAME_LOOK, RARITY_LOOK, STAT_LABEL, frameIdOf } from './cardLook';

const STATS = ['power', 'wit', 'charm', 'heart'] as const;

/** Cards keep their proportions whatever the width, like a printed trading card. */
export const CARD_RATIO = 5 / 7;

export function rarityText(card: Pick<CharacterCard, 'rarity'>): string {
  return t(RARITY_LOOK[card.rarity].label);
}

function RarityMark({ card, compact }: { card: CharacterCard; compact?: boolean }) {
  const look = RARITY_LOOK[card.rarity];
  return (
    <View className="flex-row items-center gap-1">
      <View className="flex-row">
        {Array.from({ length: look.stars }, (_, index) => (
          <Icon key={index} icon={StarIcon} size={compact ? ICON.xs : ICON.sm} color="on-paper" weight="fill" />
        ))}
      </View>
      {!compact && (
        <Text variant="caption" tone="onPaper" maxFontSizeMultiplier={1.2}>
          {rarityText(card)}
        </Text>
      )}
    </View>
  );
}

function Portrait({ character }: { character: Character | undefined }) {
  const face = character?.sheet.face;
  const initial = character?.name.trim().slice(0, 1).toUpperCase() || '?';
  return (
    <View className="flex-1 items-center justify-center overflow-hidden rounded-md border border-on-paper/20">
      {face ? (
        <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(face) }} resizeMode="cover" className="absolute inset-0 h-full w-full" />
      ) : (
        <Text variant="display" tone="onPaper" className="opacity-60" maxFontSizeMultiplier={1}>
          {initial}
        </Text>
      )}
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text variant="caption" tone="onPaper" className="w-20" numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-on-paper/15">
        <View className="h-full rounded-full bg-on-paper" style={{ width: `${value}%` }} />
      </View>
      <Text variant="mono" tone="onPaper" className="w-6 text-right" maxFontSizeMultiplier={1.2}>
        {value}
      </Text>
    </View>
  );
}

/** One accessible sentence for the whole card, since its parts read poorly one by one. */
export function cardLabel(card: CharacterCard, character: Character | undefined): string {
  const name = character?.name.trim() || t('Unnamed');
  const stats = STATS.map(key => `${t(STAT_LABEL[key])} ${card.stats[key]}`).join(', ');
  return `${name}, ${rarityText(card)}. ${stats}.`;
}

/**
 * The front of a character card: name, role, portrait (the sheet face, else a typeset initial), rarity,
 * the four stats and a quote. `compact` drops role, labels and the quote for strips and grids.
 */
export function CharacterCardView({
  card,
  character,
  compact,
}: {
  card: CharacterCard;
  character: Character | undefined;
  compact?: boolean;
}) {
  const look = FRAME_LOOK[frameIdOf(card.frame)];
  const name = character?.name.trim() || t('Unnamed');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={cardLabel(card, character)}
      className={`w-full overflow-hidden bg-paper ${compact ? 'rounded-lg p-1.5' : 'rounded-xl p-3'} ${look.outer}`}
      style={{ aspectRatio: CARD_RATIO }}
    >
      {!!look.band && <View className={`absolute inset-0 ${look.band}`} />}
      <View className={`flex-1 bg-paper ${compact ? 'gap-1 rounded-md p-1.5' : 'gap-2 rounded-lg p-3'} ${look.edge}`}>
        <View className={compact ? 'gap-0.5' : 'flex-row items-start justify-between gap-1'}>
          <View className={compact ? '' : 'flex-1'}>
            <Text variant={compact ? 'label' : 'title'} tone="onPaper" numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {name}
            </Text>
            {!compact && !!character && (
              <Text variant="caption" tone="onPaper" className="opacity-75" numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {t(ROLE_LABEL[character.role])}
              </Text>
            )}
          </View>
          <RarityMark card={card} compact={compact} />
        </View>
        <Portrait character={character} />
        {compact ? (
          <View className="flex-row justify-between">
            {STATS.map(key => (
              <Text key={key} variant="caption" tone="onPaper" maxFontSizeMultiplier={1}>
                {card.stats[key]}
              </Text>
            ))}
          </View>
        ) : (
          <>
            <View className="gap-1">
              {STATS.map(key => (
                <StatRow key={key} label={t(STAT_LABEL[key])} value={card.stats[key]} />
              ))}
            </View>
            {!!card.quote && (
              <Text variant="bodySmall" tone="onPaper" className="italic" numberOfLines={2} maxFontSizeMultiplier={1.2}>
                {t('“{quote}”', { quote: card.quote })}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}
