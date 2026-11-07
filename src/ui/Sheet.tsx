import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable as RNPressable, ScrollView, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ModalShownContext, useModalShown } from './modalShown';
import { Text } from './Text';
import { MOTION } from './tokens';

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;

export function Sheet({
  visible,
  onClose,
  onClosed,
  title,
  subtitle,
  right,
  children,
  scroll = true,
  maxHeight = '85%',
}: {
  visible: boolean;
  onClose: () => void;
  /** Runs after the closing animation, so the next sheet or focus change can start safely. */
  onClosed?: () => void;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  maxHeight?: `${number}%` | number;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [shown, onShow] = useModalShown(mounted);
  const height = useSharedValue(600);
  const offset = useSharedValue(600);
  const scrim = useSharedValue(0);
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;

  const finish = () => {
    setMounted(false);
    closedRef.current?.();
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      offset.set(reduced ? 0 : withSpring(0, { damping: 28, stiffness: 280 }));
      scrim.set(withTiming(1, { duration: reduced ? 0 : MOTION.base }));
    } else if (mounted) {
      scrim.set(withTiming(0, { duration: reduced ? 0 : MOTION.fast }));
      offset.set(
        withTiming(height.get(), { duration: reduced ? 0 : MOTION.fast, easing: Easing.in(Easing.cubic) }, done => {
          if (done) {
            scheduleOnRN(finish);
          }
        }),
      );
    }
    // Only the visible flag drives the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const drag = usePanGesture({
    onUpdate: event => {
      'worklet';
      offset.value = Math.max(0, event.translationY);
    },
    onDeactivate: event => {
      'worklet';
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        offset.value = withSpring(0, { damping: 28, stiffness: 280 });
      }
    },
  });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: scrim.value }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView className="flex-1">
        <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
          <Animated.View className="absolute inset-0 bg-scrim" style={backdrop}>
            <RNPressable accessibilityLabel="Close" className="flex-1" onPress={onClose} />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            onLayout={event => height.set(event.nativeEvent.layout.height)}
            className="w-full max-w-[560px] self-center rounded-t-xl bg-raised pt-2"
            style={[panel, { maxHeight, paddingBottom: insets.bottom + 12 }]}
          >
            <GestureDetector gesture={drag}>
              <View accessibilityRole="adjustable" accessibilityLabel="Drag down to close" className="h-6 items-center justify-center">
                <View className="h-1 w-10 rounded-full bg-control-border" />
              </View>
            </GestureDetector>
            {(!!title || !!right) && (
              <View className="flex-row items-center gap-2 px-4 pb-2">
                <View className="flex-1">
                  {!!title && (
                    <Text variant="title" accessibilityRole="header">
                      {title}
                    </Text>
                  )}
                  {!!subtitle && (
                    <Text variant="caption" tone="muted">
                      {subtitle}
                    </Text>
                  )}
                </View>
                {right}
              </View>
            )}
            <ModalShownContext.Provider value={shown}>
              {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}
            </ModalShownContext.Provider>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
