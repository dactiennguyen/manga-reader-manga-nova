import { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MinusIcon, PlusIcon } from './icons';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { ICON } from './tokens';

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  label = 'Value',
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  label?: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <IconButton icon={MinusIcon} size={ICON.md} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} accessibilityLabel={`Decrease ${label}`} />
      <Text variant="mono" className="min-w-10 text-center">
        {format ? format(value) : value}
      </Text>
      <IconButton icon={PlusIcon} size={ICON.md} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} accessibilityLabel={`Increase ${label}`} />
    </View>
  );
}

const THUMB = 22;

export function Slider({
  value,
  min,
  max,
  step = 0,
  onChange,
  onComplete,
  disabled,
  label = 'Value',
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  onComplete?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const width = useSharedValue(0);
  const ratio = useSharedValue((value - min) / (max - min || 1));
  const dragging = useSharedValue(false);
  useEffect(() => {
    if (!dragging.get()) {
      ratio.set((value - min) / (max - min || 1));
    }
  }, [dragging, max, min, ratio, value]);

  const emit = (next: number, done: boolean) => {
    onChange?.(next);
    if (done) {
      onComplete?.(next);
    }
  };

  const seek = (x: number, done: boolean) => {
    'worklet';
    const raw = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, width.value - THUMB)));
    const exact = min + raw * (max - min);
    const snapped = step > 0 ? Math.round(exact / step) * step : exact;
    const next = Math.min(max, Math.max(min, snapped));
    ratio.value = (next - min) / (max - min || 1);
    scheduleOnRN(emit, next, done);
  };

  // Seeking starts on activation, so a vertical scroll that passes over the slider changes nothing.
  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: event => {
      'worklet';
      dragging.value = true;
      seek(event.x, false);
    },
    onUpdate: event => {
      'worklet';
      seek(event.x, false);
    },
    onDeactivate: event => {
      'worklet';
      dragging.value = false;
      seek(event.x, true);
    },
  });
  const tap = useTapGesture({
    enabled: !disabled,
    onDeactivate: event => {
      'worklet';
      seek(event.x, true);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: ratio.value * Math.max(0, width.value - THUMB) }] }));
  const fill = useAnimatedStyle(() => ({ width: THUMB / 2 + ratio.value * Math.max(0, width.value - THUMB) }));
  const nudge = step > 0 ? step : (max - min) / 20;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        const delta = event.nativeEvent.actionName === 'increment' ? nudge : -nudge;
        emit(Math.min(max, Math.max(min, value + delta)), true);
      }}
      onLayout={(event: LayoutChangeEvent) => width.set(event.nativeEvent.layout.width)}
      className={`h-12 ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
    >
      <GestureDetector gesture={gesture}>
        <View className="h-12 w-full justify-center">
          <View className="h-1 rounded-full bg-overlay" />
          <Animated.View className="absolute h-1 rounded-full bg-accent" style={fill} />
          <Animated.View className="absolute h-[22px] w-[22px] rounded-full bg-accent" style={thumb} />
        </View>
      </GestureDetector>
    </View>
  );
}
