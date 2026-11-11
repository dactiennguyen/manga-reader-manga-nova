import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { t } from '../../core/i18n';
import { listingAddress, listingCodePrefix, parseListingCode, parseRoomCode } from '../../core/nearby/link';
import type { NearbyRoom, RoomAddress } from '../../core/nearby/types';
import { useAppNavigation } from '../../state/navigation';
import { localWifiAddress, useNearbyRooms, useRoom } from '../../state/useRoom';
import { useSettings } from '../../state/useSettings';
import { AppBar, ArtBanner, Banner, Button, Card, Dialog, Divider, FieldLabel, ListItem, Screen, Section, Text, TextField, useColor } from '../../ui';
import { LockIcon, PlayTogetherIcon, WifiIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { JoinModeChoice } from './JoinModeChoice';

const HINT_ART = { width: 80, height: 80 };

/** The name others see: the pen name, or a plain fallback. */
export function useMyName(): string {
  const penName = useSettings(s => s.penName);
  return penName.trim() || t('Mangaka');
}

/** Opens the lobby after joining, unless the room is mid-activity and RoomFollower already went there. */
function useEnterRoom() {
  const navigation = useAppNavigation();
  return () => {
    if (useRoom.getState().room?.activity === 'lobby') {
      navigation.navigate('Room');
    }
  };
}

function HostCard() {
  const navigation = useAppNavigation();
  const myName = useMyName();
  const hostRoom = useRoom(s => s.hostRoom);
  const joinMode = useSettings(s => s.roomJoinMode);
  const [name, setName] = useState(myName);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await hostRoom(myName, name.trim() || myName, joinMode);
      navigation.navigate('Room');
    } catch {
      // The error is in the store and shown as a banner.
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={t('Host a room')} footer={t('Friends see this name in their list of rooms.')}>
      <View className="gap-3 p-3">
        <TextField value={name} onChangeText={setName} placeholder={t('Room name')} maxLength={40} accessibilityLabel={t('Room name')} />
        <View className="gap-1">
          <FieldLabel>{t('Who can join')}</FieldLabel>
          <JoinModeChoice value={joinMode} onChange={mode => useSettings.getState().set({ roomJoinMode: mode })} />
        </View>
        <Button title={t('Create a room')} icon={PlayTogetherIcon} loading={busy} onPress={create} />
      </View>
    </Section>
  );
}

function NearbyRooms({
  onJoin,
  onLocked,
  joining,
}: {
  onJoin: (address: RoomAddress) => void;
  onLocked: (room: NearbyRoom) => void;
  joining: string | null;
}) {
  const rooms = useNearbyRooms();
  const muted = useColor('text-muted');
  return (
    <Section title={t('Rooms on this Wi-Fi')}>
      {rooms.length === 0 ? (
        <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
          <ActivityIndicator size="small" color={muted} />
          <Text variant="bodySmall" tone="secondary" className="flex-1">
            {t('Looking for rooms nearby…')}
          </Text>
        </View>
      ) : (
        rooms.map((room, index) => {
          const key = `${room.host}:${room.port}`;
          // A code-only room has no token in its advert: tapping it asks for the code instead of joining.
          const address = listingAddress(room);
          const idle = address ? t('Tap to join') : t('Room code needed');
          return (
            <View key={key}>
              {index > 0 && <Divider inset={16} />}
              <ListItem
                icon={address ? PlayTogetherIcon : LockIcon}
                title={room.name || t('Room')}
                subtitle={joining === key ? t('Joining…') : idle}
                disabled={!!joining}
                chevron
                onPress={() => (address ? onJoin(address) : onLocked(room))}
              />
            </View>
          );
        })
      )}
    </Section>
  );
}

function CodeCard({ onJoin, busy }: { onJoin: (address: RoomAddress) => void; busy: boolean }) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const join = async () => {
    const address = parseRoomCode(code, await localWifiAddress());
    setWrong(!address);
    if (address) {
      onJoin(address);
    }
  };
  return (
    <Section title={t('Join with a room code')} footer={t("Or scan the host's QR code with your phone's camera.")}>
      <View className="gap-3 p-3">
        <TextField
          value={code}
          onChangeText={value => {
            setCode(value.toUpperCase());
            setWrong(false);
          }}
          placeholder="ABCDE-FGHJK"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          accessibilityLabel={t('Room code')}
          onSubmitEditing={join}
        />
        {wrong && (
          <Text variant="bodySmall" tone="danger">
            {t('A room code has 10 letters and numbers.')}
          </Text>
        )}
        <Button title={t('Join')} variant="secondary" loading={busy} disabled={code.replace(/[\s-]/g, '').length < 10} onPress={join} />
      </View>
    </Section>
  );
}

/** The room code for a locked room tapped in the list. Its start is filled in, so only the last part is typed. */
function LockedRoomDialog({ room, onClose, onJoin }: { room: NearbyRoom | null; onClose: () => void; onJoin: (address: RoomAddress) => void }) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState<'format' | 'mismatch' | null>(null);
  const [shownFor, setShownFor] = useState<NearbyRoom | null>(null);
  if (room !== shownFor) {
    // A new room was tapped: start again from its filled-in start.
    setShownFor(room);
    setCode(room ? (listingCodePrefix(room) ?? '') : '');
    setWrong(null);
  }
  // The last 4 characters alone, or a whole code (with or without the filled-in start).
  const typed = code.replace(/[\s-]/g, '').length;
  const ready = typed === 4 || typed >= 10;
  const join = () => {
    const address = room && ready ? parseListingCode(code, room) : null;
    // The last characters also carry part of the port, so a mistyped code points at another port: say the
    // code is wrong here instead of trying it and reporting the room as unreachable. The address is not
    // compared, since a host with two networks can show a code for one and be listed under the other.
    const here = !!address && !!room && address.port === room.port;
    setWrong(!address ? 'format' : here ? null : 'mismatch');
    if (address && here) {
      onClose();
      onJoin(address);
    }
  };
  return (
    <Dialog
      visible={!!room}
      onClose={onClose}
      title={t('Join {room}', { room: room?.name || t('Room') })}
      message={t('Ask the host for the code or scan their QR.')}
      actions={[
        { label: t('Cancel'), onPress: onClose, variant: 'ghost' },
        { label: t('Join'), onPress: join, variant: 'primary', disabled: !ready },
      ]}
    >
      <TextField
        value={code}
        onChangeText={value => {
          setCode(value.toUpperCase());
          setWrong(null);
        }}
        placeholder="ABCDE-FGHJK"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={20}
        accessibilityLabel={t('Room code')}
        onSubmitEditing={join}
      />
      {wrong && (
        <Text variant="bodySmall" tone="danger">
          {wrong === 'mismatch' ? t('That room code is not right. Ask the host to show it again.') : t('A room code has 10 letters and numbers.')}
        </Text>
      )}
    </Dialog>
  );
}

function WifiHint() {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Image accessibilityIgnoresInvertColors source={NEARBY_ART.wifi} className="rounded-md bg-paper" style={HINT_ART} />
      <View className="flex-1 gap-1">
        <Text variant="label">{t('Same Wi-Fi, no internet needed')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('Everyone joins the same Wi-Fi. Drawings and stories go straight from phone to phone and never leave the room.')}
        </Text>
      </View>
    </Card>
  );
}

/** The Play-together hub: host a room, see rooms nearby, or join with a code. */
export function NearbyScreen() {
  const navigation = useAppNavigation();
  const myName = useMyName();
  const { status, room, error, joinRoom, reset } = useRoom();
  const enterRoom = useEnterRoom();
  const [joining, setJoining] = useState<string | null>(null);
  const [locked, setLocked] = useState<NearbyRoom | null>(null);
  const inRoom = status === 'hosting' || status === 'joined';

  const join = async (address: RoomAddress) => {
    setJoining(`${address.host}:${address.port}`);
    try {
      await joinRoom(address, myName);
      enterRoom();
    } catch {
      // Shown as a banner from the store.
    } finally {
      setJoining(null);
    }
  };

  return (
    <Screen scroll keyboard>
      <AppBar title={t('Play together')} onBack={() => navigation.goBack()} />
      <ArtBanner source={NEARBY_ART.hub} ratio={2} />
      <Text tone="secondary">{t('Draw, read and play with friends in the same room, each on their own phone.')}</Text>
      {inRoom && room && (
        <Banner icon={PlayTogetherIcon} text={t("You're in {room}", { room: room.name })} action={{ label: t('Open'), onPress: () => navigation.navigate('Room') }} />
      )}
      {status === 'error' && !!error && <Banner tone="danger" icon={WifiIcon} text={error} action={{ label: t('OK'), onPress: reset }} />}
      {!inRoom && (
        <>
          <HostCard />
          <NearbyRooms onJoin={join} onLocked={setLocked} joining={joining} />
          <CodeCard onJoin={join} busy={!!joining} />
        </>
      )}
      <LockedRoomDialog room={locked} onClose={() => setLocked(null)} onJoin={join} />
      <WifiHint />
    </Screen>
  );
}
