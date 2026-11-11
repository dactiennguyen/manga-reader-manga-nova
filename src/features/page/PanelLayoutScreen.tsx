import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, DoneIcon, MoreIcon, RedoIcon, UndoIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import type { Chapter } from '../../core/model/types';
import type { PageContext } from '../../render/drawPage';
import { PageView, usePageContext } from '../../render/PageView';
import { useChapter } from '../../state/hooks';
import type { ScreenProps } from '../../state/navigation';
import { redoStory, undoStory, useUndoState } from '../../state/useStory';
import { AppBar, Icon, IconButton, Pressable, Screen, Text } from '../../ui';
import { ModeBar } from './ModeBar';
import { PageOverlay } from './PageOverlay';
import { PanelGestureLayer } from './PanelGestures';
import { PanelSheets } from './PanelSheets';
import { PanelArtCard, PanelToolBar } from './PanelToolBar';
import { setPagesDone } from './pageActions';
import { usePanelController } from './usePanelController';

const PAGE_OPTIONS = { placeholders: true };

function PanelLayoutBody({
  ctx,
  chapter,
  initialMode,
}: {
  ctx: PageContext;
  chapter: Chapter;
  initialMode?: 'panels' | 'art';
}) {
  const c = usePanelController({ ctx, chapter, initialMode });
  const live = useRef(c.handlers);
  live.current = c.handlers;
  const { pageId, page, index, total, mode, tool, frame, fit, selected, picked } = c;
  const { size, shapes, rtl } = ctx;
  const scope = `page:${pageId}` as const;
  const { canUndo, canRedo } = useUndoState(scope);
  const selectedIds = useMemo(() => (selected ? [selected] : []), [selected]);
  const orderLabels =
    mode === 'panels' && tool === 'order'
      ? Object.fromEntries(shapes.map(shape => [shape.id, picked.includes(shape.id) ? `${picked.indexOf(shape.id) + 1}` : '']))
      : undefined;

  return (
    <Screen padded={false} bottom={false}>
      <AppBar
        onBack={c.goBack}
        right={
          <>
            <IconButton icon={UndoIcon} disabled={!canUndo} onPress={() => undoStory(scope)} accessibilityLabel={t('Undo')} />
            <IconButton icon={RedoIcon} disabled={!canRedo} onPress={() => redoStory(scope)} accessibilityLabel={t('Redo')} />
            <IconButton
              icon={DoneIcon}
              active={page.done}
              onPress={() => setPagesDone([pageId], !page.done)}
              accessibilityLabel={page.done ? t('Mark not done') : t('Mark page done')}
            />
            <IconButton icon={MoreIcon} onPress={() => c.setSheet('menu')} accessibilityLabel={t('More')} />
          </>
        }
      >
        <Pressable
          accessibilityLabel={t('Jump to another page')}
          onPress={() => c.setSheet('jump')}
          className="min-h-12 flex-row items-center gap-1"
        >
          <Text variant="title" numberOfLines={1}>
            {t('Page {n} / {total}', { n: index + 1, total })}
          </Text>
          <Icon icon={CaretDownIcon} />
        </Pressable>
      </AppBar>
      <View className="flex-1">
        <View
          testID="page-workspace"
          className="flex-1 overflow-hidden bg-bg"
          onLayout={event => c.setBox({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
        >
          {fit > 0 && (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={tn(shapes.length, 'Page {n}, {count} panel', 'Page {n}, {count} panels', { n: index + 1 })}
              className="absolute"
              style={{ left: frame.ox, top: frame.oy, width: size.w * frame.k, height: size.h * frame.k }}
            >
              <PageView pageId={pageId} width={size.w * frame.k} options={PAGE_OPTIONS} />
              <PageOverlay
                size={size}
                k={frame.k}
                shapes={shapes}
                selectedIds={selectedIds}
                labels={orderLabels}
                draftShapes={c.draftShapes}
                dividers={c.dividers}
                activeSplitId={c.drag?.splitId}
                cutLine={c.cutLine}
                safeGrid={c.safeGrid}
              />
            </View>
          )}
          <PanelGestureLayer live={live} />
        </View>
      </View>
      {mode === 'panels' ? <PanelToolBar c={c} /> : <PanelArtCard c={c} />}
      <ModeBar
        pageId={pageId}
        mode={mode}
        onChange={c.changeMode}
        leading={
          <IconButton
            icon={CaretLeftIcon}
            onPress={() => c.goTo(index + (rtl ? 1 : -1))}
            accessibilityLabel={rtl ? t('Next page') : t('Previous page')}
          />
        }
        trailing={
          <IconButton
            icon={CaretRightIcon}
            onPress={() => c.goTo(index + (rtl ? -1 : 1))}
            accessibilityLabel={rtl ? t('Previous page') : t('Next page')}
          />
        }
      />
      <PanelSheets c={c} />
    </Screen>
  );
}

export function PanelLayoutScreen({ navigation, route }: ScreenProps<'PanelLayout'>) {
  const ctx = usePageContext(route.params.pageId);
  const chapter = useChapter(ctx?.page.chapterId);
  if (!ctx || !chapter) {
    return (
      <Screen>
        <AppBar title={t('Page')} onBack={() => navigation.goBack()} />
      </Screen>
    );
  }
  return <PanelLayoutBody ctx={ctx} chapter={chapter} initialMode={route.params.mode} />;
}
