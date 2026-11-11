/**
 * Draw together: the host picks a page (or a blank one) and everyone draws on it at once, each on a layer
 * named after them, with live name cursors and reactions. At the end every phone keeps the page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable as RNPressable, View, useWindowDimensions } from 'react-native';
import { ScopedTheme } from 'uniwind';

import { t } from '../../core/i18n';
import { hitTestPanel } from '../../core/layout/layout';
import type { ID } from '../../core/model/types';
import { PageView, usePageContext } from '../../render/PageView';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { useStory } from '../../state/useStory';
import { Button, EmptyState, LoadingView, Text, toast } from '../../ui';
import { DoneIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { CanvasEditor } from '../canvas/CanvasScreen';
import { createBlankSharedPage } from './codraw/coDrawPage';
import { CoDrawOverlay } from './codraw/CoDrawOverlay';
import { CoDrawSetup } from './codraw/CoDrawSetup';
import { inkOf, useMembers } from './draw/members';
import { PlayPage } from './draw/PlayPage';
import { coDrawSession, useCoDraw } from './draw/sessions';

const PAGE_MAX = 440;

function SharedCanvas({ pageId, panelId, onClose }: { pageId: ID; panelId: ID; onClose: () => void }) {
  const ctx = usePageContext(pageId);
  const shape = ctx?.shapes.find(item => item.id === panelId);
  const members = useMembers();
  const { cursors, reactions } = useCoDraw();
  const onCursor = useCallback((x: number, y: number, force: boolean) => coDrawSession.cursor(panelId, x, y, force), [panelId]);
  const onReact = useCallback((emoji: string) => coDrawSession.react(emoji), []);
  if (!ctx || !shape) {
    return <LoadingView />;
  }
  return (
    <ScopedTheme theme="dark">
      <CanvasEditor
        key={panelId}
        ctx={ctx}
        shape={shape}
        pageId={pageId}
        panelId={panelId}
        embed={{
          onDone: onClose,
          renderOverlay: engine => (
            <CoDrawOverlay
              engine={engine}
              panelId={panelId}
              pageW={ctx.size.w}
              members={members}
              cursors={cursors}
              reactions={reactions}
              onCursor={onCursor}
              onReact={onReact}
            />
          ),
        }}
      />
    </ScopedTheme>
  );
}

export function CoDrawScreen() {
  const navigation = useAppNavigation();
  const routePage = useAppRoute<'CoDraw'>().params?.pageId;
  const me = useRoom(s => s.me);
  const inRoom = useRoom(s => s.status === 'hosting' || s.status === 'joined');
  const members = useMembers();
  const session = useCoDraw();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(PAGE_MAX, width - 32);
  const ctx = usePageContext(session.pageId ?? undefined);
  const [panelId, setPanelId] = useState<ID | null>(null);
  const [ending, setEnding] = useState(false);
  const host = members.find(member => member.host);

  const start = useCallback((pageId: ID | null) => {
    if (!pageId) {
      toast(t("Couldn't make the page."));
      return;
    }
    coDrawSession.host(pageId).catch(() => toast(t("Couldn't send the page. Check the Wi-Fi and try again.")));
  }, []);

  // Opened from a page with "Draw together": the host shares that page straight away.
  const routePageExists = useStory(s => !!(routePage && s.pages[routePage]));
  useEffect(() => {
    if (me?.host && routePage && routePageExists && !session.pageId) {
      start(routePage);
    }
  }, [me?.host, routePage, routePageExists, session.pageId, start]);

  const open = useCallback((id: ID) => {
    coDrawSession.enterPanel(id);
    setPanelId(id);
  }, []);
  const close = useCallback(() => {
    coDrawSession.leavePanel();
    setPanelId(null);
  }, []);

  // A one-panel page opens straight into the canvas, once; Done then shows the page and the room.
  const onlyPanel = ctx && ctx.shapes.length === 1 ? ctx.shapes[0].id : null;
  const autoOpened = useRef<ID | null>(null);
  useEffect(() => {
    if (onlyPanel && !session.ended && inRoom && autoOpened.current !== onlyPanel) {
      autoOpened.current = onlyPanel;
      open(onlyPanel);
    }
  }, [inRoom, onlyPanel, open, session.ended]);

  // The session ended or the page went away: leave the canvas.
  const stillThere = !!(panelId && ctx?.shapes.some(shape => shape.id === panelId));
  useEffect(() => {
    if (panelId && (session.ended || !stillThere || !inRoom)) {
      close();
    }
  }, [close, inRoom, panelId, session.ended, stillThere]);

  if (panelId && session.pageId && stillThere && !session.ended && inRoom) {
    return <SharedCanvas pageId={session.pageId} panelId={panelId} onClose={close} />;
  }

  const title = t('Draw together');
  if (!inRoom && !session.pageId) {
    return (
      <PlayPage title={title}>
        <EmptyState art={NEARBY_ART.codraw} title={t('Not in a room')} message={t('Join or host a room to play.')} />
      </PlayPage>
    );
  }

  if (!session.pageId || !ctx) {
    return (
      <PlayPage title={title}>
        {me?.host ? (
          <CoDrawSetup onBlank={() => start(createBlankSharedPage())} onPage={start} />
        ) : (
          <EmptyState
            art={NEARBY_ART.codraw}
            title={t('Waiting for {name} to pick a page', { name: host?.name ?? t('the host') })}
            message={t('Everyone draws on the same page, each on a layer with their own name.')}
          />
        )}
      </PlayPage>
    );
  }

  const projectId = session.projectId;
  const scale = pageWidth / ctx.size.w;
  const tap = (x: number, y: number) => {
    const hit = hitTestPanel(ctx.shapes, { x: x / scale, y: y / scale });
    if (hit && !session.ended && inRoom) {
      open(hit);
    }
  };

  return (
    <PlayPage title={title} subtitle={ctx.project.title}>
      <View className="flex-row flex-wrap gap-2">
        {members.map(member => (
          <View key={member.id} className="h-8 flex-row items-center gap-1.5 rounded-sm bg-surface px-2">
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: inkOf(member) }} />
            <Text variant="label">{member.id === me?.id ? t('You') : member.name}</Text>
          </View>
        ))}
      </View>
      {session.ended ? (
        <Text variant="heading" accessibilityLiveRegion="polite">
          {me?.host ? t('Session ended. Everyone has the page now.') : t('Session ended. The page is in your library.')}
        </Text>
      ) : (
        <Text variant="bodySmall" tone="secondary">
          {t('Tap a panel to draw in it. Your strokes go on the layer with your name.')}
        </Text>
      )}
      <View className="items-center">
        <RNPressable
          onPress={event => tap(event.nativeEvent.locationX, event.nativeEvent.locationY)}
          accessibilityLabel={t('Page')}
          accessibilityHint={t('Tap a panel to draw in it')}
        >
          <PageView pageId={session.pageId} width={pageWidth} />
        </RNPressable>
      </View>
      {ctx.shapes.length > 1 && !session.ended ? (
        <View className="flex-row flex-wrap gap-2">
          {ctx.shapes.map(shape => (
            <Button key={shape.id} small variant="secondary" title={t('Panel {n}', { n: shape.index + 1 })} onPress={() => open(shape.id)} />
          ))}
        </View>
      ) : null}
      {me?.host && !session.ended ? (
        <Button
          title={t('End and share the page')}
          icon={DoneIcon}
          loading={ending}
          onPress={() => {
            setEnding(true);
            coDrawSession.end().finally(() => setEnding(false));
          }}
        />
      ) : null}
      {session.ended && projectId && useStory.getState().projects[projectId] ? (
        <Button title={t('Open the story')} variant="secondary" onPress={() => navigation.navigate('Project', { projectId })} />
      ) : null}
      {me?.host && session.ended ? (
        <Button title={t('Back to the room for everyone')} variant="ghost" onPress={() => useRoom.getState().setActivity('lobby')} />
      ) : null}
    </PlayPage>
  );
}
