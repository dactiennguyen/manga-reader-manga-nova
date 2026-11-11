/**
 * Guess the drawing: one person draws a secret word on a shared board, everyone else types guesses.
 * The board is the brightest thing on screen; the clue bar sits above it and the guesses below.
 */
import { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { t } from '../../core/i18n';
import { CLOSE_SHOW_MS, INK_COLORS, INK_SIZES, roundOf } from '../../core/nearby/guess';
import { useAppNavigation } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { AppBar, Button, EmptyState, Screen, Text } from '../../ui';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { useNow } from './draw/DrawTurn';
import { useMemberNames, useMembers } from './draw/members';
import { guessSession, useGuess } from './draw/sessions';
import { GuessBoard } from './guess/GuessBoard';
import { ClueBar, GuessFeed, GuessInput, GuessSetup, PenTools, Scoreboard, WordChoices } from './guess/GuessParts';

const BOARD_MAX = 520;

export function GuessScreen() {
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const members = useMembers();
  const nameOf = useMemberNames();
  const me = useRoom(s => s.me);
  const inRoom = useRoom(s => s.status === 'hosting' || s.status === 'joined');
  const { state, choices, secret, closeAt } = useGuess();
  const now = useNow(250);
  const [size, setSize] = useState<number>(INK_SIZES[1]);
  const [color, setColor] = useState<string>(INK_COLORS[0]);

  const host = members.find(member => member.host);
  const drawing = state.drawer === me?.id;
  const canDraw = drawing && state.phase === 'drawing';
  const pen = useMemo(
    () => (canDraw ? { size, color, onInk: (id: number, points: number[], inkSize: number, inkColor: string, done: boolean) => guessSession.ink(id, points, inkSize, inkColor, done) } : undefined),
    [canDraw, size, color],
  );
  const side = Math.min(BOARD_MAX, width - 32);
  const title = t('Guess the drawing');

  let body;
  if (!inRoom) {
    body = <EmptyState art={NEARBY_ART.guess} title={t('Not in a room')} message={t('Join or host a room to play.')} />;
  } else if (state.phase === 'idle') {
    body = me?.host ? (
      <GuessSetup players={members.length} onStart={(rounds, seconds) => guessSession.begin(rounds, seconds)} />
    ) : (
      <EmptyState
        art={NEARBY_ART.guess}
        title={t('Waiting for {name} to start', { name: host?.name ?? t('the host') })}
        message={t('Take turns drawing a secret word. Everyone else types guesses: the faster you get it, the more points.')}
      />
    );
  } else if (state.phase === 'choosing') {
    body =
      drawing && choices.length ? (
        <WordChoices choices={choices} left={state.chooseUntil - now} onPick={word => guessSession.pick(word)} />
      ) : (
        <EmptyState art={NEARBY_ART.guess} title={t('{name} is picking a word…', { name: nameOf(state.drawer) })} message={t('Get ready to guess.')} />
      );
  } else if (state.phase === 'drawing' || state.phase === 'reveal') {
    const revealing = state.phase === 'reveal';
    const word = revealing ? state.word ?? t('(not revealed)') : drawing && secret ? secret.entry.split('|')[0] : undefined;
    body = (
      <>
        <ClueBar
          round={roundOf(state)}
          rounds={state.rounds}
          left={revealing ? undefined : state.endsAt - now}
          mask={state.mask}
          word={word}
          wordLabel={revealing ? t('The word was') : undefined}
        />
        {!revealing ? (
          <Text variant="caption" tone="secondary" className="text-center">
            {drawing ? t('Draw it! No letters or numbers.') : t('{name} is drawing', { name: nameOf(state.drawer) })}
          </Text>
        ) : null}
        <View className="items-center">
          <GuessBoard
            strokes={state.strokes}
            side={side}
            pen={pen}
          />
        </View>
        {drawing && !revealing ? (
          <PenTools size={size} color={color} onSize={setSize} onColor={setColor} onUndo={() => guessSession.undo()} onClear={() => guessSession.clear()} />
        ) : null}
        {!drawing && !revealing ? (
          <GuessInput onGuess={text => guessSession.guess(text)} done={!!me && state.hits.includes(me.id)} close={now - closeAt < CLOSE_SHOW_MS} />
        ) : null}
        {revealing ? (
          <Scoreboard scores={state.scores} gained={state.turnScores} me={me?.id} nameOf={nameOf} title={t('Scores')} />
        ) : (
          <GuessFeed feed={state.feed} nameOf={nameOf} />
        )}
      </>
    );
  } else {
    body = (
      <>
        <Text variant="title">{t('Game over')}</Text>
        <Scoreboard scores={state.final ?? state.scores} me={me?.id} nameOf={nameOf} title={t('Final scores')} />
        {me?.host ? (
          <>
            <Button title={t('Play again')} onPress={() => guessSession.begin(state.rounds, state.seconds)} />
            <Button title={t('Back to the room for everyone')} variant="ghost" onPress={() => useRoom.getState().setActivity('lobby')} />
          </>
        ) : (
          <Text tone="secondary">{t('Waiting for {name}…', { name: host?.name ?? t('the host') })}</Text>
        )}
      </>
    );
  }

  return (
    <Screen padded={false}>
      <AppBar title={title} onBack={navigation.goBack} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6 pt-1 md:px-6"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        // The drawer's finger draws on the board; the page must not scroll under it.
        scrollEnabled={!(drawing && state.phase === 'drawing')}
      >
        {body}
      </ScrollView>
    </Screen>
  );
}
