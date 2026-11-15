import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { brushFileForSet } from '../../core/art/brushFile';
import { setContents } from '../../core/art/presetSets';
import { t } from '../../core/i18n';
import {
  createBrushShareController,
  isBrushTransferEnded,
  type BrushShareController,
  type BrushTransfer,
} from '../../core/nearby/brushShare';
import type { MemberId } from '../../core/nearby/types';
import { uid } from '../../core/util/id';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useArtPresets } from '../../state/useArtPresets';
import { useRoom } from '../../state/useRoom';
import { AppBar, Banner, Button, Card, Chip, ChipRow, Icon, ListItem, Screen, Section, Text } from '../../ui';
import { CheckIcon, DoneIcon, MoveToIcon, PlayTogetherIcon, SendIcon } from '../../ui/icons';
import { NoRoom, roomPort, useShareRoom } from '../nearby/share/useShareRoom';
import { countLabel, setLabel } from './labels';
import { SetCover } from './parts';

function statusText(transfer: BrushTransfer, peer: string): string {
  const params = { name: peer };
  switch (transfer.status) {
    case 'offered':
      return t('Waiting for {name} to accept', params);
    case 'incoming':
      return t('{name} wants to send you brushes', params);
    case 'sending':
      return t('Sending to {name}', params);
    case 'receiving':
      return t('Receiving from {name}', params);
    case 'received':
      return t('Here. Choose what to keep.');
    case 'done':
      return transfer.direction === 'in' ? t('Here. Choose what to keep.') : t('{name} has it now', params);
    case 'declined':
      return transfer.direction === 'in' ? t('You said no') : t('{name} said no', params);
    case 'cancelled':
      return t('Cancelled');
    case 'failed':
      return t("Couldn't finish. Check the Wi-Fi and try again.");
  }
}

function TransferCard({ transfer, peer, controller }: { transfer: BrushTransfer; peer: string; controller: BrushShareController }) {
  const navigation = useAppNavigation();
  return (
    <Card className="gap-2 p-4">
      <Text variant="label" numberOfLines={1}>
        {transfer.name || t('Shared brushes')}
      </Text>
      <Text variant="caption" tone="muted">
        {countLabel(transfer.brushes, transfer.tones)}
      </Text>
      <Text variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
        {statusText(transfer, peer)}
      </Text>
      <View className="flex-row gap-2">
        {transfer.status === 'incoming' && (
          <>
            <Button title={t('Not now')} variant="secondary" small className="flex-1" onPress={() => controller.decline(transfer.id)} />
            <Button title={t('Accept')} icon={CheckIcon} small className="flex-1" onPress={() => controller.accept(transfer.id)} />
          </>
        )}
        {!isBrushTransferEnded(transfer) && transfer.status !== 'incoming' && (
          <Button title={t('Cancel')} variant="secondary" small onPress={() => controller.cancel(transfer.id)} />
        )}
        {transfer.status === 'received' && !!transfer.text && (
          <Button
            title={t('Review and import')}
            icon={MoveToIcon}
            small
            onPress={() => navigation.navigate('BrushImport', { text: transfer.text! })}
          />
        )}
      </View>
    </Card>
  );
}

/**
 * Share brushes, an activity in Play together: pick one of your sets and a friend; once they say yes the set
 * goes over the Wi-Fi as a small .mnbrush file and opens in their import screen. Friends receive on this
 * screen too, so the host can open it for everyone.
 */
export function ShareBrushesScreen() {
  const navigation = useAppNavigation();
  const params = useAppRoute<'ShareBrushes'>().params;
  const { inRoom, isHost, room, others, nameOf } = useShareRoom();
  const presets = useArtPresets();
  const [to, setTo] = useState<MemberId | null>(null);
  const [setId, setSetId] = useState<string | null>(params?.setId ?? null);
  const [transfers, setTransfers] = useState<BrushTransfer[]>([]);
  const controller = useRef<BrushShareController | null>(null);

  useEffect(() => {
    if (!inRoom) {
      return;
    }
    const next = createBrushShareController(roomPort(), setTransfers, uid);
    controller.current = next;
    return () => {
      // Leaving the screen ends what is still open, so the other phone is not left waiting.
      next.transfers().forEach(item => (item.status === 'incoming' ? next.decline(item.id) : next.cancel(item.id)));
      next.dispose();
      controller.current = null;
    };
  }, [inRoom]);

  const target = to && others.some(member => member.id === to) ? to : null;
  const chosenSet = presets.sets.find(set => set.id === setId);
  const chosenContents = chosenSet ? setContents(presets, chosenSet.id) : null;
  const sendable = !!chosenContents && chosenContents.brushes.length + chosenContents.tones.length > 0;
  const elsewhere = !!room && room.activity !== 'brushes';

  const onSend = () => {
    if (!controller.current || !target || !chosenSet) {
      return;
    }
    const file = brushFileForSet(presets, chosenSet.id, setLabel(chosenSet));
    if (file) {
      controller.current.offer(file, target);
    }
  };

  return (
    <Screen scroll>
      <AppBar title={t('Share brushes')} onBack={() => navigation.goBack()} />
      {!inRoom ? (
        <NoRoom art="brushes" message={t('Brushes go straight from phone to phone over your Wi-Fi. Open or join a room to start.')} />
      ) : (
        <>
          {/* Only phones on this screen can receive: the host can bring everyone here. */}
          {elsewhere && (
            <Banner
              icon={PlayTogetherIcon}
              text={
                isHost
                  ? t('Friends receive brushes on this screen too.')
                  : t('Your friend needs this screen open to receive. Ask the host to choose Share brushes.')
              }
              action={isHost ? { label: t('Open for everyone'), onPress: () => useRoom.getState().setActivity('brushes') } : undefined}
            />
          )}
          {transfers.length > 0 && controller.current && (
            <View className="gap-2">
              {[...transfers].reverse().map(item => (
                <TransferCard key={item.id} transfer={item} peer={nameOf(item.peer)} controller={controller.current!} />
              ))}
            </View>
          )}
          <View className="gap-2">
            <Text variant="heading">{t('Send to')}</Text>
            {others.length === 0 ? (
              <Text variant="bodySmall" tone="muted">
                {t('No one else is in the room yet.')}
              </Text>
            ) : (
              <ChipRow>
                {others.map(member => (
                  <Chip key={member.id} label={member.name} selected={target === member.id} onPress={() => setTo(member.id)} />
                ))}
              </ChipRow>
            )}
          </View>
          <Section title={t('My sets')}>
            {presets.sets.map(set => {
              const inside = setContents(presets, set.id);
              const empty = !inside.brushes.length && !inside.tones.length;
              return (
                <ListItem
                  key={set.id}
                  title={setLabel(set)}
                  subtitle={countLabel(inside.brushes.length, inside.tones.length)}
                  left={<SetCover contents={inside} />}
                  selected={setId === set.id}
                  disabled={empty}
                  right={setId === set.id ? <Icon icon={DoneIcon} color="accent" weight="fill" /> : undefined}
                  onPress={() => setSetId(set.id)}
                />
              );
            })}
          </Section>
          <Button
            title={target ? t('Send to {name}', { name: nameOf(target) }) : t('Send')}
            icon={SendIcon}
            disabled={!target || !sendable}
            onPress={onSend}
          />
          <Text variant="caption" tone="muted">
            {t('Your friend chooses which brushes and tones to keep. Yours stay as they are.')}
          </Text>
        </>
      )}
    </Screen>
  );
}
