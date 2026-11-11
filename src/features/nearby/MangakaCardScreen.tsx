import { useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { t } from '../../core/i18n';
import { activeProjects, initialOf } from '../../core/model/selectors';
import { friendLink } from '../../core/nearby/friendLink';
import { copyText } from '../../native/files';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { mangakaId, useNearbyShare } from '../../state/useNearbyShare';
import { useRoom } from '../../state/useRoom';
import { useSettings } from '../../state/useSettings';
import { AppBar, Button, ICON, IconButton, ListItem, PromptDialog, Screen, Section, Text, confirm, toast, useColor } from '../../ui';
import { CopyIcon, DeleteIcon, EditIcon, ScanIcon, ShareIcon } from '../../ui/icons';
import { shareCardImage } from '../studio/cards/shareCard';
import type { CardViewRef } from '../studio/cards/FlipCard';
import { FriendSheet } from './share/FriendSheet';
import { MangakaCardView } from './share/MangakaCardView';

const CARD_MAX = 360;
const PEN_NAME_MAX = 30;
const STORIES_SHOWN = 3;

/** Your QR business card, and the friends you added by scanning theirs. */
export function MangakaCardScreen() {
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const state = useStoryData();
  const penName = useSettings(s => s.penName).trim();
  const status = useRoom(s => s.status);
  const address = useRoom(s => s.address);
  const friends = useNearbyShare(s => s.friends);
  const pending = useNearbyShare(s => s.pendingFriend);
  const [editingName, setEditingName] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<CardViewRef>(null);
  const accent = useColor('accent');

  const name = penName || t('Mangaka');
  // Newest first, so the card shows what the person is working on now.
  const stories = useMemo(
    () =>
      activeProjects(state)
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(project => project.title.trim())
        .filter(Boolean)
        .slice(0, STORIES_SHOWN),
    [state],
  );
  const room = (status === 'hosting' || status === 'joined') && address ? address : undefined;
  const link = useMemo(() => friendLink({ id: mangakaId(), name, stories, room }), [name, stories, room]);
  const cardWidth = Math.min(CARD_MAX, width - 32);

  const onShare = async () => {
    setSharing(true);
    try {
      await shareCardImage(cardRef, 'mangaka-card', t('{name} on Manganova', { name }));
    } catch {
      toast(t("Couldn't share the card"));
    } finally {
      setSharing(false);
    }
  };

  const onCopy = () => {
    try {
      copyText(link);
      toast(t('Link copied'));
    } catch {
      toast(t("Couldn't copy the link"));
    }
  };

  const onRemove = async (id: string, friendName: string) => {
    if (await confirm(t('Remove {name}?', { name: friendName }), undefined, { confirmText: t('Remove'), destructive: true })) {
      useNearbyShare.getState().removeFriend(id);
    }
  };

  return (
    <Screen scroll>
      <AppBar title={t('Mangaka card')} onBack={() => navigation.goBack()} right={<IconButton icon={EditIcon} onPress={() => setEditingName(true)} accessibilityLabel={t('Change pen name')} />} />
      <View className="items-center gap-3">
        <MangakaCardView name={name} stories={stories} link={link} roomName={room?.name} width={cardWidth} viewRef={cardRef} />
        {!penName && (
          <Button title={t('Add your pen name')} icon={EditIcon} variant="secondary" small onPress={() => setEditingName(true)} />
        )}
        <View className="w-full flex-row gap-2" style={{ maxWidth: CARD_MAX }}>
          <Button title={t('Copy link')} icon={CopyIcon} variant="secondary" className="flex-1" onPress={onCopy} />
          <Button title={t('Share as image')} icon={ShareIcon} className="flex-1" loading={sharing} onPress={onShare} />
        </View>
        <Text variant="caption" tone="muted" className="text-center">
          {room ? t('While this room is open, the code also lets friends join it.') : t('Open a room first and the code will also let friends join it.')}
        </Text>
      </View>

      <Section title={t('Friends')} footer={friends.length === 0 ? t("Scan a friend's mangaka card to add them here.") : undefined}>
        <ListItem
          left={<ScanIcon size={ICON.lg} color={accent} />}
          title={t('Scan a QR code')}
          subtitle={t("Add a friend from their mangaka card")}
          onPress={() => navigation.navigate('ScanCode')}
        />
        {friends.length === 0 ? (
          <ListItem title={t('No friends added yet')} />
        ) : (
          friends.map(friend => (
            <ListItem
              key={friend.id}
              left={
                <View className="h-10 w-10 items-center justify-center rounded-full bg-overlay">
                  <Text variant="label">{initialOf(friend.name)}</Text>
                </View>
              }
              title={friend.name}
              subtitle={friend.stories.length ? friend.stories.join(' · ') : undefined}
              right={<IconButton icon={DeleteIcon} onPress={() => onRemove(friend.id, friend.name)} accessibilityLabel={t('Remove {name}', { name: friend.name })} />}
            />
          ))
        )}
      </Section>

      <FriendSheet card={pending} onClose={() => useNearbyShare.getState().setPendingFriend(null)} />
      <PromptDialog
        visible={editingName}
        onClose={() => setEditingName(false)}
        onSubmit={value => {
          useSettings.getState().set({ penName: value.trim().slice(0, PEN_NAME_MAX) });
          setEditingName(false);
        }}
        title={t('Pen name')}
        message={t('Shown on your mangaka card and to friends in a room.')}
        initialValue={penName}
        maxLength={PEN_NAME_MAX}
      />
    </Screen>
  );
}
