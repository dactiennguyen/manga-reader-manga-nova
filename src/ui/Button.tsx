import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconGlyph } from './Icon';
import { Pressable } from './Pressable';
import { Text, type TextTone } from './Text';
import { ICON, type ColorToken, useColor } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';

const LOOK: Record<ButtonVariant, { box: string; tone: TextTone; icon: ColorToken }> = {
  primary: { box: 'bg-accent', tone: 'onAccent', icon: 'on-accent' },
  secondary: { box: 'bg-overlay', tone: 'text', icon: 'text' },
  ghost: { box: 'bg-transparent', tone: 'accent', icon: 'accent' },
  danger: { box: 'bg-danger/15', tone: 'danger', icon: 'danger' },
  ai: { box: 'bg-ai', tone: 'onAi', icon: 'on-ai' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  className,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconGlyph;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const look = LOOK[variant];
  const spinner = useColor(look.icon);
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={small ? 6 : undefined}
      style={style}
      className={`flex-row items-center justify-center gap-2 overflow-hidden rounded-md px-4 ${
        small ? 'h-9' : 'h-12'
      } ${look.box} ${className ?? ''}`}
    >
      {loading ? <ActivityIndicator size="small" color={spinner} /> : icon ? <Icon icon={icon} color={look.icon} size={ICON.md} /> : null}
      <View className="shrink">
        <Text variant="label" tone={look.tone} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}
