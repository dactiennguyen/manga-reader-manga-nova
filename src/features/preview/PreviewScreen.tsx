import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { t } from '../../core/i18n';
import { chapterLabel, chapterNumber } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { END_CARD_HEIGHT, itemOfSliderValue, sliderValueOfItem } from '../../core/preview/reader';
import { firstPageOfSpread, spreadLabel } from '../../core/preview/spreads';
import type { PageDrawOptions } from '../../render/drawPage';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Button, EmptyState } from '../../ui';
import { FriendNotesSheet, placedOn, useChapterNotes } from '../nearby/share/FriendNotesSheet';
import { StickerLayer } from '../nearby/share/Stickers';
import type { ReviewNote } from '../../core/nearby/reviewNotes';
import { PageCounter, ReaderBottomBar, ReaderTopBar } from './PreviewControls';
import { EndCard, PreviewPage, type PageOverlay } from './PreviewParts';
import { FlagListSheet, FlagSheet, ReaderMenus, type ReaderSheet } from './PreviewSheets';
import { usePreviewReader, type ReaderItem } from './usePreviewReader';
import { useReaderChrome } from './useReaderChrome';

const VIEWABILITY = { viewAreaCoveragePercentThreshold: 50 };

export function PreviewScreen() {
  const navigation = useAppNavigation();
  const { width, height } = useWindowDimensions();
  const { projectId, chapterId: initialChapterId } = useAppRoute<'Preview'>().params;
  const chrome = useReaderChrome();
  const reader = usePreviewReader({ projectId, initialChapterId, width, height });
  const { project, chapters, chapter, chapterId, pages, allPageIds, groups, manga, index, total } = reader;

  const [sheet, setSheet] = useState<ReaderSheet>(null);
  const [flagPageId, setFlagPageId] = useState<ID | null>(null);
  const [lang, setLang] = useState<string | undefined>(undefined);
  const openFlag = useCallback((pageId: ID) => setFlagPageId(pageId), []);
  const friendNotes = useChapterNotes(reader.chapterId);
  // The note picked in "Notes from friends", drawn on its page for a moment so the panel is easy to find.
  const [lifted, setLifted] = useState<ReviewNote | null>(null);
  useEffect(() => {
    if (!lifted) {
      return;
    }
    const timer = setTimeout(() => setLifted(null), 6000);
    return () => clearTimeout(timer);
  }, [lifted]);
  const overlay = useCallback<PageOverlay>(
    (pageId, w, h) => (lifted ? <StickerLayer notes={placedOn([lifted], pageId)} width={w} height={h} highlight={lifted.id} /> : null),
    [lifted],
  );

  const languages = useMemo(() => project?.languages ?? [], [project]);
  const activeLang = lang && languages.includes(lang) ? lang : undefined;
  const drawOptions = useMemo<PageDrawOptions>(
    () => (activeLang ? { placeholders: true, lang: activeLang } : { placeholders: true }),
    [activeLang],
  );

  const close = () => navigation.goBack();

  if (!project || !chapter || allPageIds.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg p-6">
        <EmptyState
          title={project && chapter ? t('This chapter has no pages to read yet.') : t('There is nothing to preview yet.')}
          action={
            project && chapter
              ? {
                  label: t('Go to storyboard'),
                  onPress: () => navigation.replace('Storyboard', { chapterId: chapter.id }),
                }
              : undefined
          }
        />
        <Button title={t('Close')} variant="secondary" onPress={close} />
      </View>
    );
  }

  const number = chapterId ? chapterNumber(project, chapterId) : 0;
  const chapterIndex = chapters.findIndex(ch => ch.id === chapterId);
  const nextChapter = chapters.slice(chapterIndex + 1).find(ch => ch.pageIds.length > 0);
  const { currentIds, currentPageId } = reader;
  const flagCount = allPageIds.filter(id => !!pages[id].flag).length;
  const shown = Math.min(index + 1, groups.length);
  const label = spreadLabel(groups, index, total);

  const renderItem = ({ item, index: at }: { item: ReaderItem; index: number }) => {
    const length = reader.metrics.lengths[at] ?? END_CARD_HEIGHT;
    if (!item.pageIds) {
      return (
        <EndCard
          width={width}
          height={manga ? height : length}
          chapterNumber={number}
          pageCount={total}
          hasNext={!!nextChapter}
          onNext={() => reader.restart(nextChapter?.id, 0)}
          onExport={() => navigation.navigate('Export', { projectId, chapterId })}
          onClose={close}
        />
      );
    }
    return (
      <PreviewPage
        pageIds={item.pageIds}
        firstPageNumber={firstPageOfSpread(groups, at) + 1}
        slots={reader.slots}
        frameWidth={width}
        frameHeight={manga ? height : length}
        pageWidth={manga ? reader.mangaPage.w : width}
        pageHeight={manga ? reader.mangaPage.h : length}
        rtl={manga}
        options={drawOptions}
        zoomable={manga}
        active={at === index}
        onTap={reader.handleTap}
        onFlag={openFlag}
        onZoomChange={manga ? reader.onPageZoom : undefined}
        onPinchChange={manga ? reader.onPagePinch : undefined}
        outerGesture={manga ? reader.pagerGesture : undefined}
        onDoubleTap={manga ? undefined : reader.toggleListZoom}
        overlay={overlay}
      />
    );
  };

  const list = (
    <FlatList
      key={reader.listKey}
      ref={reader.listRef}
      data={reader.items}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      horizontal={manga}
      inverted={manga}
      pagingEnabled={manga}
      scrollEnabled={reader.scrollEnabled}
      initialScrollIndex={
        reader.initialItem > 0 && reader.initialItem < reader.items.length ? reader.initialItem : undefined
      }
      getItemLayout={(_, at) => ({
        length: reader.metrics.lengths[at] ?? 0,
        offset: reader.metrics.offsets[at] ?? 0,
        index: at,
      })}
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

      {!reader.controls && total > 0 && <PageCounter label={label} />}

      {reader.controls && (
        <>
          <ReaderTopBar
            chapterTitle={chapterLabel(useStory.getState(), chapter.id)}
            flagged={currentIds.some(id => !!pages[id]?.flag)}
            canFlag={!!currentPageId}
            flagCount={flagCount}
            onClose={close}
            onChapters={() => setSheet('chapters')}
            onFlag={() => currentPageId && setFlagPageId(currentPageId)}
            onMore={() => setSheet('menu')}
          />
          <ReaderBottomBar
            label={label}
            sliderCount={groups.length}
            sliderValue={sliderValueOfItem(shown, groups.length, manga)}
            canEdit={!!currentPageId}
            onSeek={value => reader.goTo(itemOfSliderValue(value, groups.length, manga), false)}
            onEdit={() => currentPageId && navigation.navigate('PanelLayout', { pageId: currentPageId })}
          />
        </>
      )}

      <ReaderMenus
        sheet={sheet}
        onSheet={setSheet}
        chapters={chapters}
        hideUnfinished={reader.hideUnfinished}
        flagCount={flagCount}
        awake={chrome.awake}
        manga={manga}
        landscape={reader.landscape}
        languages={languages}
        activeLang={activeLang}
        onChapter={id => reader.restart(id, 0)}
        onToggleUnfinished={reader.toggleUnfinished}
        onToggleAwake={() => chrome.setAwake(value => !value)}
        onRotate={() => chrome.rotateTo(reader.landscape ? 'portrait' : 'landscape')}
        onLanguage={setLang}
        noteCount={friendNotes.length}
      />
      <FriendNotesSheet
        visible={sheet === 'notes'}
        chapterId={chapterId}
        onClose={() => setSheet(null)}
        onJump={note => {
          setLifted(note);
          reader.jumpTo(note.pageId);
        }}
      />
      <FlagListSheet
        visible={sheet === 'flags'}
        onClose={() => setSheet(null)}
        pageIds={allPageIds}
        onJump={reader.jumpTo}
      />
      <FlagSheet
        pageId={flagPageId}
        pageLabel={flagPageId ? t('Page {n}', { n: allPageIds.indexOf(flagPageId) + 1 }) : ''}
        onClose={() => setFlagPageId(null)}
      />
    </View>
  );
}
