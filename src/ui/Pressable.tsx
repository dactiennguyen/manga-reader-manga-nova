import { Pressable as RNPressable, type PressableProps as RNPressableProps } from 'react-native';

import { haptic } from './haptics';
import { useColor } from './tokens';

export type PressableProps = RNPressableProps & { className?: string; hapticOnPress?: boolean };

export function Pressable({ onPress, hapticOnPress, className, accessibilityRole, ...props }: PressableProps) {
  const ripple = useColor('overlay');
  return (
    <RNPressable
      accessibilityRole={accessibilityRole ?? 'button'}
      android_ripple={{ color: ripple }}
      {...props}
      className={`active:opacity-80 disabled:opacity-40 ${className ?? ''}`}
      onPress={
        onPress
          ? event => {
              if (hapticOnPress) {
                haptic();
              }
              onPress(event);
            }
          : undefined
      }
    />
  );
}
