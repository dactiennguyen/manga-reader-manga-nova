import { View } from 'react-native';
import { CheckIcon } from './icons';

import { Icon, type IconGlyph } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ICON } from './tokens';

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      className="min-h-12 flex-row items-center gap-3"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-sm border ${
          checked ? 'border-accent bg-accent' : 'border-control-border'
        }`}
      >
        {checked && <Icon icon={CheckIcon} size={ICON.sm} color="on-accent" />}
      </View>
      {!!label && <Text className="flex-1">{label}</Text>}
    </Pressable>
  );
}

export function Radio({
  selected,
  onPress,
  label,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 py-1"
    >
      <View className={`h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-accent' : 'border-control-border'}`}>
        {selected && <View className="h-3 w-3 rounded-full bg-accent" />}
      </View>
      <View className="flex-1">
        <Text>{label}</Text>
        {!!description && (
          <Text variant="bodySmall" tone="muted">
            {description}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function Switch({
  value,
  onValueChange,
  disabled,
  label,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      className={`h-7 w-12 justify-center rounded-full border px-0.5 ${
        value ? 'items-end border-accent bg-accent' : 'items-start border-control-border bg-transparent'
      }`}
    >
      <View className={`h-5 w-5 rounded-full ${value ? 'bg-on-accent' : 'bg-text-muted'}`} />
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: IconGlyph;
  disabled?: boolean;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-2">
      {!!icon && <Icon icon={icon} color="text-secondary" />}
      <View className="flex-1">
        <Text>{title}</Text>
        {!!subtitle && (
          <Text variant="bodySmall" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} label={title} />
    </View>
  );
}
