/**
 * Fill the bubbles: one person draws a panel with empty bubbles, the others write the lines in secret,
 * the versions are shown one by one without names, and everyone votes for the funniest. The panel is the
 * brightest thing on screen; the turn bar sits above it and the tools or lines below.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { t, tn } from '../../core/i18n';
import { rankedVersions, revealEndsAt, revealIndex, writersOf, type FillBubble } from '../../core/nearby/fill';
import { INK_COLORS, INK_SIZES, roundOf } from '../../core/nearby/guess';
import { useAppNavigation } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { AppBar, Banner, Button, EmptyState, ModeSwitch, Screen, Text, toast } from '../../ui';
import { BrushIcon, BubbleIcon, CheckIcon, SaveIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { FILL_BUBBLES } from './draw/drawStories';
import { useNow } from './draw/DrawTurn';
import { useMemberNames, useMembers } from './draw/members';
import { fillSession, useFill } from './draw/sessions';
import { FillBoard } from './fill/FillBoard';
import { BubbleTools, FILL_BLURB, FillSetup, LinesForm, ResultList, TurnBar, VersionChips } from './fill/FillParts';
import { saveFilledPanel } from './fill/fillPage';
import { PenTools, Scoreboard } from './guess/GuessParts';

const BOARD_MAX = 520;

type Mode = 'draw' | 'bubbles';

export function FillScreen() {
  const navigation = useAppNavigation();
  const { width, height } = useWindowDimensions();
  const members = useMembers();
  const nameOf = useMemberNames();
  const me = useRoom(s => s.me);
  const inRoom = useRoom(s => s.status === 'hosting' || s.status === 'joined');
  const { state, layout, draft, sent, mine } = useFill();
  const now = useNow(250);
  const [size, setSize] = useState<number>(INK_SIZES[1]);
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [mode, setMode] = useState<Mode>('draw');
  const [selected, setSelected] = useState(-1);
  /** The version on the board while voting or looking at the result, by index or id. */
  const [viewing, setViewing] = useState(0);
  const [shownId, setShownId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  // A new turn starts with the pen, nothing picked and the first version on the board.
  useEffect(() => {
    setMode('draw');
    setSelected(-1);
    setViewing(0);
    setShownId(null);
  }, [state.turn]);

  const host = members.find(member => member.host);
  const isArtist = !!me && state.artist === me.id;
  const playing = !!me && state.order.includes(me.id);
  const canDraw = isArtist && state.phase === 'drawing' && !state.panelDone;
  const pen = useMemo(
    () => (canDraw && mode === 'draw' ? { size, color, onInk: (id: number, points: number[], inkSize: number, inkColor: string, done: boolean) => fillSession.ink(id, points, inkSize, inkColor, done) } : undefined),
    [canDraw, mode, size, color],
  );
  const editor = useMemo(
    () =>
      canDraw && mode === 'bubbles'
        ? { selected, onSelect: setSelected, onChange: (index: number, bubble: FillBubble) => fillSession.setBubble(index, bubble) }
        : undefined,
    [canDraw, mode, selected],
  );
  const side = Math.min(BOARD_MAX, width - 32);
  // The artist's page cannot scroll (the finger draws), so the board leaves room for the tools below it.
  const drawSide = Math.max(220, Math.min(side, height - 440));
  const round = roundOf(state);
  const present = members.map(member => member.id).filter(id => state.order.includes(id));

  let body;
  if (!inRoom) {
    body = <EmptyState art={NEARBY_ART.fill} title={t('Not in a room')} message={t('Join or host a room to play.')} />;
  } else if (state.phase === 'idle') {
    body = me?.host ? (
      <FillSetup players={members.length} onStart={(rounds, drawSeconds, writeSeconds) => fillSession.begin(rounds, drawSeconds, writeSeconds)} />
    ) : (
      <EmptyState art={NEARBY_ART.fill} title={t('Waiting for {name} to start', { name: host?.name ?? t('the host') })} message={t(FILL_BLURB)} />
    );
  } else if (state.phase === 'drawing' && !canDraw) {
    body = (
      <>
        <TurnBar round={round} rounds={state.rounds} left={state.artist ? state.endsAt - now : undefined} />
        <EmptyState
          art={NEARBY_ART.fill}
          title={isArtist ? t('Panel sent') : t('{name} is drawing a panel…', { name: nameOf(state.artist) })}
          message={t('Get ready to write the lines.')}
        />
      </>
    );
  } else if (state.phase === 'drawing') {
    body = (
      <>
        <TurnBar round={round} rounds={state.rounds} left={state.endsAt - now} note={t('Draw a scene, then add bubbles')} />
        <ModeSwitch
          options={[
            { value: 'draw', label: t('Draw'), icon: BrushIcon },
            { value: 'bubbles', label: t('Bubbles'), icon: BubbleIcon },
          ]}
          value={mode}
          onChange={setMode}
        />
        <View className="items-center">
          <FillBoard strokes={state.strokes} bubbles={layout} side={drawSide} pen={pen} editor={editor} />
        </View>
        {mode === 'draw' ? (
          <PenTools size={size} color={color} onSize={setSize} onColor={setColor} onUndo={() => fillSession.undo()} onClear={() => fillSession.clear()} />
        ) : (
          <BubbleTools
            bubbles={layout}
            selected={selected}
            onAdd={kind => setSelected(fillSession.addBubble(kind))}
            onChange={(index, bubble) => fillSession.setBubble(index, bubble)}
            onRemove={index => {
              fillSession.removeBubble(index);
              setSelected(-1);
            }}
          />
        )}
        <Button title={t('The panel is ready')} icon={CheckIcon} disabled={!layout.length} onPress={() => fillSession.finish()} />
        {!layout.length ? (
          <Text variant="caption" tone="secondary" className="text-center">
            {t('Add at least one bubble for the others to fill.')}
          </Text>
        ) : null}
      </>
    );
  } else if (state.phase === 'writing') {
    const writers = writersOf(state, present);
    body = (
      <>
        <TurnBar round={round} rounds={state.rounds} left={state.endsAt - now} note={t('Panel by {name}', { name: nameOf(state.artist) })} />
        <View className="items-center">
          <FillBoard strokes={state.strokes} bubbles={state.bubbles} side={side} />
        </View>
        <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          {t('{n} of {total} have written', { n: state.wrote.filter(id => writers.includes(id)).length, total: writers.length })}
        </Text>
        {isArtist ? (
          <Text tone="secondary">{t('The others are writing lines for your panel.')}</Text>
        ) : playing ? (
          <LinesForm draft={draft} sent={sent} onLine={(index, text) => fillSession.setLine(index, text)} onSend={() => fillSession.submit()} />
        ) : (
          <WatchingNote />
        )}
      </>
    );
  } else if (state.phase === 'reveal') {
    const index = revealIndex(state, now);
    const version = state.versions[index];
    body = (
      <>
        <TurnBar
          round={round}
          rounds={state.rounds}
          left={revealEndsAt(state) - now}
          note={t('Version {n} of {total}', { n: index + 1, total: state.versions.length })}
        />
        <View className="items-center">
          <FillBoard strokes={state.strokes} bubbles={state.bubbles} lines={version?.lines ?? []} side={side} />
        </View>
        <Text tone="secondary" className="text-center">
          {version?.id === mine ? t('This one is yours.') : t('Who wrote this? You find out after the vote.')}
        </Text>
      </>
    );
  } else if (state.phase === 'vote') {
    const shown = Math.min(viewing, state.versions.length - 1);
    const version = state.versions[shown];
    const myVote = me ? state.votes[me.id] : undefined;
    const own = version?.id === mine;
    body = (
      <>
        <TurnBar round={round} rounds={state.rounds} left={state.endsAt - now} note={t('Vote for the funniest')} />
        <View className="items-center">
          <FillBoard strokes={state.strokes} bubbles={state.bubbles} lines={version?.lines ?? []} side={side} />
        </View>
        <VersionChips versions={state.versions} shown={shown} mine={mine} onShow={setViewing} />
        {!playing ? (
          <WatchingNote />
        ) : myVote ? (
          <Banner tone="success" icon={CheckIcon} text={t('Vote counted. Waiting for the others…')} />
        ) : own ? (
          <Text tone="secondary" className="text-center">
            {t("That's yours. Vote for someone else's.")}
          </Text>
        ) : version ? (
          <Button title={t('Vote for this one')} onPress={() => fillSession.vote(version.id)} />
        ) : null}
        <Text variant="caption" tone="secondary" className="text-center" accessibilityLiveRegion="polite">
          {tn(Object.keys(state.votes).length, '{count} vote', '{count} votes')}
        </Text>
      </>
    );
  } else if (state.phase === 'result') {
    const ranked = rankedVersions(state);
    const current = shownId ?? state.winners[0] ?? ranked[0]?.version.id ?? null;
    const version = state.versions.find(item => item.id === current);
    const save = () => {
      if (!version || saved.includes(version.id)) {
        return;
      }
      if (saveFilledPanel(state.strokes, state.bubbles, version.lines, nameOf(state.artist))) {
        setSaved(list => [...list, version.id]);
        toast(t('Saved to “{story}”', { story: t(FILL_BUBBLES) }));
      } else {
        toast(t("Couldn't save the panel. Try again."));
      }
    };
    body = (
      <>
        <TurnBar round={round} rounds={state.rounds} />
        {state.skipped ? (
          <EmptyState art={NEARBY_ART.fill} title={t('No panel this turn')} message={t('{name} left or their phone stopped answering.', { name: nameOf(state.artist) })} />
        ) : !version ? (
          <EmptyState art={NEARBY_ART.fill} title={t('Nobody wrote any lines this time')} message={t('Panel by {name}', { name: nameOf(state.artist) })} />
        ) : (
          <>
            <View className="items-center">
              <FillBoard strokes={state.strokes} bubbles={state.bubbles} lines={version.lines} side={side} />
            </View>
            <ResultList ranked={ranked} authors={state.authors} winners={state.winners} shown={current} onShow={setShownId} nameOf={nameOf} />
            <Button
              title={saved.includes(version.id) ? t('Saved') : t('Save this panel to my library')}
              icon={SaveIcon}
              variant="secondary"
              disabled={saved.includes(version.id)}
              onPress={save}
            />
          </>
        )}
        <Scoreboard scores={state.scores} gained={state.turnScores} me={me?.id} nameOf={nameOf} title={t('Scores')} />
      </>
    );
  } else {
    body = (
      <>
        <Text variant="title">{t('Game over')}</Text>
        <Scoreboard scores={state.final ?? state.scores} me={me?.id} nameOf={nameOf} title={t('Final scores')} />
        {me?.host ? (
          <>
            <Button title={t('Play again')} onPress={() => fillSession.begin(state.rounds, state.drawSeconds, state.writeSeconds)} />
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
      <AppBar title={t('Fill the bubbles')} onBack={navigation.goBack} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6 pt-1 md:px-6"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        // The artist's finger draws and drags bubbles on the board; the page must not scroll under it.
        scrollEnabled={!canDraw}
      >
        {body}
      </ScrollView>
    </Screen>
  );
}

function WatchingNote() {
  return <Text tone="secondary">{t('You joined during this game. Watch this one and play in the next.')}</Text>;
}
