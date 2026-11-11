import { useState } from 'react';
import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { initialOf } from '../../../core/model/selectors';
import type { FriendCard } from '../../../core/nearby/friendLink';
import { useAppNavigation } from '../../../state/navigation';
import { useNearbyShare } from '../../../state/useNearbyShare';
import { useRoom } from '../../../state/useRoom';
import { useSettings } from '../../../state/useSettings';
import { Button, Sheet, Text, toast } from '../../../ui';
import { AddUserIcon, ConnectionIcon } from '../../../ui/icons';

/** A friend card opened from a scanned QR code: add them, and join their room if the card carries one. */
export function FriendSheet({ card, onClose }: { card: FriendCard | null; onClose: () => void }) {
  const navigation = useAppNavigation();
  const known = useNearbyShare(s => (card ? s.friends.some(friend => friend.id === card.id) : false));
  const penName = useSettings(s => s.penName);
  const [joining, setJoining] = useState(false);
  // A card shown in the room you are both in carries that room: there is nothing to join.
  const sameRoom = useRoom(s => (s.status === 'hosting' || s.status === 'joined') && !!card?.room && s.address?.token === card.room.token);
  const room = sameRoom ? undefined : card?.room;

  const add = () => {
    if (!card) {
      return;
    }
    const added = useNearbyShare.getState().addFriend(card);
    toast(added ? t('{name} is now your friend', { name: card.name }) : t('Updated {name}', { name: card.name }));
    if (!room) {
      onClose();
    }
  };

  const join = async () => {
    if (!card || !room) {
      return;
    }
    useNearbyShare.getState().addFriend(card);
    setJoining(true);
    try {
      await useRoom.getState().joinRoom(room, penName.trim() || t('Guest'));
      onClose();
      navigation.navigate('Room');
    } catch {
      toast(useRoom.getState().error ?? t("Can't reach that room. Check that both phones are on the same Wi-Fi."));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Sheet visible={!!card} onClose={onClose} title={t('Mangaka card')}>
      {!!card && (
        <View className="gap-4 px-4 pb-2">
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-overlay">
              <Text variant="title">{initialOf(card.name)}</Text>
            </View>
            <View className="flex-1">
              <Text variant="title" numberOfLines={2}>
                {card.name}
              </Text>
              {known && (
                <Text variant="caption" tone="muted">
                  {t('Already your friend')}
                </Text>
              )}
            </View>
          </View>
          {card.stories.length > 0 && (
            <View className="gap-1">
              <Text variant="label">{t('Their stories')}</Text>
              {card.stories.map(title => (
                <Text key={title} tone="secondary" numberOfLines={1}>
                  {title}
                </Text>
              ))}
            </View>
          )}
          <Button title={known ? t('Update friend') : t('Add to friends')} icon={AddUserIcon} variant={room ? 'secondary' : 'primary'} onPress={add} />
          {!!room && (
            <Button
              title={t('Join their room')}
              icon={ConnectionIcon}
              loading={joining}
              onPress={join}
            />
          )}
        </View>
      )}
    </Sheet>
  );
}
