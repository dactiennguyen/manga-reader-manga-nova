/**
 * Speed battle: one prompt and one timer for everyone, a synchronised start, then everyone votes on
 * each phone for a drawing that is not theirs, and the results arrive with an ink burst.
 */
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { hasChoice } from '../../core/nearby/battle';
import { useRoom } from '../../state/useRoom';
import { Button, EmptyState, LoadingView, Text } from '../../ui';
import { CheckIcon, SaveIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { BattleResults, BattleSetup, BattleVote } from './battle/BattleParts';
import { useBattlePlayer } from './battle/useBattlePlayer';
import { DrawTurn, clockText } from './draw/DrawTurn';
import { useMembers } from './draw/members';
import { PlayPage } from './draw/PlayPage';
import { battleSession } from './draw/sessions';

export function BattleScreen() {
  const members = useMembers();
  const inRoom = useRoom(s => s.status === 'hosting' || s.status === 'joined');
  const player = useBattlePlayer();
  const { state, phase, now, me, nameOf, pageId, panelId, send, sent, sending, vote, castVote, drawings, keep, kept } = player;
  const title = t('Speed battle');
  const host = members.find(member => member.host);

  if (!inRoom) {
    return (
      <PlayPage title={title}>
        <EmptyState art={NEARBY_ART.battle} title={t('Not in a room')} message={t('Join or host a room to play.')} />
      </PlayPage>
    );
  }

  if (phase === 'drawing' && !sent && pageId && panelId) {
    return <DrawTurn pageId={pageId} panelId={panelId} endsAt={state.endsAt} note={t(state.prompt)} reference={null} onSend={send} />;
  }

  const prompt = state.started ? (
    <View className="gap-1 rounded-lg bg-paper p-4">
      <Text variant="caption" tone="onPaper">
        {t('Prompt')}
      </Text>
      <Text variant="heading" tone="onPaper">
        {t(state.prompt)}
      </Text>
    </View>
  ) : null;

  let body;
  if (phase === 'idle') {
    body = me?.host ? (
      <BattleSetup players={members.length} onStart={(text, minutes) => battleSession.begin(text, minutes)} />
    ) : (
      <EmptyState
        art={NEARBY_ART.battle}
        title={t('Waiting for {name} to start', { name: host?.name ?? t('the host') })}
        message={t('Same prompt, same timer for everyone. Then you vote for your favourite drawing.')}
      />
    );
  } else if (phase === 'countdown') {
    body = (
      <>
        {prompt}
        <View className="items-center gap-2 py-8" accessibilityLiveRegion="polite">
          <Text variant="caption" tone="secondary">
            {t('Get ready')}
          </Text>
          <Text variant="display" tone="accent">
            {Math.max(1, Math.ceil((state.startsAt - now) / 1000))}
          </Text>
        </View>
      </>
    );
  } else if (phase === 'drawing' || phase === 'sending') {
    body = (
      <>
        {prompt}
        {sending || (phase === 'sending' && !sent) ? (
          <LoadingView label={t('Sending your drawing…')} />
        ) : (
          <EmptyState
            title={t('Drawing sent')}
            message={
              phase === 'drawing'
                ? t('The others are still drawing: {time} left.', { time: clockText(state.endsAt - now) })
                : t('Collecting the last drawings…')
            }
          />
        )}
      </>
    );
  } else if (phase === 'voting') {
    const canVote = !!me && state.players.includes(me.id) && hasChoice(state, me.id);
    body = (
      <>
        {prompt}
        <Text variant="heading" accessibilityLiveRegion="polite">
          {!canVote ? t('Everyone is voting') : vote ? t('Vote cast. Waiting for the others…') : t('Vote for your favourite')}
        </Text>
        <BattleVote drawings={drawings} me={me?.id} vote={vote} nameOf={nameOf} onVote={castVote} />
        <Text variant="caption" tone="muted">
          {t('Results come when everyone has voted.')}
        </Text>
      </>
    );
  } else {
    body = (
      <>
        {prompt}
        <BattleResults scores={state.scores ?? {}} drawings={drawings} me={me?.id} nameOf={nameOf} />
        {pageId ? (
          <Button
            title={kept ? t('Saved') : t('Save my drawing')}
            icon={kept ? CheckIcon : SaveIcon}
            disabled={kept}
            onPress={keep}
          />
        ) : null}
        {me?.host ? (
          <>
            <Button title={t('New battle')} variant="secondary" onPress={() => battleSession.reset()} />
            <Button
              title={t('Back to the room for everyone')}
              variant="ghost"
              onPress={() => useRoom.getState().setActivity('lobby')}
            />
          </>
        ) : null}
      </>
    );
  }

  return <PlayPage title={title}>{body}</PlayPage>;
}
