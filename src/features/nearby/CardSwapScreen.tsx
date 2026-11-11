import { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { t, tn } from '../../core/i18n';
import { activeProjects, charactersOf } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { cardBlob, cardSnapshot, readCardBlob, type CardSnapshot } from '../../core/nearby/cardSwap';
import { characterCard } from '../../core/studio/cards';
import { removeFile } from '../../native/files';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { mangakaId, useNearbyShare } from '../../state/useNearbyShare';
import { useRoom } from '../../state/useRoom';
import { useSettings } from '../../state/useSettings';
import { useStudioState } from '../../state/useMetrics';
import { AppBar, Button, EmptyState, Pressable, Screen, SectionHeader, Sheet, Text, toast } from '../../ui';
import { CardsIcon, SendIcon } from '../../ui/icons';
import { CharacterCardView, cardLabel } from '../studio/parts';
import { ArrivingCard } from './share/FriendCardViews';
import { faceThumbnail, saveFace } from './share/shareFiles';
import { NoRoom, useShareRoom } from './share/useShareRoom';

const GAP = 12;
const CARD_MAX = 300;

type Arrival = { blobId: string; from: string; card: CardSnapshot; face?: string };

/** Offer one of your character cards to the room; cards friends offer flip in and can be kept. */
export function CardSwapScreen() {
  const navigation = useAppNavigation();
  const { inRoom, me, nameOf } = useShareRoom();
  const state = useStoryData();
  const studio = useStudioState();
  const penName = useSettings(s => s.penName);
  const kept = useNearbyShare(s => s.cards.length);
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState<ID | null>(null);
  const [offering, setOffering] = useState(false);
  const [queue, setQueue] = useState<Arrival[]>([]);
  /** Face pictures saved for arrivals not yet kept or passed on; deleted if the screen closes first. */
  const pendingFaces = useRef(new Set<string>());
  const mounted = useRef(true);

  const characters = useMemo(() => activeProjects(state).flatMap(project => charactersOf(state, project.id)), [state]);
  const columns = width >= 600 ? 4 : 3;
  const cardWidth = Math.floor((Math.min(width, 1000) - 32 - GAP * (columns - 1)) / columns);
  const bigWidth = Math.min(CARD_MAX, width - 64);
  const meId = me?.id;

  useEffect(() => {
    const faces = pendingFaces.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Cards still waiting when the screen closes were never kept, so their pictures are not needed.
      faces.forEach(face => removeFile(face).catch(() => undefined));
      faces.clear();
    };
  }, []);

  useEffect(() => {
    if (!inRoom) {
      return;
    }
    return useRoom.getState().onBlob(blob => {
      if (blob.kind !== 'card' || blob.from === meId) {
        return;
      }
      const payload = readCardBlob(blob.data);
      if (!payload) {
        return;
      }
      saveFace(payload.face).then(face => {
        if (!mounted.current) {
          removeFile(face).catch(() => undefined);
          return;
        }
        if (face) {
          pendingFaces.current.add(face);
        }
        setQueue(list => [...list, { blobId: blob.id, from: blob.from, card: payload.card, face }]);
      });
    });
  }, [inRoom, meId]);

  const onOffer = async () => {
    const character = picked ? state.characters[picked] : undefined;
    if (!character || !me) {
      return;
    }
    setOffering(true);
    try {
      const card = cardSnapshot(state, character.id, studio, { id: mangakaId(), name: penName.trim() || me.name });
      if (!card) {
        return;
      }
      const face = (await faceThumbnail(character.sheet.face)) ?? undefined;
      await useRoom.getState().sendBlob('card', cardBlob(face ? { card, face } : { card }), { card: card.key });
      toast(t('Card offered to everyone in the room'));
      setPicked(null);
    } catch {
      toast(t("Couldn't send the card. Check the Wi-Fi and try again."));
    } finally {
      setOffering(false);
    }
  };

  const arrival = queue[0];
  const next = (keep: boolean) => {
    if (!arrival) {
      return;
    }
    if (arrival.face) {
      pendingFaces.current.delete(arrival.face);
    }
    if (keep) {
      useNearbyShare.getState().keepCard({ ...arrival.card, face: arrival.face, receivedAt: Date.now() });
      useRoom.getState().send({ t: 'cards.keep', from: meId ?? '', blobId: arrival.blobId }, arrival.from);
      toast(t("Kept in Friends' cards"));
    } else {
      removeFile(arrival.face).catch(() => undefined);
    }
    setQueue(list => list.slice(1));
  };

  useEffect(() => {
    if (!inRoom) {
      return;
    }
    return useRoom.getState().onMessage('cards.keep', (_message, from) => toast(t('{name} kept your card', { name: nameOf(from) })));
  }, [inRoom, nameOf]);

  const pickedCharacter = picked ? state.characters[picked] : undefined;

  return (
    <Screen scroll>
      <AppBar
        title={t('Card swap')}
        onBack={() => navigation.goBack()}
        right={<Button title={tn(kept, "{count} friend's card", "{count} friends' cards")} variant="ghost" small onPress={() => navigation.navigate('Cards')} />}
      />
      {!inRoom ? (
        <NoRoom art="cards" message={t('Swap character cards with friends on the same Wi-Fi. Open or join a room to start.')} />
      ) : characters.length === 0 ? (
        <EmptyState
          icon={CardsIcon}
          title={t('No cards to offer yet')}
          message={t('Every character you create becomes a card. You can still keep the cards friends offer.')}
        />
      ) : (
        <View className="gap-2">
          <SectionHeader>{t('Pick a card to offer')}</SectionHeader>
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {characters.map(character => {
              const card = characterCard(state, character.id, studio);
              return (
                <Pressable
                  key={character.id}
                  accessibilityRole="button"
                  accessibilityLabel={cardLabel(card, character)}
                  accessibilityHint={t('Opens the card to offer it')}
                  onPress={() => setPicked(character.id)}
                  style={{ width: cardWidth }}
                >
                  <CharacterCardView card={card} character={character} compact />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {inRoom && (
        <Text variant="caption" tone="muted">
          {t('Friends get a copy of the card as it is now. Your character stays yours.')}
        </Text>
      )}

      <Sheet visible={!!pickedCharacter && !arrival} onClose={() => setPicked(null)} title={t('Offer this card?')}>
        {!!pickedCharacter && (
          <View className="items-center gap-4 px-4 pb-2">
            <View style={{ width: bigWidth }}>
              <CharacterCardView card={characterCard(state, pickedCharacter.id, studio)} character={pickedCharacter} />
            </View>
            <Button title={t('Offer to everyone')} icon={SendIcon} loading={offering} className="w-full" onPress={onOffer} />
          </View>
        )}
      </Sheet>

      <Sheet visible={!!arrival} onClose={() => next(false)} title={arrival ? t('{name} offers you a card', { name: nameOf(arrival.from) }) : undefined}>
        {!!arrival && (
          <View className="items-center gap-4 px-4 pb-2">
            <ArrivingCard card={{ ...arrival.card, face: arrival.face }} width={bigWidth} />
            <View className="w-full flex-row gap-2">
              <Button title={t('Not now')} variant="secondary" className="flex-1" onPress={() => next(false)} />
              <Button title={t('Keep it')} icon={CardsIcon} className="flex-1" onPress={() => next(true)} />
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
