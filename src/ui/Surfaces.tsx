import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CaretRightIcon } from './icons';

import { Icon, type IconGlyph } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ICON, type ColorToken } from './tokens';

export function Card({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  className,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const box = `overflow-hidden rounded-lg bg-surface ${className ?? ''}`;
  if (!onPress && !onLongPress) {
    return (
      <View className={box} style={style}>
        {children}
      </View>
    );
  }
  return (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} onLongPress={onLongPress} className={box} style={style}>
      {children}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View className="h-px bg-divider" style={{ marginLeft: inset }} />;
}

export function SectionHeader({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View className="min-h-8 flex-row items-center justify-between gap-2">
      <Text variant="heading" accessibilityRole="header" className="flex-1">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Section({
  title,
  footer,
  children,
  className,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {!!title && <SectionHeader>{title}</SectionHeader>}
      <View className="overflow-hidden rounded-lg bg-surface">{children}</View>
      {!!footer && (
        <Text variant="caption" tone="muted">
          {footer}
        </Text>
      )}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconColor = 'text-secondary',
  left,
  right,
  onPress,
  onLongPress,
  destructive,
  chevron,
  selected,
  titleLines = 1,
  disabled,
}: {
  title: string;
  subtitle?: string;
  icon?: IconGlyph;
  iconColor?: ColorToken;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  selected?: boolean;
  titleLines?: number;
  disabled?: boolean;
}) {
  const content = (
    <>
      {left}
      {!!icon && <Icon icon={icon} color={destructive ? 'danger' : iconColor} />}
      <View className="flex-1">
        <Text tone={destructive ? 'danger' : 'text'} numberOfLines={titleLines}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="bodySmall" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {chevron && <Icon icon={CaretRightIcon} color="text-muted" size={ICON.md} />}
    </>
  );
  const box = `min-h-14 flex-row items-center gap-3 px-4 py-2 ${selected ? 'bg-accent/15' : ''}`;
  if (!onPress && !onLongPress) {
    return <View className={box}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      className={box}
    >
      {content}
    </Pressable>
  );
}
