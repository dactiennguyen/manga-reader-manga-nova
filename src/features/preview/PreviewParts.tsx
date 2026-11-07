import { memo, useEffect, useMemo } from 'react';
import { View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  useExclusiveGestures,
  useLongPressGesture,
  useSimultaneousGestures,
  useTapGesture,
  type NativeGesture,
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { FlagIcon } from '../../ui/icons';

import type { ID } from '../../core/model/types';
import { pageLabel } from '../../core/preview/reader';
import { slotAtPoint } from '../../core/preview/spreads';
import { PageView } from '../../render/PageView';
import type { PageDrawOptions } from '../../render/drawPage';
import { usePage } from '../../state/hooks';
import { useStory } from '../../state/useStory';
import { Button, Card, Icon, Text } from '../../ui';
import { useZoom } from './useZoom';

const BADGE_ZONE = 52;

const PAGE_ACTIONS: AccessibilityActionInfo[] = [
  { name: 'activate', label: 'Show or hide controls' },
  { name: 'longpress', label: 'Flag this page' },
];

const TURN_ACTIONS: AccessibilityActionInfo[] = [
  { name: 'nextPage', label: 'Next page' },
  { name: 'previousPage', label: 'Previous page' },
];

function PageSlot({ pageId, width, options }: { pageId: ID; width: number; options: PageDrawOptions }) {
  const page = usePage(pageId);
  return (
    <View style={{ width }}>
      <PageView pageId={pageId} width={width} options={options} />
      {page && !page.done && (
        <View className="absolute left-2 top-2 rounded-sm bg-raised/80 px-2 py-0.5">
          <Text variant="caption">Not done</Text>
        </View>
      )}
      {page?.flag && (
        <View className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-accent">
          <Icon icon={FlagIcon} size={16} color="on-accent" />
        </View>
      )}
    </View>
  );
}

function usePageLabels(pageIds: ID[], firstPageNumber: number): string {
  const pages = useStory(s => s.pages);
  return pageIds
    .map((id, i) => {
      const page = pages[id];
      return page ? pageLabel(firstPageNumber + i, Object.keys(page.panels).length, !!page.done, !!page.flag) : '';
    })
    .filter(Boolean)
    .join('. ');
}

export const PreviewPage = memo(function PreviewPageItem({
  pageIds,
  firstPageNumber,
  slots,
  frameWidth,
  frameHeight,
  pageWidth,
  pageHeight,
  rtl,
  options,
  zoomable,
  active,
  onTap,
  onFlag,
  onZoomChange,
  onPinchChange,
  outerGesture,
  onDoubleTap,
}: {
  pageIds: ID[];
  firstPageNumber: number;
  slots: number;
  frameWidth: number;
  frameHeight: number;
  pageWidth: number;
  pageHeight: number;
  rtl: boolean;
  options: PageDrawOptions;
  zoomable: boolean;
  active: boolean;
  onTap: (x: number, zoomed: boolean) => void;
  onFlag: (pageId: ID) => void;
  onZoomChange?: (zoomed: boolean) => void;
  onPinchChange?: (active: boolean) => void;
  outerGesture?: NativeGesture;
  onDoubleTap?: (x: number, y: number) => void;
}) {
  const contentW = slots * pageWidth;
  const { pinch, pan, style, zoomed, reset, toggleAt, toContent } = useZoom({
    frameW: frameWidth,
    frameH: frameHeight,
    contentW,
    contentH: pageHeight,
    enabled: zoomable,
    onChange: onZoomChange,
    onPinch: onPinchChange,
    outer: outerGesture,
  });

  useEffect(() => {
    if (!active) {
      reset(false);
    }
  }, [active, reset]);

  const touches = useMemo(() => {
    const slotAt = (x: number, y: number) => {
      const point = toContent(x, y);
      const slot = slotAtPoint(point.x, pageWidth, slots, pageIds.length, rtl);
      const left = rtl ? contentW - (slot + 1) * pageWidth : slot * pageWidth;
      const onBadge =
        point.x >= left + pageWidth - BADGE_ZONE &&
        point.x <= left + pageWidth &&
        point.y >= 0 &&
        point.y <= BADGE_ZONE;
      return { pageId: pageIds[slot], onBadge };
    };
    return {
      tap: {
        runOnJS: true,
        maxDistance: 16,
        onDeactivate: (e: { canceled: boolean; x: number; y: number; absoluteX: number }) => {
          if (e.canceled) {
            return;
          }
          const hit = slotAt(e.x, e.y);
          if (!zoomed && hit.onBadge && useStory.getState().pages[hit.pageId]?.flag) {
            onFlag(hit.pageId);
          } else {
            onTap(e.absoluteX, zoomed);
          }
        },
      },
      doubleTap: {
        runOnJS: true,
        numberOfTaps: 2,
        maxDelay: 220,
        maxDistance: 16,
        onDeactivate: (e: { canceled: boolean; x: number; y: number; absoluteX: number; absoluteY: number }) => {
          if (e.canceled) {
            return;
          }
          if (onDoubleTap) {
            onDoubleTap(e.absoluteX, e.absoluteY);
          } else {
            toggleAt(e.x, e.y);
          }
        },
      },
      longPress: {
        runOnJS: true,
        minDuration: 450,
        numberOfPointers: 1,
        maxDistance: 12,
        onActivate: (e: { x: number; y: number }) => onFlag(slotAt(e.x, e.y).pageId),
      },
    };
  }, [zoomed, toggleAt, toContent, pageIds, slots, pageWidth, contentW, rtl, onTap, onFlag, onDoubleTap]);

  const tap = useTapGesture(touches.tap);
  const doubleTap = useTapGesture(touches.doubleTap);
  const longPress = useLongPressGesture(touches.longPress);
  const taps = useExclusiveGestures(doubleTap, tap);
  const presses = useCompetingGestures(longPress, taps);
  const gesture = useSimultaneousGestures(pinch, pan, presses);

  const label = usePageLabels(pageIds, firstPageNumber);

  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    switch (nativeEvent.actionName) {
      case 'activate':
        onTap(frameWidth / 2, zoomed);
        break;
      case 'longpress':
        onFlag(pageIds[0]);
        break;
      case 'nextPage':
        onTap(0, false);
        break;
      case 'previousPage':
        onTap(frameWidth, false);
        break;
    }
  };

  return (
    <View className="items-center justify-center overflow-hidden" style={{ width: frameWidth, height: frameHeight }}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          accessibilityActions={zoomable ? [...PAGE_ACTIONS, ...TURN_ACTIONS] : PAGE_ACTIONS}
          onAccessibilityAction={onAccessibilityAction}
          className="absolute inset-0 items-center justify-center"
        >
          <Animated.View
            className={`items-center ${rtl ? 'flex-row-reverse' : 'flex-row'}`}
            style={[{ width: contentW, height: pageHeight }, zoomable && style]}
          >
            {pageIds.map(id => (
              <PageSlot key={id} pageId={id} width={pageWidth} options={options} />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

export function EndCard({
  width,
  height,
  chapterNumber,
  pageCount,
  hasNext,
  onNext,
  onExport,
  onClose,
}: {
  width: number;
  height: number;
  chapterNumber: number;
  pageCount: number;
  hasNext: boolean;
  onNext: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  return (
    <View className="items-center justify-center" style={{ width, height }}>
      <Card className="w-4/5 max-w-[360px] gap-3 p-4">
        <Text variant="display" accessibilityRole="header" className="text-center">
          End of chapter {chapterNumber}
        </Text>
        <Text variant="caption" tone="secondary" className="text-center">
          {pageCount === 1 ? '1 page' : `${pageCount} pages`}
        </Text>
        {hasNext && <Button title="Read next chapter" onPress={onNext} />}
        <Button title="Export" variant={hasNext ? 'secondary' : 'primary'} onPress={onExport} />
        <Button title="Close" variant="ghost" onPress={onClose} />
      </Card>
    </View>
  );
}
