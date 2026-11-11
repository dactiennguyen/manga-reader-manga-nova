import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { t } from '../../../core/i18n';
import { computePanels, hitTestPanel, isRtl, pageSize } from '../../../core/layout/layout';
import type { ID } from '../../../core/model/types';
import type { StickerId, StoryPage } from '../../../core/nearby/readTogether';
import { END_CARD_HEIGHT } from '../../../core/preview/reader';
import { firstPageOfSpread, spreadLabel } from '../../../core/preview/spreads';
import type { PageDrawOptions } from '../../../render/drawPage';
import { useStory } from '../../../state/useStory';
import { Text } from '../../../ui';
import { PageCounter } from '../../preview/PreviewControls';
import { PreviewPage, type PageOverlay } from '../../preview/PreviewParts';
import { usePreviewReader, type ReaderItem } from '../../preview/usePreviewReader';
import { StickerLayer, StickerSheet, type PlacedSticker } from './Stickers';

const VIEWABILITY = { viewAreaCoveragePercentThreshold: 50 };
const DRAW: PageDrawOptions = { placeholders: true };

/**
 * The preview reader, trimmed for reading together: no editing or flags; a long press drops a sticker on the
 * panel under the finger, and the session can move the reader to the host's page.
 */
export function TogetherReader({
  projectId,
  storyPages,
  jump,
  notes,
  onPageShown,
  onDrop,
}: {
  projectId: ID;
  storyPages: StoryPage[];
  jump: { index: number; seq: number } | null;
  notes: (PlacedSticker & { pageId: ID })[];
  onPageShown: (pageId: ID) => void;
  onDrop: (pageId: ID, panelId: ID | null, x: number, y: number, sticker: StickerId, text: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const reader = usePreviewReader({ projectId, initialChapterId: storyPages[jump?.index ?? 0]?.chapterId, width, height });
  const { manga, groups, total, index, currentPageId } = reader;
  const [target, setTarget] = useState<{ pageId: ID; x: number; y: number } | null>(null);

  useEffect(() => {
    if (currentPageId) {
      onPageShown(currentPageId);
    }
  }, [currentPageId, onPageShown]);

  // Following: same chapter scrolls there, another chapter restarts the reader on that page.
  const { restart, jumpTo, chapterId } = reader;
  useEffect(() => {
    const page = jump ? storyPages[jump.index] : undefined;
    if (!page) {
      return;
    }
    if (page.chapterId === chapterId) {
      jumpTo(page.pageId);
    } else {
      restart(page.chapterId, page.indexInChapter, false);
    }
  }, [jump?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLongPressAt = useCallback((pageId: ID, x: number, y: number) => setTarget({ pageId, x, y }), []);
  const onFlag = useCallback((pageId: ID) => setTarget({ pageId, x: 0.5, y: 0.5 }), []);
  const overlay = useCallback<PageOverlay>(
    (pageId, w, h) => <StickerLayer notes={notes.filter(note => note.pageId === pageId)} width={w} height={h} />,
    [notes],
  );

  const drop = (sticker: StickerId, text: string) => {
    if (!target) {
      return;
    }
    const state = useStory.getState();
    const page = state.pages[target.pageId];
    const project = state.projects[projectId];
    let panelId: ID | null = null;
    if (page && project) {
      const size = pageSize(project, page);
      panelId = hitTestPanel(computePanels(page, size, { rtl: isRtl(project) }), { x: target.x * size.w, y: target.y * size.h });
    }
    onDrop(target.pageId, panelId, target.x, target.y, sticker, text);
    setTarget(null);
  };

  const items = useMemo(() => reader.items.filter(item => !!item.pageIds), [reader.items]);

  const renderItem = ({ item, index: at }: { item: ReaderItem; index: number }) => {
    const length = reader.metrics.lengths[at] ?? END_CARD_HEIGHT;
    return (
      <PreviewPage
        pageIds={item.pageIds!}
        firstPageNumber={firstPageOfSpread(groups, at) + 1}
        slots={reader.slots}
        frameWidth={width}
        frameHeight={manga ? height : length}
        pageWidth={manga ? reader.mangaPage.w : width}
        pageHeight={manga ? reader.mangaPage.h : length}
        rtl={manga}
        options={DRAW}
        zoomable={manga}
        active={at === index}
        onTap={reader.handleTap}
        onFlag={onFlag}
        onLongPressAt={onLongPressAt}
        overlay={overlay}
        onZoomChange={manga ? reader.onPageZoom : undefined}
        onPinchChange={manga ? reader.onPagePinch : undefined}
        outerGesture={manga ? reader.pagerGesture : undefined}
        onDoubleTap={manga ? undefined : reader.toggleListZoom}
      />
    );
  };

  if (total === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text tone="secondary">{t('This chapter has no pages to read yet.')}</Text>
      </View>
    );
  }

  const list = (
    <FlatList
      key={reader.listKey}
      ref={reader.listRef}
      data={items}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      horizontal={manga}
      inverted={manga}
      pagingEnabled={manga}
      scrollEnabled={reader.scrollEnabled}
      initialScrollIndex={reader.initialItem > 0 && reader.initialItem < items.length ? reader.initialItem : undefined}
      getItemLayout={(_, at) => ({ length: reader.metrics.lengths[at] ?? 0, offset: reader.metrics.offsets[at] ?? 0, index: at })}
      onViewableItemsChanged={reader.onViewable}
      viewabilityConfig={VIEWABILITY}
      onScrollToIndexFailed={() => undefined}
      onScroll={manga ? undefined : reader.onScroll}
      scrollEventThrottle={16}
      initialNumToRender={manga ? 1 : 2}
      maxToRenderPerBatch={2}
      windowSize={3}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    />
  );

  return (
    <View className="flex-1 overflow-hidden bg-bg">
      {manga ? (
        <GestureDetector gesture={reader.pagerGesture}>{list}</GestureDetector>
      ) : (
        <GestureDetector gesture={reader.listGesture}>
          <Animated.View collapsable={false} className="flex-1" style={reader.listZoomStyle}>
            {list}
          </Animated.View>
        </GestureDetector>
      )}
      <PageCounter label={spreadLabel(groups, index, total)} />
      <StickerSheet visible={!!target} onClose={() => setTarget(null)} onDrop={drop} />
    </View>
  );
}
