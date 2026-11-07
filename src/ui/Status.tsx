import { ActivityIndicator, Image, View, type ImageSourcePropType, type ViewProps } from 'react-native';

import { Button } from './Button';
import { Icon, type IconGlyph } from './Icon';
import { Text } from './Text';
import { ICON, useColor } from './tokens';

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

export function Tag({ label, icon, className }: { label: string; icon?: IconGlyph; className?: string }) {
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-sm bg-overlay px-2 py-1 ${className ?? ''}`}>
      {!!icon && <Icon icon={icon} size={ICON.xs} color="text-secondary" />}
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
  icon?: IconGlyph;
}) {
  const look = {
    info: { box: 'bg-accent/15', text: 'accent', icon: 'accent' },
    warning: { box: 'bg-warning/15', text: 'warning', icon: 'warning' },
    danger: { box: 'bg-danger/15', text: 'danger', icon: 'danger' },
    success: { box: 'bg-success/15', text: 'success', icon: 'success' },
  } as const;
  return (
    <View className={`flex-row items-center gap-2 rounded-md p-3 ${look[tone].box}`}>
      {!!icon && <Icon icon={icon} size={ICON.md} color={look[tone].icon} />}
      <Text variant="bodySmall" tone={look[tone].text} className="flex-1">
        {text}
      </Text>
      {!!action && <Button title={action.label} variant="ghost" small onPress={action.onPress} />}
    </View>
  );
}

export function EmptyState({
  icon,
  art,
  title,
  message,
  action,
}: {
  icon?: IconGlyph;
  /** Printed artwork. Takes the place of the icon. */
  art?: ImageSourcePropType;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-3 px-6 py-12">
      {!!art && <Image accessibilityIgnoresInvertColors source={art} className="mb-1 h-44 w-44 rounded-xl" />}
      {!art && !!icon && (
        <View className="mb-1 h-16 w-16 items-center justify-center rounded-full bg-accent/15">
          <Icon icon={icon} size={ICON.xl} color="accent" weight="duotone" />
        </View>
      )}
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
