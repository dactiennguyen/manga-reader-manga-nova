/**
 * Panel relay: the host picks a layout and the order; on each turn one person draws the next panel
 * seeing only the one before; at the end the whole page is revealed on every phone and can be kept.
 */
import { View, useWindowDimensions } from 'react-native';

import { t } from '../../core/i18n';
import { panelCount, relayCredits } from '../../core/nearby/relay';
import { useAppNavigation } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { Button, Card, EmptyState, LoadingView, SectionHeader, Text } from '../../ui';
import { CheckIcon, SaveIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { DrawTurn, clockText, useNow } from './draw/DrawTurn';
import { inkOf, useMembers } from './draw/members';
import { PlayPage } from './draw/PlayPage';
import { RelayPage } from './draw/RelayPage';
import { relaySession } from './draw/sessions';
import { RelaySetup } from './relay/RelaySetup';
import { useRelayPlayer } from './relay/useRelayPlayer';

const PAGE_MAX = 420;

export function RelayScreen() {
  const navigation = useAppNavigation();
  const members = useMembers();
  const inRoom = useRoom(s => s.status === 'hosting' || s.status === 'joined');
  const player = useRelayPlayer();
  const { snapshot, setup, template, me, nameOf, myTurn, pageId, panelId, send, sending, reference, pictures, keep, kept } = player;
  const { state, deadline } = snapshot;
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(PAGE_MAX, width - 32);
  const now = useNow(500);
  const host = members.find(member => member.host);

  if (!inRoom) {
    return (
      <PlayPage title={t('Panel relay')}>
        <EmptyState art={NEARBY_ART.relay} title={t('Not in a room')} message={t('Join or host a room to play.')} />
      </PlayPage>
    );
  }

  if (myTurn && pageId && panelId && state.turn) {
    const count = setup ? panelCount(setup) : 0;
    return (
      <DrawTurn
        pageId={pageId}
        panelId={panelId}
        endsAt={deadline ?? now}
        note={t('Panel {n} of {count}', { n: state.turn.panelIndex + 1, count })}
        reference={reference}
        onSend={send}
      />
    );
  }

  const leave = () => {
    if (me?.host) {
      useRoom.getState().setActivity('lobby');
    } else {
      navigation.goBack();
    }
  };

  let body;
  if (state.phase === 'reveal' && template) {
    const credits = relayCredits(state, template.count);
    body = (
      <>
        <Text variant="heading">{t('The whole page')}</Text>
        <View className="items-center">
          <RelayPage template={template} width={pageWidth} pictures={pictures} />
        </View>
        <Card className="gap-2 p-3">
          <SectionHeader>{t('Drawn by')}</SectionHeader>
          {credits.map((id, index) => (
            <View key={index} className="flex-row items-center gap-2">
              <Text variant="mono" tone="secondary">
                {index + 1}
              </Text>
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: inkOf(members.find(item => item.id === id)) }} />
              <Text variant="bodySmall" tone={id ? 'text' : 'muted'}>
                {id ? nameOf(id) : t('Left blank')}
              </Text>
            </View>
          ))}
        </Card>
        <Button
          title={kept ? t('Saved') : t('Save to Relay pages')}
          icon={kept ? CheckIcon : SaveIcon}
          disabled={kept}
          onPress={keep}
        />
        <Button
          title={me?.host ? t('Back to the room for everyone') : t('Back to the room')}
          variant="secondary"
          onPress={leave}
        />
      </>
    );
  } else if (state.phase === 'turn' && state.turn && template) {
    const drawer = nameOf(state.turn.member);
    const mine = state.turn.member === me?.id;
    body = (
      <>
        <View className="gap-1" accessibilityLiveRegion="polite">
          <Text variant="heading">
            {mine && sending ? t('Sending your panel…') : t('Waiting for {name}', { name: drawer })}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t('Panel {n} of {count}', { n: state.turn.panelIndex + 1, count: template.count })} ·{' '}
            {clockText((deadline ?? now) - now)}
          </Text>
        </View>
        <View className="items-center">
          <RelayPage template={template} width={pageWidth} pictures={{}} current={state.turn.panelIndex} />
        </View>
        <Text variant="caption" tone="muted">
          {t('The panels stay hidden until the reveal. Each person only sees the panel just before theirs.')}
        </Text>
        {me?.host ? <Button title={t('Reveal now')} variant="secondary" onPress={() => relaySession.reveal()} /> : null}
      </>
    );
  } else if (state.phase === 'turn' && !template) {
    body = <LoadingView />;
  } else if (me?.host) {
    body = <RelaySetup members={members} onStart={next => relaySession.begin(next)} />;
  } else {
    body = (
      <EmptyState
        art={NEARBY_ART.relay}
        title={t('Waiting for {name} to start', { name: host?.name ?? t('the host') })}
        message={t('Each person draws one panel, seeing only the one before. The page is revealed at the end.')}
      />
    );
  }

  return <PlayPage title={t('Panel relay')}>{body}</PlayPage>;
}
