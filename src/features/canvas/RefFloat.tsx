import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View, type ImageLoadEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { t } from '../../core/i18n';
import { stepIndex } from '../../core/refBoards/layout';
import {
  REF_WINDOW,
  clampWidth,
  clampX,
  clampY,
  defaultWindow,
  fitWindow,
  nextOpacity,
  pictureHeight,
  tabSide,
  type Area,
  type RefWindowState,
} from '../../core/refBoards/window';
import { fileUri } from '../../core/util/paths';
import { useRefBoards } from '../../state/useRefBoards';
import { ICON, Icon, IconButton, Pressable, Text } from '../../ui';
import {
  CaretLeftIcon,
  CaretRightIcon,
  CloseIcon,
  FlipIcon,
  MinimizeIcon,
  OpacityIcon,
  RefBoardIcon,
  ResizeIcon,
} from '../../ui/icons';

/** One picture in the window. Width and height are the picture's pixels when known. */
export type RefShot = { path: string; caption?: string; width?: number; height?: number };

/** A picture to draw from, a character with their sheet and appearance notes, or a whole board. */
export type CanvasReference = { id: string; images: RefShot[]; title?: string; note?: string; boardId?: string };

const FLICK_VELOCITY = 900;
const FLICK_DISTANCE = 32;

function ratioOf(shot: RefShot | undefined): number {
  return shot?.width && shot.height ? shot.height / shot.width : 1;
}

/**
 * A small window over the canvas with the picture to draw from. It covers only its own frame, so drawing
 * outside it goes on as usual. Drag it by any part, flick the picture sideways or use the arrows for the
 * next one, drag the corner to resize, or fold it into a tab at the edge. Where it was, its size, opacity
 * and flip are kept until the app closes.
 */
export function RefFloat({
  reference,
  area,
  side,
  top,
  onClose,
}: {
  reference: CanvasReference;
  area: Area;
  /** Where a new window starts: away from the tool rail. */
  side: 'left' | 'right';
  top: number;
  onClose: () => void;
}) {
  const { images, title, note, boardId } = reference;
  const [wanted, setIndex] = useState(() => {
    const { session } = useRefBoards.getState();
    return boardId && session.boardId === boardId ? session.index : 0;
  });
  // Pictures can be removed from the board while the window is open.
  const index = Math.min(wanted, Math.max(0, images.length - 1));
  const shot = images[index];
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const ratio = (shot && ratios[shot.path]) || ratioOf(shot);
  const [win, setWin] = useState<RefWindowState>(() => {
    const saved = useRefBoards.getState().session.window;
    // Picking something to look at always opens the window, even if it was folded last time.
    return saved ? { ...fitWindow(saved, area, ratio, top), collapsed: false } : defaultWindow(area, side, top);
  });
  const winRef = useRef(win);
  winRef.current = win;

  const x = useSharedValue(win.x);
  const y = useSharedValue(win.y);
  const w = useSharedValue(win.w);
  const h = useSharedValue(REF_WINDOW.header + pictureHeight(win.w, ratio) + REF_WINDOW.tools);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const areaW = useSharedValue(area.w);
  const areaH = useSharedValue(area.h);
  const topV = useSharedValue(top);
  const shotRatio = useSharedValue(ratio);

  useEffect(() => {
    areaW.set(area.w);
    areaH.set(area.h);
    topV.set(top);
  }, [area.w, area.h, top, areaW, areaH, topV]);
  useEffect(() => {
    shotRatio.set(ratio);
  }, [ratio, shotRatio]);

  const commit = useCallback((patch: Partial<RefWindowState>) => {
    const next = { ...winRef.current, ...patch };
    winRef.current = next;
    setWin(next);
    useRefBoards.getState().setSession({ window: next });
  }, []);

  // A rotation or a new layout brings the window back inside the drawing area.
  useEffect(() => {
    if (area.w > 0 && area.h > 0) {
      const next = fitWindow(winRef.current, area, ratio, top);
      x.set(next.x);
      y.set(next.y);
      w.set(next.w);
      commit(next);
    }
    // Only a new area or top moves the window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.w, area.h, top]);

  const show = useCallback(
    (next: number) => {
      setIndex(next);
      if (boardId) {
        useRefBoards.getState().setSession({ boardId, index: next });
      }
    },
    [boardId],
  );
  const step = useCallback((delta: number) => show(stepIndex(index, delta, images.length)), [show, index, images.length]);

  const settle = useCallback(() => commit({ x: x.get(), y: y.get(), w: w.get() }), [commit, x, y, w]);

  const many = images.length > 1;

  // Dragging anywhere moves the window. A quick sideways flick on the picture shows the next one instead.
  const drag = usePanGesture({
    maxPointers: 1,
    onActivate: () => {
      'worklet';
      startX.value = x.value;
      startY.value = y.value;
    },
    onUpdate: e => {
      'worklet';
      const area2 = { w: areaW.value, h: areaH.value };
      x.value = clampX(startX.value + e.translationX, w.value, area2);
      y.value = clampY(startY.value + e.translationY, h.value, area2, topV.value);
    },
    onDeactivate: e => {
      'worklet';
      const flick =
        many &&
        Math.abs(e.velocityX) > FLICK_VELOCITY &&
        Math.abs(e.translationX) > FLICK_DISTANCE &&
        Math.abs(e.translationX) > 2 * Math.abs(e.translationY);
      if (flick) {
        x.value = startX.value;
        y.value = startY.value;
        scheduleOnRN(step, e.translationX < 0 ? 1 : -1);
      } else {
        scheduleOnRN(settle);
      }
    },
  });

  // Wins over moving the window when the drag starts on the corner.
  const resize = usePanGesture({
    block: drag,
    maxPointers: 1,
    onActivate: () => {
      'worklet';
      startW.value = w.value;
    },
    onUpdate: e => {
      'worklet';
      const room = areaW.value - x.value - REF_WINDOW.edge;
      w.value = Math.min(room, clampWidth(startW.value + e.translationX, areaW.value));
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(settle);
    },
  });

  const tabDrag = usePanGesture({
    maxPointers: 1,
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      startY.value = y.value;
    },
    onUpdate: e => {
      'worklet';
      y.value = clampY(startY.value + e.translationY, REF_WINDOW.tab, { w: areaW.value, h: areaH.value }, topV.value);
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(settle);
    },
  });

  const frame = useAnimatedStyle(() => ({ left: x.value, top: y.value, width: w.value }));
  const picture = useAnimatedStyle(() => ({ height: pictureHeight(w.value, shotRatio.value) }));
  const tabPlace = useAnimatedStyle(() => ({ top: y.value }));

  const onLoad = (event: ImageLoadEvent) => {
    const { width, height } = event.nativeEvent.source;
    if (shot && width > 0 && height > 0 && !ratios[shot.path]) {
      setRatios(current => ({ ...current, [shot.path]: height / width }));
    }
  };

  const label = title ? t('{name} reference', { name: title }) : t('Reference image');

  if (win.collapsed) {
    const edge = tabSide(win.x, win.w, area.w);
    return (
      <GestureDetector gesture={tabDrag}>
        <Animated.View className={`absolute ${edge === 'left' ? 'left-0' : 'right-0'}`} style={tabPlace}>
          <Pressable
            accessibilityLabel={t('Show {name}', { name: label })}
            onPress={() => commit({ collapsed: false })}
            className={`h-14 w-12 items-center justify-center gap-0.5 bg-raised ${edge === 'left' ? 'rounded-r-md' : 'rounded-l-md'}`}
          >
            <Icon icon={RefBoardIcon} size={ICON.md} color="text" />
            {many ? (
              <Text variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                {`${index + 1}/${images.length}`}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    );
  }

  const caption = shot?.caption || note;
  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        className="absolute overflow-hidden rounded-md bg-raised"
        style={frame}
        onLayout={event => h.set(event.nativeEvent.layout.height)}
      >
        <View className="h-12 flex-row items-center pl-3">
          <View className="flex-1">
            <Text variant="label" numberOfLines={1}>
              {title || t('Reference image')}
            </Text>
            {many ? (
              <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                {`${index + 1} / ${images.length}`}
              </Text>
            ) : null}
          </View>
          <IconButton icon={MinimizeIcon} size={ICON.sm} onPress={() => commit({ collapsed: true })} accessibilityLabel={t('Fold into a tab')} />
          <IconButton icon={CloseIcon} size={ICON.sm} onPress={onClose} accessibilityLabel={t('Hide reference image')} />
        </View>
        <Animated.View className="w-full items-center justify-center bg-paper" style={picture}>
          {shot ? (
            <Image
              key={shot.path}
              source={{ uri: fileUri(shot.path) }}
              onLoad={onLoad}
              className="h-full w-full"
              style={{ opacity: win.opacity, transform: [{ scaleX: win.flipped ? -1 : 1 }] }}
              resizeMode="contain"
              accessibilityLabel={shot.caption ? `${label}, ${shot.caption}` : label}
            />
          ) : null}
          {many ? (
            <>
              <View className="absolute left-0">
                <IconButton icon={CaretLeftIcon} size={ICON.sm} onPress={() => step(-1)} accessibilityLabel={t('Previous picture')} className="bg-raised/80" />
              </View>
              <View className="absolute right-0">
                <IconButton icon={CaretRightIcon} size={ICON.sm} onPress={() => step(1)} accessibilityLabel={t('Next reference image')} className="bg-raised/80" />
              </View>
            </>
          ) : null}
        </Animated.View>
        {caption ? (
          <Text variant="caption" tone="secondary" numberOfLines={3} className="px-3 pt-1">
            {caption}
          </Text>
        ) : null}
        <View className="h-12 flex-row items-center">
          <IconButton
            icon={OpacityIcon}
            size={ICON.sm}
            active={win.opacity < 1}
            badge={win.opacity < 1 ? Math.round(win.opacity * 100) : undefined}
            onPress={() => commit({ opacity: nextOpacity(win.opacity) })}
            accessibilityLabel={t('Picture opacity {percent}%', { percent: Math.round(win.opacity * 100) })}
          />
          <IconButton
            icon={FlipIcon}
            size={ICON.sm}
            active={win.flipped}
            onPress={() => commit({ flipped: !win.flipped })}
            accessibilityLabel={t('Flip horizontally')}
          />
          <View className="flex-1" />
          <GestureDetector gesture={resize}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t('Drag to resize')}
              accessibilityActions={[
                { name: 'increment', label: t('Enlarge reference image') },
                { name: 'decrement', label: t('Shrink reference image') },
              ]}
              onAccessibilityAction={event => {
                const delta = event.nativeEvent.actionName === 'increment' ? 40 : -40;
                const next = Math.min(area.w - win.x - REF_WINDOW.edge, clampWidth(win.w + delta, area.w));
                w.set(next);
                commit({ w: next });
              }}
              className="h-12 w-12 items-center justify-center"
            >
              <Icon icon={ResizeIcon} size={ICON.sm} color="text-secondary" />
            </View>
          </GestureDetector>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
