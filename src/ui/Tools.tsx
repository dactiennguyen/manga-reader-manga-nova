import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';

import { Icon, type LucideIcon } from './Icon';
import { IconButton } from './IconButton';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { DOCK_GAP, DOCK_HEIGHT } from './tokens';

const PANEL_SHADOW = '0 6px 20px rgba(0,0,0,0.35)';

export type DockItem = { key: string; label: string; icon: LucideIcon; selected: boolean; onPress: () => void };

export function useDockInset(): number {
  const { width } = useWindowDimensions();
  return width >= 600 ? 0 : DOCK_HEIGHT + DOCK_GAP * 2;
}

/** The floating tab bar. At 600dp and wider it becomes a rail on the left. */
export function Dock({ items, onCreate }: { items: DockItem[]; onCreate: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rail = width >= 600;
  const middle = Math.ceil(items.length / 2);
  const tab = (item: DockItem) => (
    <Pressable
      key={item.key}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.selected }}
      onPress={item.onPress}
      className={`h-12 min-w-12 flex-1 items-center justify-center gap-0.5 overflow-hidden rounded-md ${
        item.selected ? 'bg-accent/15' : ''
      }`}
    >
      <Icon icon={item.icon} size={22} color={item.selected ? 'accent' : 'text-muted'} />
      <Text variant="caption" tone={item.selected ? 'accent' : 'muted'} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {item.label}
      </Text>
    </Pressable>
  );
  const create = (
    <Pressable
      key="create"
      accessibilityLabel="New story"
      hapticOnPress
      onPress={onCreate}
      className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-accent"
    >
      <Icon icon={Plus} size={24} color="on-accent" />
    </Pressable>
  );
  if (rail) {
    return (
      <View
        accessibilityRole="tablist"
        className="absolute bottom-0 left-0 top-0 w-20 items-center gap-2 bg-raised px-2"
        style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
      >
        {create}
        {items.map(tab)}
      </View>
    );
  }
  return (
    <View
      accessibilityRole="tablist"
      className="absolute left-4 right-4 flex-row items-center gap-1 rounded-xl bg-raised px-2"
      style={{ bottom: insets.bottom + DOCK_GAP, height: DOCK_HEIGHT, boxShadow: PANEL_SHADOW }}
    >
      {items.slice(0, middle).map(tab)}
      {create}
      {items.slice(middle).map(tab)}
    </View>
  );
}

export type ToolItem = { key: string; label: string; icon: LucideIcon; selected?: boolean; onPress: () => void; onLongPress?: () => void };

export function ToolRail({ items, side = 'left', top = 72 }: { items: ToolItem[]; side?: 'left' | 'right'; top?: number }) {
  return (
    <View
      className={`absolute gap-1 rounded-lg bg-raised p-1 ${side === 'left' ? 'left-2' : 'right-2'}`}
      style={{ top, boxShadow: PANEL_SHADOW }}
    >
      {items.map(item => (
        <IconButton
          key={item.key}
          icon={item.icon}
          active={item.selected}
          onPress={item.onPress}
          onLongPress={item.onLongPress}
          accessibilityLabel={item.label}
        />
      ))}
    </View>
  );
}

export function ToolPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={`gap-2 rounded-xl bg-raised p-3 ${className ?? ''}`} style={{ boxShadow: PANEL_SHADOW }}>
      {children}
    </View>
  );
}

export function ModeSwitch<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="h-12 flex-row gap-1 rounded-md bg-raised p-1">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`flex-row items-center justify-center gap-1.5 overflow-hidden rounded-sm px-3 ${selected ? 'bg-accent' : ''}`}
          >
            {!!option.icon && <Icon icon={option.icon} size={16} color={selected ? 'on-accent' : 'text-secondary'} />}
            <Text variant="label" tone={selected ? 'onAccent' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
