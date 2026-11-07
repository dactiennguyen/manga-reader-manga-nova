import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ID } from '../../core/model/types';
import type { ItemSize } from '../../core/reorder/reorder';
import {
  STORYBOARD_SIZES,
  cellWidth,
  gridColumns,
  gridRows,
  gridSpecOf,
  thumbHeight,
} from '../../core/reorder/storyboardGrid';
import { DragGhost, SETTLE_MS, useLiftGesture } from '../../ui';
import { PageThumb } from './PageThumb';
import { useGridDrag, type GridDrag, type GridRow } from './useGridDrag';

const { bottomSpace, cellGap, metaHeight, pad, rowGap, webtoonMaxHeight } =
  STORYBOARD_SIZES;

function GridItem({
  index,
  width,
  enabled,
  grid,
  children,
}: {
  index: number;
  width: number;
  enabled: boolean;
  grid: GridDrag;
  children: ReactNode;
}) {
  const { drag, active, offsets, animate, lift, change, release, cancel } =
    grid;
  const gesture = useLiftGesture({
    drag,
    enabled,
    onLift: () => {
      'worklet';
      lift(index);
    },
    onChange: change,
    onRelease: release,
    onCancel: cancel,
  });
  const style = useAnimatedStyle(() => {
    const offset = offsets.value[index];
    const x = offset ? offset.x : 0;
    const y = offset ? offset.y : 0;
    return {
      opacity: active.value === index && drag.ghost.value ? 0 : 1,
      transform: [
        {
          translateX: animate.value
            ? withTiming(x, { duration: SETTLE_MS })
            : x,
        },
        {
          translateY: animate.value
            ? withTiming(y, { duration: SETTLE_MS })
            : y,
        },
      ],
    };
  });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View className="items-center" style={[{ width }, style]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function StoryboardGrid({
  pageIds,
  pageSizes,
  webtoon,
  rtl,
  selection,
  onPressPage,
  onLongPressPage,
  onMove,
}: {
  pageIds: ID[];
  /** Each page's own size in page units, in the same order as pageIds. */
  pageSizes: ItemSize[];
  webtoon: boolean;
  rtl: boolean;
  selection: ID[] | null;
  onPressPage: (pageId: ID) => void;
  onLongPressPage: (pageId: ID) => void;
  onMove: (from: number, to: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const columns = gridColumns(width, webtoon);
  const cell = width > 0 ? cellWidth(width, columns, webtoon) : 0;
  const thumbW = Math.max(0, cell - cellGap);
  const spec = useMemo(
    () => gridSpecOf(width, columns, webtoon, rtl),
    [width, columns, webtoon, rtl],
  );
  const thumbs = useMemo(
    () =>
      pageSizes.map(size => ({
        w: thumbW,
        h: thumbHeight(thumbW, size, webtoon, webtoonMaxHeight),
      })),
    [pageSizes, thumbW, webtoon],
  );
  const sizes = useMemo(
    () => thumbs.map(size => ({ w: cell, h: size.h + metaHeight })),
    [thumbs, cell],
  );
  const { grid, lifted, busy, listRef, onScroll, viewH, contentH } =
    useGridDrag({
      pageIds,
      sizes,
      spec,
      onMenu: onLongPressPage,
      onMove,
    });
  const rows = useMemo<GridRow[]>(
    () => gridRows(pageIds, spec).map(ids => ({ key: ids[0], pageIds: ids })),
    [pageIds, spec],
  );

  const dragEnabled = !selection && pageIds.length > 1 && width > 0;

  const renderThumb = (pageId: ID) => {
    const index = pageIds.indexOf(pageId);
    const size = thumbs[index];
    return size ? (
      <PageThumb
        pageId={pageId}
        number={index + 1}
        width={size.w}
        height={size.h}
        selecting={!!selection}
        selected={selection?.includes(pageId)}
        onPress={() => {
          if (!busy.current) {
            onPressPage(pageId);
          }
        }}
        onLongPress={dragEnabled ? undefined : () => onLongPressPage(pageId)}
        onMenu={dragEnabled ? () => onLongPressPage(pageId) : undefined}
      />
    ) : null;
  };

  return (
    <View
      testID="storyboard-grid"
      className="flex-1 overflow-hidden"
      onLayout={event => {
        setWidth(event.nativeEvent.layout.width);
        viewH.set(event.nativeEvent.layout.height);
      }}
    >
      {width > 0 && (
        <Animated.FlatList
          ref={listRef}
          data={rows}
          extraData={selection}
          keyExtractor={row => row.key}
          renderItem={({ item }) => (
            <View
              className={`items-start justify-center ${
                spec.rtl ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {item.pageIds.map(id => (
                <GridItem
                  key={id}
                  index={pageIds.indexOf(id)}
                  width={cell}
                  enabled={dragEnabled}
                  grid={grid}
                >
                  {renderThumb(id)}
                </GridItem>
              ))}
            </View>
          )}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!lifted}
          removeClippedSubviews={false}
          onContentSizeChange={(_w, h) => contentH.set(h)}
          contentContainerStyle={{
            paddingTop: pad,
            paddingHorizontal: pad,
            paddingBottom: bottomSpace + insets.bottom,
            gap: rowGap,
          }}
        />
      )}
      {lifted && (
        <DragGhost
          drag={grid.drag}
          left={lifted.left}
          top={lifted.top}
          width={cell}
        >
          <View className="items-center">{renderThumb(lifted.id)}</View>
        </DragGhost>
      )}
    </View>
  );
}
