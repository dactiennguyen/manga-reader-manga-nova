import type { ReactNode } from 'react';
import { ActivityIndicator, Image, ScrollView, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';

import type { Character, Project } from '../core/model/types';
import { fileUri } from '../core/util/paths';
import { Button } from './Button';
import { Icon, type LucideIcon } from './Icon';
import { IconButton } from './IconButton';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useColor, type ColorToken } from './tokens';

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
    <View className={`flex-1 bg-bg ${className ?? ''}`} style={{ paddingTop: top ? insets.top : 0 }}>
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
      {!hideBack && <IconButton icon={ArrowLeft} onPress={onBack} accessibilityLabel="Go back" />}
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

export function Badge({ text, tone = 'accent' }: { text: string; tone?: 'accent' | 'ai' | 'danger' | 'success' | 'warning' }) {
  const box = { accent: 'bg-accent/15', ai: 'bg-ai/15', danger: 'bg-danger/15', success: 'bg-success/15', warning: 'bg-warning/15' };
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${box[tone]}`}>
      <Text variant="caption" tone={tone}>
        {text}
      </Text>
    </View>
  );
}

export function Tag({ label, icon, className }: { label: string; icon?: LucideIcon; className?: string }) {
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-sm bg-overlay px-2 py-1 ${className ?? ''}`}>
      {!!icon && <Icon icon={icon} size={14} color="text-secondary" />}
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

export function Banner({
  text,
  tone = 'info',
  action,
  icon,
}: {
  text: string;
  tone?: 'warning' | 'info' | 'danger' | 'success';
  action?: { label: string; onPress: () => void };
  icon?: LucideIcon;
}) {
  const look = {
    info: { box: 'bg-accent/15', text: 'accent', icon: 'accent' },
    warning: { box: 'bg-warning/15', text: 'warning', icon: 'warning' },
    danger: { box: 'bg-danger/15', text: 'danger', icon: 'danger' },
    success: { box: 'bg-success/15', text: 'success', icon: 'success' },
  } as const;
  return (
    <View className={`flex-row items-center gap-2 rounded-md p-3 ${look[tone].box}`}>
      {!!icon && <Icon icon={icon} size={18} color={look[tone].icon} />}
      <Text variant="bodySmall" tone={look[tone].text} className="flex-1">
        {text}
      </Text>
      {!!action && <Button title={action.label} variant="ghost" small onPress={action.onPress} />}
    </View>
  );
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
  icon?: LucideIcon;
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
      {chevron && <Icon icon={ChevronRight} color="text-muted" size={18} />}
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

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-3 px-6 py-12">
      {!!icon && <Icon icon={icon} size={40} color="text-muted" strokeWidth={1.5} />}
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      {!!message && (
        <Text variant="bodySmall" tone="secondary" className="text-center">
          {message}
        </Text>
      )}
      {!!action && <Button title={action.label} onPress={action.onPress} className="mt-2" />}
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const color = useColor('accent');
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6" accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={color} />
      {!!label && (
        <Text variant="bodySmall" tone="secondary">
          {label}
        </Text>
      )}
    </View>
  );
}

export function Skeleton({ className, ...props }: ViewProps & { className?: string }) {
  return <View {...props} className={`rounded-md bg-overlay ${className ?? ''}`} />;
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ai' | 'success' }) {
  const fill = { accent: 'bg-accent', ai: 'bg-ai', success: 'bg-success' };
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      className="h-1.5 overflow-hidden rounded-full bg-overlay"
    >
      <View className={`h-full rounded-full ${fill[tone]}`} style={{ width: `${pct}%` }} />
    </View>
  );
}

export function Fab({
  icon,
  label,
  onPress,
  bottom = 16,
}: {
  icon: LucideIcon;
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
      style={{ bottom, boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}
    >
      <Icon icon={icon} color="on-accent" />
      <Text variant="label" tone="onAccent">
        {label}
      </Text>
    </Pressable>
  );
}

export function Cover({
  project,
  width,
  children,
  className,
}: {
  project: Pick<Project, 'title' | 'coverUri'>;
  width: number;
  children?: ReactNode;
  className?: string;
}) {
  const height = Math.round(width * 1.4);
  return (
    <View className={`items-center justify-center overflow-hidden rounded-md bg-overlay ${className ?? ''}`} style={{ width, height }}>
      {project.coverUri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: fileUri(project.coverUri) }}
          className="absolute inset-0"
          style={{ width, height }}
        />
      ) : (
        <Text variant="heading" tone="muted" className="p-2 text-center" numberOfLines={3}>
          {project.title.trim().slice(0, 1).toUpperCase() || '?'}
        </Text>
      )}
      {children}
    </View>
  );
}

export function Avatar({
  character,
  size = 44,
  square,
}: {
  character: Pick<Character, 'name' | 'sheet'> | null | undefined;
  size?: number;
  square?: boolean;
}) {
  const uri = character?.sheet?.face;
  return (
    <View
      className={`items-center justify-center overflow-hidden bg-overlay ${square ? 'rounded-md' : 'rounded-full'}`}
      style={{ width: size, height: size }}
    >
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: fileUri(uri) }}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text variant="label" tone="secondary">
          {character?.name.trim().slice(0, 1).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}
