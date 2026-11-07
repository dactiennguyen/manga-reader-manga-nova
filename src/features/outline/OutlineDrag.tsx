import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  edgeVelocity,
  insertionIndex,
  locateIn,
  nearestSection,
  sameSlot,
  type Box,
  type DropSlot,
} from '../../core/reorder/reorder';
import type { ID } from '../../core/model/types';
import { DragGhost, EDGE_SIZE, EDGE_SPEED, SETTLE_MS, haptic, useDragState, useLiftGesture, type DragState } from '../../ui';

/**
 * The drop maths mirrors the column layout, so these sizes are the only source for both.
 * OutlineScreen styles the head, gaps and padding from here. Do not restyle them with classes.
 */
export const OUTLINE_SIZES = {
  headHeight: 48,
  cardGap: 12,
  columnPad: 12,
  columnGap: 12,
  markerHeight: 4,
} as const;

const NO_BOX: Box = { x: 0, y: 0, w: 0, h: 0 };

const RELEASE_GUARD_MS = 200;

type Lifted = { id: ID; start: Box; origin: Box };

export type OutlineDragController = {
  drag: DragState;
  horizontal: boolean;
  lifted: Lifted | null;
  busy: RefObject<boolean>;
  scrollRef: AnimatedRef<Animated.ScrollView>;
  layerRef: AnimatedRef<Animated.View>;
  tick: SharedValue<number>;
  activeId: SharedValue<string>;
  targetSection: SharedValue<number>;
  marker: SharedValue<Box | null>;
  cardBoxes: SharedValue<Record<string, Box>>;
  zoneBoxes: SharedValue<Record<string, Box>>;
  scroll: SharedValue<number>;
  scrollStart: SharedValue<number>;
  contentSize: SharedValue<number>;
  lift: (id: ID, start: Box) => void;
  change: () => void;
  release: (moved: boolean) => void;
  cancel: () => void;
};

export function useOutlineDrag({
  sections,
  horizontal,
  onMove,
  onMenu,
}: {
  sections: ID[][];
  horizontal: boolean;
  onMove: (chapterId: ID, section: number, index: number) => void;
  onMenu: (chapterId: ID) => void;
}): OutlineDragController {
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const busy = useRef(false);
  const latest = useRef({ sections, onMove, onMenu });
  useEffect(() => {
    latest.current = { sections, onMove, onMenu };
  });
  const drag = useDragState();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const layerRef = useAnimatedRef<Animated.View>();
  const tick = useSharedValue(0);
  const activeId = useSharedValue('');
  const targetSection = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const marker = useSharedValue<Box | null>(null);
  const cardBoxes = useSharedValue<Record<string, Box>>({});
  const zoneBoxes = useSharedValue<Record<string, Box>>({});
  const start = useSharedValue<Box>(NO_BOX);
  const origin = useSharedValue<Box>(NO_BOX);
  const dropping = useSharedValue(false);
  const scroll = useSharedValue(0);
  const scrollStart = useSharedValue(0);
  const contentSize = useSharedValue(0);
  const order = useDerivedValue(() => sections);

  const frame = useRef<{ setActive: (active: boolean) => void } | null>(null);

  useEffect(() => {
    scroll.set(0);
  }, [horizontal, scroll]);

  const clear = useCallback(() => {
    activeId.set('');
    targetSection.set(-1);
    targetIndex.set(-1);
    marker.set(null);
    dropping.set(false);
    drag.lifted.set(0);
    frame.current?.setActive(false);
    setLifted(null);
    setTimeout(() => {
      busy.current = false;
    }, RELEASE_GUARD_MS);
  }, [activeId, drag.lifted, dropping, marker, targetIndex, targetSection]);

  const onLiftJS = useCallback((id: ID, startBox: Box, originBox: Box) => {
    busy.current = true;
    frame.current?.setActive(true);
    setLifted({ id, start: startBox, origin: originBox });
  }, []);

  const openMenu = useCallback(
    (id: ID) => {
      clear();
      latest.current.onMenu(id);
    },
    [clear],
  );

  const finish = useCallback(
    (id: ID, section: number, index: number) => {
      haptic();
      const to: DropSlot = { section, index };
      if (section >= 0 && index >= 0 && !sameSlot(locateIn(latest.current.sections, id), to)) {
        latest.current.onMove(id, section, index);
      }
      clear();
    },
    [clear],
  );

  const change = useCallback(() => {
    'worklet';
    const id = activeId.value;
    if (!id || dropping.value || !drag.moved.value) {
      return;
    }
    const shift = scroll.value - scrollStart.value;
    const x = start.value.x + drag.grabX.value + drag.tx.value + (horizontal ? shift : 0);
    const y = start.value.y + drag.grabY.value + drag.ty.value + (horizontal ? 0 : shift);
    const lists = order.value;
    const zones = lists.map((_, index) => zoneBoxes.value[String(index)] ?? NO_BOX);
    const section = nearestSection(zones, x, y);
    if (section < 0) {
      return;
    }
    const boxes: Box[] = [];
    for (const cardId of lists[section]) {
      const box = cardBoxes.value[cardId];
      if (cardId !== id && box) {
        boxes.push(box);
      }
    }
    const index = insertionIndex(boxes, y);
    if (section === targetSection.value && index === targetIndex.value) {
      return;
    }
    const zone = zones[section];
    const last = boxes[boxes.length - 1];
    const { cardGap, columnPad, headHeight, markerHeight } = OUTLINE_SIZES;
    const lineY =
      index < boxes.length
        ? boxes[index].y - cardGap / 2
        : last
        ? last.y + last.h + cardGap / 2
        : zone.y + headHeight + cardGap / 2;
    targetSection.value = section;
    targetIndex.value = index;
    marker.value = { x: zone.x + columnPad, y: lineY - markerHeight / 2, w: zone.w - columnPad * 2, h: markerHeight };
  }, [
    activeId,
    cardBoxes,
    drag.grabX,
    drag.grabY,
    drag.moved,
    drag.tx,
    drag.ty,
    dropping,
    horizontal,
    marker,
    order,
    scroll,
    scrollStart,
    start,
    targetIndex,
    targetSection,
    zoneBoxes,
  ]);

  const lift = useCallback(
    (id: ID, startBox: Box) => {
      'worklet';
      const layer = measure(layerRef);
      const originBox = layer ? { x: layer.pageX, y: layer.pageY, w: layer.width, h: layer.height } : NO_BOX;
      cardBoxes.value = {};
      zoneBoxes.value = {};
      start.value = startBox;
      origin.value = originBox;
      activeId.value = id;
      targetSection.value = -1;
      targetIndex.value = -1;
      marker.value = null;
      dropping.value = false;
      scrollStart.value = scroll.value;
      tick.value = tick.value + 1;
      scheduleOnRN(onLiftJS, id, startBox, originBox);
    },
    [
      activeId,
      cardBoxes,
      dropping,
      layerRef,
      marker,
      onLiftJS,
      origin,
      scroll,
      scrollStart,
      start,
      targetIndex,
      targetSection,
      tick,
      zoneBoxes,
    ],
  );

  const release = useCallback(
    (moved: boolean) => {
      'worklet';
      const id = activeId.value;
      if (!id) {
        return;
      }
      if (!moved) {
        scheduleOnRN(openMenu, id);
        return;
      }
      const section = targetSection.value;
      const index = targetIndex.value;
      const line = marker.value;
      const shift = scroll.value - scrollStart.value;
      dropping.value = true;
      drag.lifted.value = withTiming(0, { duration: SETTLE_MS });
      if (line) {
        drag.tx.value = withTiming(line.x - (horizontal ? shift : 0) - start.value.x, { duration: SETTLE_MS });
      }
      drag.ty.value = withTiming(
        line ? line.y - (horizontal ? 0 : shift) - start.value.y : drag.ty.value,
        { duration: SETTLE_MS },
        () => {
          scheduleOnRN(finish, id, section, index);
        },
      );
    },
    [
      activeId,
      drag.lifted,
      drag.tx,
      drag.ty,
      dropping,
      finish,
      horizontal,
      marker,
      openMenu,
      scroll,
      scrollStart,
      start,
      targetIndex,
      targetSection,
    ],
  );

  const cancel = useCallback(() => {
    'worklet';
    if (activeId.value && !dropping.value) {
      scheduleOnRN(clear);
    }
  }, [activeId, clear, dropping]);

  frame.current = useFrameCallback(() => {
    if (!activeId.value || dropping.value || !drag.moved.value) {
      return;
    }
    const size = horizontal ? origin.value.w : origin.value.h;
    const position = horizontal
      ? start.value.x + drag.grabX.value + drag.tx.value - origin.value.x
      : start.value.y + drag.grabY.value + drag.ty.value - origin.value.y;
    const velocity = edgeVelocity(position, size, EDGE_SIZE, EDGE_SPEED);
    const max = Math.max(0, contentSize.value - size);
    const next = Math.min(max, Math.max(0, scroll.value + velocity));
    if (velocity !== 0 && next !== scroll.value) {
      scrollTo(scrollRef, horizontal ? next : 0, horizontal ? 0 : next, false);
      change();
    }
  }, false);

  return useMemo(
    () => ({
      drag,
      horizontal,
      lifted,
      busy,
      scrollRef,
      layerRef,
      tick,
      activeId,
      targetSection,
      marker,
      cardBoxes,
      zoneBoxes,
      scroll,
      scrollStart,
      contentSize,
      lift,
      change,
      release,
      cancel,
    }),
    [
      drag,
      horizontal,
      lifted,
      scrollRef,
      layerRef,
      tick,
      activeId,
      targetSection,
      marker,
      cardBoxes,
      zoneBoxes,
      scroll,
      scrollStart,
      contentSize,
      lift,
      change,
      release,
      cancel,
    ],
  );
}

function useMeasured(ctl: OutlineDragController, store: SharedValue<Record<string, Box>>, key: string) {
  const ref = useAnimatedRef<Animated.View>();
  const { tick } = ctl;
  useAnimatedReaction(
    () => tick.value,
    (value, previous) => {
      if (previous === null || value === previous) {
        return;
      }
      const m = measure(ref);
      if (m) {
        const box = { x: m.pageX, y: m.pageY, w: m.width, h: m.height };
        store.modify(boxes => {
          'worklet';
          boxes[key] = box;
          return boxes;
        });
      }
    },
  );
  return ref;
}

export function DragCard({
  ctl,
  id,
  enabled,
  children,
}: {
  ctl: OutlineDragController;
  id: ID;
  enabled: boolean;
  children: ReactNode;
}) {
  const ref = useMeasured(ctl, ctl.cardBoxes, id);
  const { drag, lift, change, release, cancel, activeId } = ctl;
  const gesture = useLiftGesture({
    drag,
    enabled,
    onLift: () => {
      'worklet';
      const m = measure(ref);
      if (m) {
        lift(id, { x: m.pageX, y: m.pageY, w: m.width, h: m.height });
      }
    },
    onChange: change,
    onRelease: release,
    onCancel: cancel,
  });
  const style = useAnimatedStyle(() => ({ opacity: activeId.value === id ? 0.3 : 1 }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} style={style}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function DragZone({
  ctl,
  index,
  className,
  style,
  children,
}: {
  ctl: OutlineDragController;
  index: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useMeasured(ctl, ctl.zoneBoxes, String(index));
  const { targetSection } = ctl;
  const highlight = useAnimatedStyle(() => ({ opacity: targetSection.value === index ? 1 : 0 }));
  return (
    <Animated.View ref={ref} className={className} style={style}>
      <Animated.View pointerEvents="none" className="absolute inset-0 bg-accent/15" style={highlight} />
      {children}
    </Animated.View>
  );
}

export function DragScroll({ ctl, children, ...props }: ScrollViewProps & { ctl: OutlineDragController }) {
  const { scroll, contentSize, horizontal } = ctl;
  const onScroll = useAnimatedScrollHandler(event => {
    scroll.value = horizontal ? event.contentOffset.x : event.contentOffset.y;
  });
  return (
    <Animated.ScrollView
      {...props}
      ref={ctl.scrollRef}
      horizontal={horizontal}
      onScroll={onScroll}
      scrollEventThrottle={16}
      scrollEnabled={!ctl.lifted}
      onContentSizeChange={(w, h) => {
        contentSize.set(horizontal ? w : h);
      }}
    >
      {children}
    </Animated.ScrollView>
  );
}

export function DragLayer({ ctl, renderCard }: { ctl: OutlineDragController; renderCard: (id: ID) => ReactNode }) {
  const { marker, scroll, scrollStart, horizontal, lifted } = ctl;
  const line = useAnimatedStyle(() => {
    const box = marker.value;
    if (!box) {
      return { opacity: 0 };
    }
    const shift = scroll.value - scrollStart.value;
    return {
      opacity: 1,
      width: box.w,
      transform: [{ translateX: box.x - (horizontal ? shift : 0) }, { translateY: box.y - (horizontal ? 0 : shift) }],
    };
  });
  return (
    <Animated.View ref={ctl.layerRef} collapsable={false} pointerEvents="none" className="absolute inset-0 overflow-hidden">
      {lifted && (
        <View style={{ marginLeft: -lifted.origin.x, marginTop: -lifted.origin.y }}>
          <Animated.View
            className="absolute left-0 top-0 rounded-full bg-accent"
            style={[{ height: OUTLINE_SIZES.markerHeight }, line]}
          />
          <DragGhost drag={ctl.drag} left={lifted.start.x} top={lifted.start.y} width={lifted.start.w}>
            {renderCard(lifted.id)}
          </DragGhost>
        </View>
      )}
    </Animated.View>
  );
}
