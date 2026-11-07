import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type LucideIcon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ICON, type ColorToken } from './tokens';

export function IconButton({
  icon,
  onPress,
  onLongPress,
  size = ICON.lg,
  color = 'text',
  badge,
  disabled,
  active,
  accessibilityLabel,
  className,
  style,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number;
  color?: ColorToken;
  badge?: string | number;
  disabled?: boolean;
  active?: boolean;
  /** Required: an icon alone says nothing to a screen reader. */
  accessibilityLabel: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={style}
      className={`h-12 w-12 items-center justify-center overflow-hidden rounded-md ${active ? 'bg-accent/15' : ''} ${
        className ?? ''
      }`}
    >
      <Icon icon={icon} size={size} color={active ? 'accent' : color} />
      {badge !== undefined && (
        <View className="absolute right-1 top-1 h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1">
          <Text variant="caption" tone="onAccent">
            {badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
