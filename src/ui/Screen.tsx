import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from './icons';

import { Icon, type IconGlyph } from './Icon';
import { IconButton } from './IconButton';
import { Pressable } from './Pressable';
import { FAB_SHADOW } from './shadows';
import { Text } from './Text';

export function Screen({
  children,
  scroll,
  keyboard,
  padded = true,
  top = true,
  bottom = true,
  className,
  contentClassName,
  bottomInset = 0,
}: {
  children: ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  padded?: boolean;
  top?: boolean;
  bottom?: boolean;
  className?: string;
  contentClassName?: string;
  /** Extra space, for example the height of the dock. */
  bottomInset?: number;
}) {
  const insets = useSafeAreaInsets();
  const pad = padded ? 'px-4 md:px-6' : '';
  const paddingTop = top ? insets.top : 0;
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={`${pad} gap-4 ${contentClassName ?? ''}`}
      contentContainerStyle={{ paddingBottom: bottomInset + 16 + (bottom ? insets.bottom : 0) }}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      className={`flex-1 ${pad} ${contentClassName ?? ''}`}
      style={{ paddingBottom: bottomInset + (bottom ? insets.bottom : 0) }}
    >
      {children}
    </View>
  );
  return (
    <View className={`flex-1 bg-bg ${className ?? ''}`} style={{ paddingTop }}>
      {keyboard ? (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

export function AppBar({
  title,
  subtitle,
  onBack,
  hideBack,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  hideBack?: boolean;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-1 px-1">
      {!hideBack && <IconButton icon={BackIcon} onPress={onBack} accessibilityLabel="Go back" />}
      <View className={`flex-1 ${hideBack ? 'px-3' : ''}`}>
        {children ?? (
          <>
            {!!title && (
              <Text variant="title" numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </>
        )}
      </View>
      {right}
    </View>
  );
}

export function Fab({
  icon,
  label,
  onPress,
  bottom = 16,
}: {
  icon: IconGlyph;
  label: string;
  onPress: () => void;
  bottom?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hapticOnPress
      className="absolute right-4 h-14 flex-row items-center gap-2 overflow-hidden rounded-lg bg-accent px-4"
      style={{ bottom, boxShadow: FAB_SHADOW }}
    >
      <Icon icon={icon} color="on-accent" />
      <Text variant="label" tone="onAccent">
        {label}
      </Text>
    </Pressable>
  );
}
