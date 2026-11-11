/**
 * The winner's ink burst: blots of the two print inks (coral and paper ink) thrown out from the middle,
 * a little off-register like a riso print. With reduced motion the blots are simply there.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColor } from '../../../ui';

const BLOTS = 16;
const BURST_MS = 900;

type Blot = { angle: number; distance: number; w: number; h: number; turn: number; delay: number; ink: 0 | 1 };

/** Fixed, uneven blots: the same burst every time, like a printed plate. */
function blots(): Blot[] {
  return Array.from({ length: BLOTS }, (_, i) => {
    const wobble = Math.sin(i * 12.9898) * 0.5 + 0.5;
    return {
      angle: (i / BLOTS) * Math.PI * 2 + wobble * 0.6,
      distance: 58 + wobble * 62,
      w: 8 + ((i * 7) % 11),
      h: 6 + ((i * 5) % 9),
      turn: (i * 37) % 180,
      delay: (i % 5) * 40,
      ink: i % 3 === 0 ? 1 : 0,
    };
  });
}

function BlotView({ blot, progress, color }: { blot: Blot; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : 0.9,
      transform: [
        { translateX: Math.cos(blot.angle) * blot.distance * p },
        { translateY: Math.sin(blot.angle) * blot.distance * p },
        { rotate: `${blot.turn}deg` },
        { scale: 0.4 + 0.6 * p },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute"
      style={[{ width: blot.w, height: blot.h, borderRadius: blot.w, backgroundColor: color }, style]}
    />
  );
}

export function InkBurst({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const coral = useColor('accent');
  const ink = useColor('on-paper');
  const items = useMemo(blots, []);
  const first = useSharedValue(reduced ? 1 : 0);
  const second = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      first.value = 1;
      second.value = 1;
      return;
    }
    const ease = Easing.out(Easing.cubic);
    first.value = withTiming(1, { duration: BURST_MS, easing: ease });
    // The second ink lands a moment later and slightly off, as a second pass through the press would.
    second.value = withDelay(120, withTiming(1, { duration: BURST_MS, easing: ease }));
  }, [first, reduced, second]);

  return (
    <View className="items-center justify-center overflow-hidden rounded-lg bg-paper py-10" accessibilityRole="none">
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        {items.map((blot, i) => (
          <BlotView key={i} blot={blot} progress={blot.ink ? second : first} color={blot.ink ? ink : coral} />
        ))}
      </View>
      {children}
    </View>
  );
}
