import { useCallback, useMemo, useRef, useState } from 'react';
import { usePanGesture, usePinchGesture, type NativeGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MOTION } from '../../ui';

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_DOUBLE_TAP = 2.5;

const ZOOMED_AT = 1.01;
const SNAP_BACK_BELOW = 1.05;
const TIMING = { duration: MOTION.base };

// These two run inside the gesture worklets below, so they stay above them.
function clamp(value: number, low: number, high: number): number {
  'worklet';
  return Math.min(high, Math.max(low, value));
}

function travel(content: number, frame: number, scale: number): number {
  'worklet';
  return Math.max(0, (content * scale - frame) / 2);
}

export type ZoomConfig = {
  frameW: number;
  frameH: number;
  contentW: number;
  contentH: number;
  /** Off for a surface something else zooms, such as a webtoon page inside the zooming list. */
  enabled?: boolean;
  lockY?: boolean;
  scrollY?: SharedValue<number>;
  scrollMax?: number;
  onChange?: (zoomed: boolean) => void;
  onPinch?: (active: boolean) => void;
  /** The pager around this surface. A pinch has to run alongside it instead of waiting for it. */
  outer?: NativeGesture;
};

export function useZoom({
  frameW,
  frameH,
  contentW,
  contentH,
  enabled = true,
  lockY,
  scrollY,
  scrollMax = 0,
  onChange,
  onPinch,
  outer,
}: ZoomConfig) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onPinchRef = useRef(onPinch);
  onPinchRef.current = onPinch;
  const notifyPinch = useCallback((value: boolean) => onPinchRef.current?.(value), []);

  const notify = useCallback((value: boolean) => {
    setZoomed(value);
    onChangeRef.current?.(value);
  }, []);

  useAnimatedReaction(
    () => scale.value > ZOOMED_AT,
    (now, before) => {
      if (before !== null && now !== before) {
        scheduleOnRN(notify, now);
      }
    },
  );

  const reset = useCallback(
    (animated = true) => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      scale.value = animated ? withTiming(1, TIMING) : 1;
      tx.value = animated ? withTiming(0, TIMING) : 0;
      ty.value = animated ? withTiming(0, TIMING) : 0;
    },
    [scale, tx, ty],
  );

  const toggleAt = useCallback(
    (x: number, y: number) => {
      if (scale.value > ZOOMED_AT) {
        reset();
        return;
      }
      const next = ZOOM_DOUBLE_TAP;
      const fx = x - frameW / 2;
      const fy = y - frameH / 2;
      const limitX = Math.max(0, (contentW * next - frameW) / 2);
      const limitY = Math.max(0, (contentH * next - frameH) / 2);
      scale.value = withTiming(next, TIMING);
      tx.value = withTiming(Math.min(limitX, Math.max(-limitX, -fx * (next - 1))), TIMING);
      ty.value = withTiming(lockY ? 0 : Math.min(limitY, Math.max(-limitY, -fy * (next - 1))), TIMING);
    },
    [scale, tx, ty, reset, frameW, frameH, contentW, contentH, lockY],
  );

  const pinchConfig = useMemo(
    () => ({
      enabled,
      simultaneousWith: outer,
      onTouchesDown: (e: { numberOfTouches: number }) => {
        'worklet';
        if (e.numberOfTouches >= 2) {
          scheduleOnRN(notifyPinch, true);
        }
      },
      onFinalize: () => {
        'worklet';
        scheduleOnRN(notifyPinch, false);
      },
      onActivate: (e: { focalX: number; focalY: number }) => {
        'worklet';
        cancelAnimation(scale);
        cancelAnimation(tx);
        cancelAnimation(ty);
        startScale.value = scale.value;
        startX.value = tx.value;
        startY.value = ty.value;
        focalX.value = e.focalX - frameW / 2;
        focalY.value = e.focalY - frameH / 2;
      },
      onUpdate: (e: { numberOfPointers: number; scale: number; focalX: number; focalY: number }) => {
        'worklet';
        if (e.numberOfPointers < 2) {
          return;
        }
        const next = clamp(startScale.value * e.scale, ZOOM_MIN, ZOOM_MAX);
        const ratio = next / startScale.value;
        const fx = e.focalX - frameW / 2;
        const fy = e.focalY - frameH / 2;
        const limitX = travel(contentW, frameW, next);
        const limitY = travel(contentH, frameH, next);
        scale.value = next;
        tx.value = clamp(fx - (focalX.value - startX.value) * ratio, -limitX, limitX);
        ty.value = lockY ? 0 : clamp(fy - (focalY.value - startY.value) * ratio, -limitY, limitY);
      },
      onDeactivate: () => {
        'worklet';
        if (scale.value < SNAP_BACK_BELOW) {
          scale.value = withTiming(1, TIMING);
          tx.value = withTiming(0, TIMING);
          ty.value = withTiming(0, TIMING);
        }
      },
    }),
    [
      enabled,
      scale,
      tx,
      ty,
      startScale,
      startX,
      startY,
      focalX,
      focalY,
      frameW,
      frameH,
      contentW,
      contentH,
      lockY,
      notifyPinch,
      outer,
    ],
  );
  const pinch = usePinchGesture(pinchConfig);

  const panConfig = useMemo(
    () => ({
      enabled: enabled && zoomed,
      maxPointers: 1,
      ...(lockY ? { activeOffsetX: [-12, 12] as [number, number], failOffsetY: [-12, 12] as [number, number] } : null),
      onActivate: () => {
        'worklet';
        cancelAnimation(tx);
        cancelAnimation(ty);
        startX.value = tx.value;
        startY.value = ty.value;
      },
      onUpdate: (e: { translationX: number; translationY: number }) => {
        'worklet';
        const limitX = travel(contentW, frameW, scale.value);
        const limitY = travel(contentH, frameH, scale.value);
        tx.value = clamp(startX.value + e.translationX, -limitX, limitX);
        ty.value = lockY ? 0 : clamp(startY.value + e.translationY, -limitY, limitY);
      },
      onDeactivate: (e: { velocityX: number; velocityY: number }) => {
        'worklet';
        const limitX = travel(contentW, frameW, scale.value);
        const limitY = travel(contentH, frameH, scale.value);
        tx.value = withDecay({ velocity: e.velocityX, clamp: [-limitX, limitX] });
        if (!lockY) {
          ty.value = withDecay({ velocity: e.velocityY, clamp: [-limitY, limitY] });
        }
      },
    }),
    [enabled, zoomed, scale, tx, ty, startX, startY, frameW, frameH, contentW, contentH, lockY],
  );
  const pan = usePanGesture(panConfig);

  const style = useAnimatedStyle(() => {
    let y = ty.value;
    if (scrollY) {
      const margin = (frameH * (scale.value - 1)) / (2 * scale.value);
      const top = Math.max(0, scrollY.value);
      const bottom = Math.max(0, scrollMax - top);
      if (top < margin) {
        y = (margin - top) * scale.value;
      } else if (bottom < margin) {
        y = -(margin - bottom) * scale.value;
      }
    }
    return { transform: [{ translateX: tx.value }, { translateY: y }, { scale: scale.value }] };
  });

  const toContent = useCallback(
    (x: number, y: number) => {
      const s = scale.value;
      return {
        x: (x - frameW / 2 - tx.value) / s + contentW / 2,
        y: (y - frameH / 2 - ty.value) / s + contentH / 2,
      };
    },
    [scale, tx, ty, frameW, frameH, contentW, contentH],
  );

  return { pinch, pan, style, zoomed, reset, toggleAt, toContent };
}
