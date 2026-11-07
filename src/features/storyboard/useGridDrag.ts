import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ID } from '../../core/model/types';
import {
  edgeVelocity,
  gridBoxes,
  nearestIndex,
  previewOffsets,
  type GridSpec,
  type ItemSize,
  type Offset,
} from '../../core/reorder/reorder';
import { EDGE_SIZE, EDGE_SPEED, SETTLE_MS, haptic, useDragState, type DragState } from '../../ui';

const RELEASE_GUARD_MS = 200;

export type GridRow = { key: string; pageIds: ID[] };

type Lifted = { index: number; id: ID; left: number; top: number };

export type GridDrag = {
  drag: DragState;
  active: SharedValue<number>;
  offsets: SharedValue<Offset[]>;
  animate: SharedValue<boolean>;
  lift: (index: number) => void;
  change: () => void;
  release: (moved: boolean) => void;
  cancel: () => void;
};

export type GridDragController = {
  grid: GridDrag;
  lifted: Lifted | null;
  busy: RefObject<boolean>;
  listRef: AnimatedRef<Animated.FlatList<GridRow>>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  viewH: SharedValue<number>;
  contentH: SharedValue<number>;
};

/**
 * Lifting, the live preview, edge scrolling and the drop. Worklets capture what they call when they are
 * defined, so each helper here sits above the first worklet that uses it.
 */
export function useGridDrag({
  pageIds,
  sizes,
  spec,
  onMenu,
  onMove,
}: {
  pageIds: ID[];
  sizes: ItemSize[];
  spec: GridSpec;
  onMenu: (pageId: ID) => void;
  onMove: (from: number, to: number) => void;
}): GridDragController {
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const busy = useRef(false);
  const latest = useRef({ onMenu, onMove });
  useEffect(() => {
    latest.current = { onMenu, onMove };
  });
  const listRef = useAnimatedRef<Animated.FlatList<GridRow>>();
  const drag = useDragState();
  const active = useSharedValue(-1);
  const target = useSharedValue(-1);
  const offsets = useSharedValue<Offset[]>([]);
  const animate = useSharedValue(false);
  const dropping = useSharedValue(false);
  const scroll = useSharedValue(0);
  const scrollStart = useSharedValue(0);
  const viewH = useSharedValue(0);
  const contentH = useSharedValue(0);

  const boxes = useMemo(() => gridBoxes(sizes, spec), [sizes, spec]);
  const layout = useDerivedValue(() => ({ sizes, spec, boxes }));

  const frame = useRef<{ setActive: (isActive: boolean) => void } | null>(null);

  const onLiftJS = useCallback(
    (index: number, scrollY: number) => {
      const box = boxes[index];
      busy.current = true;
      frame.current?.setActive(true);
      if (box) {
        setLifted({ index, id: pageIds[index], left: box.x, top: box.y - scrollY });
      }
    },
    [boxes, pageIds],
  );

  const clear = useCallback(() => {
    animate.set(false);
    offsets.set([]);
    active.set(-1);
    target.set(-1);
    dropping.set(false);
    drag.lifted.set(0);
    frame.current?.setActive(false);
    setLifted(null);
    setTimeout(() => {
      busy.current = false;
    }, RELEASE_GUARD_MS);
  }, [active, animate, drag.lifted, dropping, offsets, target]);

  const openMenu = useCallback(
    (index: number) => {
      clear();
      const id = pageIds[index];
      if (id) {
        latest.current.onMenu(id);
      }
    },
    [clear, pageIds],
  );

  const finish = useCallback(
    (from: number, to: number) => {
      haptic();
      if (from !== to && from >= 0 && to >= 0) {
        latest.current.onMove(from, to);
      }
      clear();
    },
    [clear],
  );

  const change = useCallback(() => {
    'worklet';
    const from = active.value;
    const state = layout.value;
    const box = state.boxes[from];
    if (from < 0 || !box || dropping.value || !drag.moved.value) {
      return;
    }
    const x = box.x + box.w / 2 + drag.tx.value;
    const y = box.y + box.h / 2 + drag.ty.value + scroll.value - scrollStart.value;
    const next = nearestIndex(state.boxes, x, y);
    if (next >= 0 && next !== target.value) {
      target.value = next;
      offsets.value = previewOffsets(state.sizes, state.spec, from, next);
    }
  }, [active, drag.moved, drag.tx, drag.ty, dropping, layout, offsets, scroll, scrollStart, target]);

  const lift = useCallback(
    (index: number) => {
      'worklet';
      active.value = index;
      target.value = index;
      offsets.value = [];
      animate.value = true;
      dropping.value = false;
      scrollStart.value = scroll.value;
      scheduleOnRN(onLiftJS, index, scroll.value);
    },
    [active, animate, dropping, offsets, onLiftJS, scroll, scrollStart, target],
  );

  const release = useCallback(
    (moved: boolean) => {
      'worklet';
      const from = active.value;
      if (from < 0) {
        return;
      }
      if (!moved) {
        scheduleOnRN(openMenu, from);
        return;
      }
      const to = target.value;
      const offset = offsets.value[from];
      dropping.value = true;
      drag.lifted.value = withTiming(0, { duration: SETTLE_MS });
      drag.tx.value = withTiming(offset ? offset.x : 0, { duration: SETTLE_MS });
      drag.ty.value = withTiming((offset ? offset.y : 0) - (scroll.value - scrollStart.value), { duration: SETTLE_MS }, () => {
        scheduleOnRN(finish, from, to);
      });
    },
    [active, drag.lifted, drag.tx, drag.ty, dropping, finish, offsets, openMenu, scroll, scrollStart, target],
  );

  const cancel = useCallback(() => {
    'worklet';
    if (active.value >= 0 && !dropping.value) {
      scheduleOnRN(clear);
    }
  }, [active, clear, dropping]);

  frame.current = useFrameCallback(() => {
    const from = active.value;
    const box = layout.value.boxes[from];
    if (from < 0 || !box || dropping.value || !drag.moved.value) {
      return;
    }
    const position = box.y + box.h / 2 - scrollStart.value + drag.ty.value;
    const velocity = edgeVelocity(position, viewH.value, EDGE_SIZE, EDGE_SPEED);
    const max = Math.max(0, contentH.value - viewH.value);
    const next = Math.min(max, Math.max(0, scroll.value + velocity));
    if (velocity !== 0 && next !== scroll.value) {
      scrollTo(listRef, 0, next, false);
      change();
    }
  }, false);

  const onScroll = useAnimatedScrollHandler(event => {
    scroll.value = event.contentOffset.y;
  });

  const grid = useMemo<GridDrag>(
    () => ({ drag, active, offsets, animate, lift, change, release, cancel }),
    [drag, active, offsets, animate, lift, change, release, cancel],
  );

  return { grid, lifted, busy, listRef, onScroll, viewH, contentH };
}
