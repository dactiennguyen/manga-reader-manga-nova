import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList, FlatListProps, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useNativeGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { pageSize } from '../../core/layout/layout';
import type { ID } from '../../core/model/types';
import { END_CARD_HEIGHT, clampItem, fitPage, itemMetrics, itemOfPage, readerTap } from '../../core/preview/reader';
import { buildSpreads, firstPageOfSpread } from '../../core/preview/spreads';
import { useChapters, useProject } from '../../state/hooks';
import { useStory } from '../../state/useStory';
import { useZoom } from './useZoom';

export type ReaderItem = { key: string; pageIds?: ID[] };

type Viewable = NonNullable<FlatListProps<ReaderItem>['onViewableItemsChanged']>;

/** Where the reader is in a chapter. The position is a page, so it survives any change of layout. */
export function usePreviewReader({
  projectId,
  initialChapterId,
  width,
  height,
}: {
  projectId: ID;
  initialChapterId?: ID;
  width: number;
  height: number;
}) {
  const project = useProject(projectId);
  const chapters = useChapters(projectId);
  const pages = useStory(s => s.pages);

  const [chapterId, setChapterId] = useState<ID | undefined>(
    () => initialChapterId ?? chapters.find(ch => ch.pageIds.length > 0)?.id ?? chapters[0]?.id,
  );
  const chapter = chapters.find(ch => ch.id === chapterId);
  const allPageIds = useMemo(() => (chapter?.pageIds ?? []).filter(id => !!pages[id]), [chapter, pages]);

  const [hideUnfinished, setHideUnfinished] = useState(false);
  const pageIds = useMemo(
    () => (hideUnfinished ? allPageIds.filter(id => pages[id].done) : allPageIds),
    [allPageIds, hideUnfinished, pages],
  );
  const total = pageIds.length;

  const manga = project?.format !== 'webtoon';
  const landscape = width > height;
  const slots = manga && landscape ? 2 : 1;
  const groups = useMemo(() => buildSpreads(pageIds, slots === 2), [pageIds, slots]);

  const [startPage, setStartPage] = useState(0);
  const [pagePos, setPagePos] = useState(0);
  const [session, setSession] = useState(0);
  const [controls, setControls] = useState(false);
  const [pageZoomed, setPageZoomed] = useState(false);
  const [pinching, setPinching] = useState(false);
  const pinchingRef = useRef(false);

  // Rotating rebuilds the list, so it has to start again from the page being read.
  const layoutKey = `${width}:${slots}`;
  const [layout, setLayout] = useState(layoutKey);
  if (layout !== layoutKey) {
    setLayout(layoutKey);
    setStartPage(pagePos);
    setPageZoomed(false);
  }

  const index = itemOfPage(groups, pagePos, total);
  const initialItem = itemOfPage(groups, startPage, total);

  const listRef = useRef<FlatList<ReaderItem>>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const items = useMemo<ReaderItem[]>(
    () => [...groups.map(ids => ({ key: ids[0], pageIds: ids })), { key: 'end' }],
    [groups],
  );

  const metrics = useMemo(
    () =>
      itemMetrics(
        items.map(item => {
          if (manga) {
            return width;
          }
          const page = item.pageIds ? pages[item.pageIds[0]] : undefined;
          if (!page || !project) {
            return END_CARD_HEIGHT;
          }
          const size = pageSize(project, page);
          return Math.round((width * size.h) / size.w);
        }),
      ),
    [items, manga, pages, project, width],
  );

  const mangaPage = useMemo(
    () => (project ? fitPage({ w: width, h: height }, pageSize(project), slots) : { w: width, h: height }),
    [project, width, height, slots],
  );

  const scrollY = useSharedValue(0);
  const listZoom = useZoom({
    frameW: width,
    frameH: height,
    contentW: width,
    contentH: height,
    enabled: !manga,
    lockY: true,
    scrollY,
    scrollMax: Math.max(0, metrics.total - height),
  });
  const { reset: resetListZoom, toggleAt: toggleListZoom } = listZoom;
  const listGesture = useSimultaneousGestures(listZoom.pinch, listZoom.pan);
  const pagerGesture = useNativeGesture();

  useEffect(() => {
    setPageZoomed(false);
    setPinching(false);
    pinchingRef.current = false;
  }, [index]);

  useEffect(() => {
    resetListZoom(false);
  }, [layoutKey, resetListZoom]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const onPageZoom = useCallback((zoomed: boolean) => {
    setPageZoomed(zoomed);
    listRef.current?.scrollToIndex({ index: indexRef.current, animated: false });
  }, []);

  const onPagePinch = useCallback((active: boolean) => {
    if (active === pinchingRef.current) {
      return;
    }
    pinchingRef.current = active;
    setPinching(active);
    if (!active) {
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: false });
    }
  }, []);

  const reducedMotion = useReducedMotion();
  const goTo = useCallback(
    (target: number, animated = !reducedMotion) => {
      listRef.current?.scrollToIndex({ index: clampItem(target, items.length), animated });
    },
    [items.length, reducedMotion],
  );

  const handleTap = useCallback(
    (x: number, zoomed: boolean) => {
      const action = readerTap(x, width, manga, zoomed);
      if (action === 'next') {
        goTo(indexRef.current + 1);
      } else if (action === 'previous') {
        goTo(indexRef.current - 1);
      } else {
        setControls(value => !value);
      }
    },
    [manga, width, goTo],
  );

  const onViewable = useRef<Viewable>(({ viewableItems }) => {
    const first = viewableItems[0];
    if (first && first.index != null) {
      setPagePos(firstPageOfSpread(groupsRef.current, first.index));
    }
  }).current;

  const restart = (nextChapterId: ID | undefined, at: number, hide = hideUnfinished) => {
    setChapterId(nextChapterId);
    setHideUnfinished(hide);
    setStartPage(Math.max(0, at));
    setPagePos(Math.max(0, at));
    setPageZoomed(false);
    resetListZoom(false);
    setSession(value => value + 1);
  };

  const currentIds = groups[Math.min(index, groups.length - 1)] ?? [];
  const currentPageId = currentIds[0];

  const toggleUnfinished = () => {
    const hide = !hideUnfinished;
    const nextIds = hide ? allPageIds.filter(id => pages[id].done) : allPageIds;
    restart(chapterId, currentPageId ? nextIds.indexOf(currentPageId) : 0, hide);
  };

  const jumpTo = (pageId: ID) => {
    const at = pageIds.indexOf(pageId);
    if (at >= 0) {
      goTo(itemOfPage(groups, at, total), false);
    } else {
      restart(chapterId, allPageIds.indexOf(pageId), false);
    }
  };

  return {
    project,
    chapters,
    chapter,
    chapterId,
    pages,
    allPageIds,
    total,
    hideUnfinished,
    manga,
    landscape,
    slots,
    groups,
    items,
    metrics,
    mangaPage,
    index,
    initialItem,
    currentIds,
    currentPageId,
    controls,
    scrollEnabled: !manga || (!pageZoomed && !pinching),
    listKey: `${chapter?.id}:${layoutKey}:${session}`,
    listRef,
    listZoomStyle: listZoom.style,
    listGesture,
    pagerGesture,
    toggleListZoom,
    onScroll,
    onViewable,
    onPageZoom,
    onPagePinch,
    goTo,
    handleTap,
    restart,
    toggleUnfinished,
    jumpTo,
  };
}
