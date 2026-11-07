import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Icon, type IconGlyph } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ICON } from './tokens';

export function Chip({
  label,
  selected,
  onPress,
  onLongPress,
  icon,
  count,
  className,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  icon?: IconGlyph;
  count?: number;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected: !!selected }}
      hitSlop={6}
      onPress={onPress}
      onLongPress={onLongPress}
      className={`h-9 flex-row items-center gap-1.5 overflow-hidden rounded-sm px-3 ${
        selected ? 'bg-accent' : 'bg-overlay'
      } ${className ?? ''}`}
    >
      {!!icon && <Icon icon={icon} size={ICON.sm} color={selected ? 'on-accent' : 'text-secondary'} weight={selected ? 'fill' : 'regular'} />}
      <Text variant="label" tone={selected ? 'onAccent' : 'secondary'} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined && (
        <Text variant="caption" tone={selected ? 'onAccent' : 'muted'}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={`items-center gap-2 py-1.5 ${className ?? ''}`}
    >
      {children}
    </ScrollView>
  );
}

export function ChipGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={`flex-row flex-wrap gap-2 py-1.5 ${className ?? ''}`}>{children}</View>;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" className="h-12 flex-row gap-1 rounded-md bg-overlay p-1">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center overflow-hidden rounded-sm ${selected ? 'bg-raised' : ''}`}
          >
            <Text variant="label" tone={selected ? 'text' : 'secondary'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  right,
  stretch,
}: {
  tabs: readonly { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
  right?: ReactNode;
  stretch?: boolean;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row items-center">
      {tabs.map(tab => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge}` : tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            className={`h-12 flex-row items-center justify-center gap-1.5 border-b-2 ${
              selected ? 'border-accent' : 'border-transparent'
            } ${stretch ? 'flex-1 px-1' : 'px-3'}`}
          >
            <Text variant="label" tone={selected ? 'accent' : 'secondary'} numberOfLines={1}>
              {tab.label}
            </Text>
            {!!tab.badge && (
              <Text variant="caption" tone="muted">
                {tab.badge}
              </Text>
            )}
          </Pressable>
        );
      })}
      {!!right && <View className="ml-auto">{right}</View>}
    </View>
  );
}
