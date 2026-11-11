import { useEffect, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION } from '../../../ui/tokens';

const PERSPECTIVE = 1200;

export type CardViewRef = ComponentRef<typeof View>;

const FACE = { backfaceVisibility: 'hidden' } as const;

/**
 * Two faces of one card, turned around the vertical axis. Each face also hides itself past the halfway
 * point, so it works where backface culling does not. With reduced motion the faces swap at once.
 */
export function FlipCard({
  front,
  back,
  flipped,
  width,
  frontRef,
}: {
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  width: number;
  /** The front face, for snapshots. */
  frontRef?: RefObject<CardViewRef | null>;
}) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(flipped ? 1 : 0);

  useEffect(() => {
    turn.set(reduced ? (flipped ? 1 : 0) : withTiming(flipped ? 1 : 0, { duration: MOTION.slow * 2, easing: Easing.inOut(Easing.cubic) }));
  }, [flipped, reduced, turn]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: turn.get() < 0.5 ? 1 : 0,
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${turn.get() * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: turn.get() >= 0.5 ? 1 : 0,
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${turn.get() * 180 - 180}deg` }],
  }));

  return (
    <View style={{ width }}>
      <Animated.View
        style={[FACE, frontStyle]}
        pointerEvents={flipped ? 'none' : 'auto'}
        importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={flipped}
      >
        <View ref={frontRef} collapsable={false}>
          {front}
        </View>
      </Animated.View>
      <Animated.View
        style={[FACE, backStyle]}
        className="absolute inset-0"
        pointerEvents={flipped ? 'auto' : 'none'}
        importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!flipped}
      >
        {back}
      </Animated.View>
    </View>
  );
}
