import { memo, useMemo, type RefObject } from 'react';
import { View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  useExclusiveGestures,
  useLongPressGesture,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

type Pan = { x: number; y: number; translationX: number; translationY: number };

type Point = { x: number; y: number };

export type PanelGestureHandlers = {
  panStart: (event: Pan) => void;
  panMove: (event: Pan) => void;
  panEnd: (event: Pan) => void;
  panFinish: () => void;
  pinchStart: () => void;
  pinchMove: (scale: number) => void;
  twoFingerStart: () => void;
  twoFingerMove: (translationX: number, translationY: number) => void;
  tap: (x: number, y: number) => void;
  doubleTap: (x: number, y: number) => void;
  hold: (x: number, y: number) => void;
};

/**
 * The gesture tree is built once. This layer holds no state and its only prop is a ref, so it never
 * re-renders: composed gestures are rebuilt on every render of the component that owns them, and the
 * screen above re-renders on every frame of a drag. Touches reach the latest screen state through the ref.
 */
export const PanelGestureLayer = memo(function GestureLayer({ live }: { live: RefObject<PanelGestureHandlers> }) {
  const configs = useMemo(
    () => ({
      pan: {
        runOnJS: true,
        maxPointers: 1,
        onActivate: (event: Pan) => live.current.panStart(event),
        onUpdate: (event: Pan) => live.current.panMove(event),
        onDeactivate: (event: Pan & { canceled: boolean }) => {
          if (!event.canceled) {
            live.current.panEnd(event);
          }
        },
        onFinalize: () => live.current.panFinish(),
      },
      pinch: {
        runOnJS: true,
        onActivate: () => live.current.pinchStart(),
        onUpdate: (event: { scale: number }) => live.current.pinchMove(event.scale),
      },
      twoFinger: {
        runOnJS: true,
        minPointers: 2,
        onActivate: () => live.current.twoFingerStart(),
        onUpdate: (event: Pan) => live.current.twoFingerMove(event.translationX, event.translationY),
      },
      tap: {
        runOnJS: true,
        onDeactivate: (event: Point & { canceled: boolean }) => {
          if (!event.canceled) {
            live.current.tap(event.x, event.y);
          }
        },
      },
      doubleTap: {
        runOnJS: true,
        numberOfTaps: 2,
        onDeactivate: (event: Point & { canceled: boolean }) => {
          if (!event.canceled) {
            live.current.doubleTap(event.x, event.y);
          }
        },
      },
      hold: {
        runOnJS: true,
        onActivate: (event: Point) => live.current.hold(event.x, event.y),
      },
    }),
    [live],
  );

  const pan = usePanGesture(configs.pan);
  const pinch = usePinchGesture(configs.pinch);
  const twoFinger = usePanGesture(configs.twoFinger);
  const tap = useTapGesture(configs.tap);
  const doubleTap = useTapGesture(configs.doubleTap);
  const hold = useLongPressGesture(configs.hold);
  const taps = useExclusiveGestures(doubleTap, tap);
  const oneFinger = useCompetingGestures(pan, hold, taps);
  const gesture = useSimultaneousGestures(pinch, twoFinger, oneFinger);

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} className="absolute inset-0" />
    </GestureDetector>
  );
});
