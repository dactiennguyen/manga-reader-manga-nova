import { memo, useMemo, type RefObject } from 'react';
import { View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  useLongPressGesture,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

const DRAG_START = 4;
const TAP_MS = 280;
const HOLD_MS = 450;

type Point = { x: number; y: number };

export type LetteringGestureHandlers = {
  begin: (x: number, y: number) => void;
  start: () => void;
  move: (translationX: number, translationY: number) => void;
  end: (success: boolean) => void;
  tap: (x: number, y: number) => void;
  hold: (x: number, y: number) => void;
  pinchStart: (focalX: number, focalY: number) => void;
  pinchMove: (factor: number, focalX: number, focalY: number) => void;
};

/** Holds no state and takes only a ref, so it never re-renders and the gesture tree is built once. */
export const LetteringGestureLayer = memo(function GestureLayer({
  live,
}: {
  live: RefObject<LetteringGestureHandlers>;
}) {
  const configs = useMemo(
    () => ({
      pan: {
        runOnJS: true,
        maxPointers: 1,
        minDistance: DRAG_START,
        onBegin: (event: Point) => live.current.begin(event.x, event.y),
        onActivate: () => live.current.start(),
        onUpdate: (event: { translationX: number; translationY: number }) =>
          live.current.move(event.translationX, event.translationY),
        onDeactivate: (event: { canceled: boolean }) => live.current.end(!event.canceled),
        onFinalize: (event: { canceled: boolean }) => {
          if (event.canceled) {
            live.current.end(false);
          }
        },
      },
      tap: {
        runOnJS: true,
        maxDuration: TAP_MS,
        onDeactivate: (event: Point & { canceled: boolean }) => {
          if (!event.canceled) {
            live.current.tap(event.x, event.y);
          }
        },
      },
      hold: {
        runOnJS: true,
        minDuration: HOLD_MS,
        onActivate: (event: Point) => live.current.hold(event.x, event.y),
      },
      zoom: {
        runOnJS: true,
        onActivate: (event: { focalX: number; focalY: number }) => live.current.pinchStart(event.focalX, event.focalY),
        onUpdate: (event: { scale: number; focalX: number; focalY: number }) =>
          live.current.pinchMove(event.scale, event.focalX, event.focalY),
      },
    }),
    [live],
  );

  const pan = usePanGesture(configs.pan);
  const tap = useTapGesture(configs.tap);
  const hold = useLongPressGesture(configs.hold);
  const zoom = usePinchGesture(configs.zoom);
  const touch = useCompetingGestures(pan, hold, tap);
  const gesture = useSimultaneousGestures(zoom, touch);

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} className="absolute inset-0" />
    </GestureDetector>
  );
});
