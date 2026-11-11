import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { t } from '../../../core/i18n';
import type { Character, StoryData } from '../../../core/model/types';
import { characterCard } from '../../../core/studio/cards';
import { unlockedOf } from '../../../core/studio/rewards';
import type { StudioState } from '../../../core/studio/types';
import { useAppNavigation } from '../../../state/navigation';
import { useStudio } from '../../../state/useStudio';
import { Button, Chip, ChipRow, Sheet, Text, toast } from '../../../ui';
import { FlipIcon, ShareIcon } from '../../../ui/icons';
import { CharacterCardView, FRAME_TITLE, frameIdOf, type CardFrameId } from '../parts';
import { CardBack } from './CardBack';
import { FlipCard, type CardViewRef } from './FlipCard';
import { shareCardImage } from './shareCard';

const CARD_MAX = 320;
/** Long enough for the flip back to the front to finish before the snapshot. */
const FLIP_BACK_MS = 700;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** One card up close: flip it, pick its frame from the won ones, share it as a picture. */
export function CardSheet({
  character,
  state,
  studio,
  onClose,
}: {
  character: Character | null;
  state: StoryData;
  studio: StudioState;
  onClose: () => void;
}) {
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const [flipped, setFlipped] = useState(false);
  const [sharing, setSharing] = useState(false);
  const front = useRef<CardViewRef>(null);
  // Keeps the last card on screen while the sheet slides away.
  const [shown, setShown] = useState(character);
  useEffect(() => {
    if (character) {
      setShown(character);
      setFlipped(false);
    }
  }, [character]);

  const cardWidth = Math.min(CARD_MAX, width - 64);
  const frames: CardFrameId[] = ['plain', ...unlockedOf(studio, 'cardFrame').map(reward => frameIdOf(reward.payload[0]))];
  const card = shown ? characterCard(state, shown.id, studio) : null;

  const onShare = async () => {
    if (!shown) {
      return;
    }
    setSharing(true);
    try {
      if (flipped) {
        setFlipped(false);
        await wait(FLIP_BACK_MS);
      }
      await shareCardImage(front, `card-${shown.id}`, shown.name.trim() || t('Character card'));
    } catch {
      toast(t("Couldn't share the card"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet visible={!!character} onClose={onClose} title={t('Character card')}>
      {!!shown && !!card && (
        <View className="items-center gap-4 px-4 pb-2">
          <FlipCard
            width={cardWidth}
            flipped={flipped}
            frontRef={front}
            front={<CharacterCardView card={card} character={shown} />}
            back={
              <CardBack
                card={card}
                character={shown}
                state={state}
                onEdit={() => {
                  onClose();
                  navigation.navigate('Character', { characterId: shown.id });
                }}
              />
            }
          />
          <View className="w-full flex-row gap-2">
            <Button
              title={flipped ? t('Show front') : t('Turn over')}
              icon={FlipIcon}
              variant="secondary"
              className="flex-1"
              onPress={() => setFlipped(value => !value)}
            />
            <Button title={t('Share as image')} icon={ShareIcon} className="flex-1" loading={sharing} onPress={onShare} />
          </View>
          <View className="w-full gap-2">
            <Text variant="label">{t('Frame')}</Text>
            <ChipRow>
              {frames.map(frame => (
                <Chip
                  key={frame}
                  label={t(FRAME_TITLE[frame])}
                  selected={card.frame === frame}
                  onPress={() => useStudio.getState().setCardFrame(shown.id, frame)}
                />
              ))}
            </ChipRow>
            {frames.length === 1 && (
              <Text variant="caption" tone="muted">
                {t('More frames come in gifts. Open them on your mangaka journey.')}
              </Text>
            )}
          </View>
        </View>
      )}
    </Sheet>
  );
}
