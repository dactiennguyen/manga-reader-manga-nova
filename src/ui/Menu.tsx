import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable as RNPressable, View, useWindowDimensions } from 'react-native';
import { CaretDownIcon, CheckIcon } from './icons';

import { Icon, type IconGlyph } from './Icon';
import { Pressable } from './Pressable';
import { POPOVER_SHADOW } from './shadows';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { ICON } from './tokens';

export type MenuItem = {
  label: string;
  icon?: IconGlyph;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  subtitle?: string;
};

export function Menu({
  visible,
  onClose,
  title,
  subtitle,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: (MenuItem | false | null | undefined)[];
}) {
  const chosen = useRef<MenuItem | null>(null);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      onClosed={() => {
        const item = chosen.current;
        chosen.current = null;
        item?.onPress();
      }}
    >
      {items.filter(Boolean).map(item => {
        const entry = item as MenuItem;
        return (
          <Pressable
            key={entry.label}
            accessibilityRole="menuitem"
            accessibilityLabel={entry.label}
            accessibilityState={{ disabled: !!entry.disabled }}
            disabled={entry.disabled}
            onPress={() => {
              chosen.current = entry;
              onClose();
            }}
            className="min-h-14 flex-row items-center gap-3 px-4 py-2"
          >
            {!!entry.icon && <Icon icon={entry.icon} color={entry.destructive ? 'danger' : 'text-secondary'} />}
            <View className="flex-1">
              <Text tone={entry.destructive ? 'danger' : 'text'}>{entry.label}</Text>
              {!!entry.subtitle && (
                <Text variant="bodySmall" tone="muted">
                  {entry.subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);
  const current = options.find(option => option.value === value);
  const open = () =>
    anchor.current?.measureInWindow((x, y, width, height) =>
      setMenu({ top: y + height + 4, right: Math.max(8, screenWidth - (x + width)) }),
    );
  return (
    <View ref={anchor} collapsable={false}>
      <Pressable
        accessibilityLabel={`${accessibilityLabel}: ${current?.label ?? ''}`}
        accessibilityState={{ expanded: !!menu }}
        onPress={open}
        className="h-12 flex-row items-center gap-1 rounded-sm px-2"
      >
        <Text variant="label">{current?.label}</Text>
        <Icon icon={CaretDownIcon} size={ICON.sm} color="text-secondary" />
      </Pressable>
      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)} statusBarTranslucent>
        <RNPressable accessibilityLabel="Close" className="flex-1" onPress={() => setMenu(null)}>
          <View
            className="absolute min-w-40 overflow-hidden rounded-md bg-overlay py-1"
            style={{ top: menu?.top ?? 0, right: menu?.right ?? 0, boxShadow: POPOVER_SHADOW }}
          >
            {options.map(option => (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.value === value }}
                onPress={() => {
                  setMenu(null);
                  onChange(option.value);
                }}
                className="h-12 flex-row items-center justify-between gap-3 px-4"
              >
                <Text variant="label">{option.label}</Text>
                {option.value === value && <Icon icon={CheckIcon} size={ICON.sm} color="accent" />}
              </Pressable>
            ))}
          </View>
        </RNPressable>
      </Modal>
    </View>
  );
}
