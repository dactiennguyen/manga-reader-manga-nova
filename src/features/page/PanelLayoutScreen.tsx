import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight, CircleCheck, EllipsisVertical, Redo2, Undo2 } from 'lucide-react-native';

import type { Chapter } from '../../core/model/types';
import { plural } from '../../core/util/format';
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
            <IconButton icon={Undo2} disabled={!canUndo} onPress={() => undoStory(scope)} accessibilityLabel="Undo" />
            <IconButton icon={Redo2} disabled={!canRedo} onPress={() => redoStory(scope)} accessibilityLabel="Redo" />
            <IconButton
              icon={CircleCheck}
              active={page.done}
              onPress={() => setPagesDone([pageId], !page.done)}
              accessibilityLabel={page.done ? 'Mark not done' : 'Mark page done'}
            />
            <IconButton icon={EllipsisVertical} onPress={() => c.setSheet('menu')} accessibilityLabel="More" />
          </>
        }
      >
        <Pressable
          accessibilityLabel="Jump to another page"
          onPress={() => c.setSheet('jump')}
          className="min-h-12 flex-row items-center gap-1"
        >
          <Text variant="title" numberOfLines={1}>
            Page {index + 1} / {total}
          </Text>
          <Icon icon={ChevronDown} />
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
              accessibilityLabel={`Page ${index + 1}, ${plural(shapes.length, 'panel')}`}
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
        <View pointerEvents="box-none" className="absolute inset-x-2 bottom-1 flex-row justify-between">
          <IconButton
            icon={ChevronLeft}
            onPress={() => c.goTo(index + (rtl ? 1 : -1))}
            accessibilityLabel={rtl ? 'Next page' : 'Previous page'}
            className="rounded-full bg-raised"
          />
          <IconButton
            icon={ChevronRight}
            onPress={() => c.goTo(index + (rtl ? -1 : 1))}
            accessibilityLabel={rtl ? 'Previous page' : 'Next page'}
            className="rounded-full bg-raised"
          />
        </View>
      </View>
      {mode === 'panels' ? <PanelToolBar c={c} /> : <PanelArtCard c={c} />}
      <ModeBar pageId={pageId} mode={mode} onChange={c.changeMode} />
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
        <AppBar title="Page" onBack={() => navigation.goBack()} />
      </Screen>
    );
  }
  return <PanelLayoutBody ctx={ctx} chapter={chapter} initialMode={route.params.mode} />;
}
