import { Image, View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { memberColor } from '../../core/nearby/colors';
import { roomCode, roomLink } from '../../core/nearby/link';
import type { JoinMode, Member, RoomAddress } from '../../core/nearby/types';
import { useAppNavigation } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { useSettings } from '../../state/useSettings';
import { AppBar, Badge, Banner, Card, confirm, EmptyState, IconButton, Pressable, QrCode, Screen, Section, SectionHeader, Text } from '../../ui';
import { LeaveIcon, PlayTogetherIcon, WifiIcon } from '../../ui/icons';
import { ACTIVITY_CARDS, type ActivityCard } from './activities';
import { JoinModeChoice } from './JoinModeChoice';

const QR_SIZE = 168;
const TILE_ART = 88;

function MemberRow({ member, me }: { member: Member; me: boolean }) {
  return (
    <View className="min-h-12 flex-row items-center gap-3 px-4 py-2">
      {/* Their ink: the same colour as their cursor and strokes. The name always goes with it. */}
      <View className="h-4 w-4 rounded-full" style={{ backgroundColor: memberColor(member.color) }} />
      <Text className="flex-1" numberOfLines={1}>
        {member.name}
      </Text>
      {me && <Badge text={t('You')} tone="success" />}
      {member.host && <Badge text={t('Host')} />}
    </View>
  );
}

function InviteCard({ address }: { address: RoomAddress }) {
  const code = roomCode(address);
  return (
    <Card className="flex-row items-center gap-4 p-3">
      <QrCode value={roomLink(address)} size={QR_SIZE} accessibilityLabel={t('QR code to join this room')} />
      <View className="flex-1 gap-2">
        <Text variant="label">{t('Invite friends')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('Scan with the camera, or type the room code in Play together.')}
        </Text>
        {!!code && (
          <Text variant="heading" selectable accessibilityLabel={`${t('Room code')}: ${code.split('').join(' ')}`} style={{ fontVariant: ['tabular-nums'] }}>
            {code}
          </Text>
        )}
      </View>
    </Card>
  );
}

/** Host only: who can join from now on. The room is announced again; people already here stay. */
function JoinModeSection() {
  const joinMode = useRoom(s => s.joinMode);
  const setJoinMode = useRoom(s => s.setJoinMode);
  const change = (mode: JoinMode) => {
    setJoinMode(mode);
    useSettings.getState().set({ roomJoinMode: mode });
  };
  return (
    <Section title={t('Who can join')} footer={t('Changing this does not remove anyone already in the room.')}>
      <View className="px-4 py-1">
        <JoinModeChoice value={joinMode} onChange={change} />
      </View>
    </Section>
  );
}

function ActivityTile({ card, isHost, onPick }: { card: ActivityCard; isHost: boolean; onPick: () => void }) {
  const title = t(card.title);
  const blurb = t(card.blurb);
  return (
    <Pressable
      accessibilityLabel={`${title}. ${blurb}`}
      accessibilityState={{ disabled: !isHost }}
      disabled={!isHost}
      onPress={onPick}
      className="min-h-12 flex-1 gap-2 overflow-hidden rounded-lg bg-surface p-3"
    >
      <Image
        accessibilityIgnoresInvertColors
        source={card.art}
        className="self-center rounded-md bg-paper"
        style={{ width: TILE_ART, height: TILE_ART }}
      />
      <Text variant="label" numberOfLines={1}>
        {title}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {blurb}
      </Text>
    </Pressable>
  );
}

function ActivityGrid({ isHost, onPick }: { isHost: boolean; onPick: (card: ActivityCard) => void }) {
  const rows: ActivityCard[][] = [];
  for (let i = 0; i < ACTIVITY_CARDS.length; i += 2) {
    rows.push(ACTIVITY_CARDS.slice(i, i + 2));
  }
  return (
    <View className="gap-2">
      <SectionHeader>{t('Play|activities')}</SectionHeader>
      {!isHost && (
        <Text variant="bodySmall" tone="secondary">
          {t('The host picks what to play. Your phone follows along.')}
        </Text>
      )}
      {rows.map(row => (
        <View key={row[0].activity} className="flex-row gap-2">
          {row.map(card => (
            <ActivityTile key={card.activity} card={card} isHost={isHost} onPick={() => onPick(card)} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** The lobby: who is here, how to invite more, and (for the host) what to play next. */
export function RoomScreen() {
  const navigation = useAppNavigation();
  const { status, room, me, address, reconnecting, leaveRoom, setActivity } = useRoom();
  const inRoom = (status === 'hosting' || status === 'joined') && !!room && !!me;

  if (!inRoom) {
    return (
      <Screen>
        <AppBar title={t('Room')} onBack={() => navigation.goBack()} />
        <EmptyState
          icon={PlayTogetherIcon}
          title={t('Not in a room')}
          message={t('Host a room or join one nearby.')}
          action={{ label: t('Play together'), onPress: () => navigation.navigate('Nearby') }}
        />
      </Screen>
    );
  }

  const isHost = me.host;
  const leave = async () => {
    const ok = await confirm(
      isHost ? t('End the room?') : t('Leave the room?'),
      isHost ? t('Everyone in the room will be disconnected.') : undefined,
      { confirmText: isHost ? t('End room') : t('Leave'), destructive: true },
    );
    if (ok) {
      leaveRoom();
      navigation.goBack();
    }
  };

  return (
    <Screen scroll>
      <AppBar
        title={room.name}
        subtitle={tn(room.members.length, '{count} person', '{count} people')}
        onBack={() => navigation.goBack()}
        right={<IconButton icon={LeaveIcon} accessibilityLabel={isHost ? t('End room') : t('Leave the room')} onPress={leave} />}
      />
      {reconnecting && <Banner tone="warning" icon={WifiIcon} text={t('Connection lost. Reconnecting…')} />}
      <Section title={t('In the room')}>
        {room.members.map(member => (
          <MemberRow key={member.id} member={member} me={member.id === me.id} />
        ))}
      </Section>
      {!!address && <InviteCard address={address} />}
      {isHost && <JoinModeSection />}
      <ActivityGrid isHost={isHost} onPick={card => setActivity(card.activity)} />
    </Screen>
  );
}
