import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { activeProjects, chaptersOf } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { createSendController, isFinished, type SendController, type Transfer } from '../../core/nearby/sendStory';
import type { MemberId } from '../../core/nearby/types';
import { formatBytes } from '../../core/util/format';
import { uid } from '../../core/util/id';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { AppBar, Button, Card, Chip, ChipRow, Icon, ListItem, ProgressBar, Screen, Section, Text, toast } from '../../ui';
import { CheckIcon, DoneIcon, LibraryIcon, SendIcon } from '../../ui/icons';
import { storyFiles } from './share/shareFiles';
import { NoRoom, roomPort, useShareRoom } from './share/useShareRoom';

function statusText(transfer: Transfer, peer: string): string {
  const params = { name: peer, title: transfer.title || t('Untitled') };
  switch (transfer.status) {
    case 'offered':
      return t('Waiting for {name} to accept', params);
    case 'incoming':
      return t('{name} wants to send you a story', params);
    case 'sending':
      return t('Sending to {name}', params);
    case 'receiving':
      return t('Receiving from {name}', params);
    case 'sent':
      return t('Sent. {name} is adding it to their library', params);
    case 'importing':
      return t('Adding it to your library');
    case 'done':
      return transfer.direction === 'in' ? t('In your library now') : t('{name} has it now', params);
    case 'declined':
      return transfer.direction === 'in' ? t('You said no') : t('{name} said no', params);
    case 'cancelled':
      return t('Cancelled');
    case 'failed':
      return t("Couldn't finish. Check the Wi-Fi and try again.");
  }
}

function TransferCard({ transfer, peer, controller }: { transfer: Transfer; peer: string; controller: SendController }) {
  const navigation = useAppNavigation();
  const moving = transfer.status === 'sending' || transfer.status === 'receiving';
  return (
    <Card className="gap-2 p-4">
      <Text variant="label" numberOfLines={1}>
        {transfer.title || t('Untitled')}
      </Text>
      <Text variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
        {statusText(transfer, peer)}
      </Text>
      <Text variant="caption" tone="muted">
        {moving ? `${Math.round(transfer.progress * 100)}% · ${formatBytes(transfer.bytes)}` : formatBytes(transfer.bytes)}
      </Text>
      {(moving || transfer.status === 'importing') && <ProgressBar value={transfer.progress} />}
      <View className="flex-row gap-2">
        {transfer.status === 'incoming' && (
          <>
            <Button title={t('Not now')} variant="secondary" small className="flex-1" onPress={() => controller.decline(transfer.id)} />
            <Button title={t('Accept')} icon={CheckIcon} small className="flex-1" onPress={() => controller.accept(transfer.id)} />
          </>
        )}
        {!isFinished(transfer) && transfer.status !== 'incoming' && transfer.status !== 'importing' && (
          <Button title={t('Cancel')} variant="secondary" small onPress={() => controller.cancel(transfer.id)} />
        )}
        {transfer.status === 'done' && transfer.direction === 'in' && !!transfer.projectId && (
          <Button
            title={t('Open story')}
            icon={LibraryIcon}
            small
            onPress={() => navigation.navigate('Project', { projectId: transfer.projectId! })}
          />
        )}
      </View>
    </Card>
  );
}

/** Pick a story and a person; the story goes over the Wi-Fi as a .manganova file and lands in their library. */
export function SendStoryScreen() {
  const navigation = useAppNavigation();
  const { inRoom, others, nameOf } = useShareRoom();
  const state = useStoryData();
  const projects = useMemo(() => activeProjects(state), [state]);
  const [to, setTo] = useState<MemberId | null>(null);
  const [projectId, setProjectId] = useState<ID | null>(null);
  const [packing, setPacking] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const controller = useRef<SendController | null>(null);

  useEffect(() => {
    if (!inRoom) {
      return;
    }
    const next = createSendController(roomPort(), storyFiles, setTransfers, uid);
    controller.current = next;
    return () => {
      // Leaving the screen ends what is still open, so the other phone is not left waiting.
      next.transfers().forEach(item => (item.status === 'incoming' ? next.decline(item.id) : next.cancel(item.id)));
      next.dispose();
      controller.current = null;
    };
  }, [inRoom]);

  // Toast when a story arrives, since the person may be looking at another part of the list.
  const arrived = transfers.filter(item => item.direction === 'in' && item.status === 'done').length;
  const seen = useRef(0);
  useEffect(() => {
    if (arrived > seen.current) {
      toast(t('Story added to your library'));
    }
    seen.current = arrived;
  }, [arrived]);

  const target = to && others.some(member => member.id === to) ? to : null;

  const onSend = async () => {
    if (!controller.current || !target || !projectId) {
      return;
    }
    setPacking(true);
    try {
      await controller.current.offer(projectId, target);
      setProjectId(null);
    } catch {
      toast(t("Couldn't pack this story. Try again."));
    } finally {
      setPacking(false);
    }
  };

  return (
    <Screen scroll>
      <AppBar title={t('Send a story')} onBack={() => navigation.goBack()} />
      {!inRoom ? (
        <NoRoom art="send" message={t('Stories go straight from phone to phone over your Wi-Fi. Open or join a room to start.')} />
      ) : (
        <>
          {transfers.length > 0 && (
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
          <Section title={t('Story')}>
            {projects.length === 0 ? (
              <ListItem title={t('No stories yet')} subtitle={t('Start a story in your library first.')} />
            ) : (
              projects.map(project => {
                const pages = chaptersOf(state, project.id).reduce((sum, chapter) => sum + chapter.pageIds.length, 0);
                return (
                  <ListItem
                    key={project.id}
                    title={project.title.trim() || t('Untitled')}
                    subtitle={tn(pages, '{count} page', '{count} pages')}
                    selected={projectId === project.id}
                    right={projectId === project.id ? <Icon icon={DoneIcon} color="accent" weight="fill" /> : undefined}
                    onPress={() => setProjectId(project.id)}
                  />
                );
              })
            )}
          </Section>
          <Button
            title={target ? t('Send to {name}', { name: nameOf(target) }) : t('Send')}
            icon={SendIcon}
            loading={packing}
            disabled={!target || !projectId}
            onPress={onSend}
          />
          <Text variant="caption" tone="muted">
            {t('Your friend gets a copy with all its pages and pictures. Your story stays as it is.')}
          </Text>
        </>
      )}
    </Screen>
  );
}
