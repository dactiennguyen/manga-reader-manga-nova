import type { ReactNode } from 'react';
import { View } from 'react-native';
import { DoneIcon } from '../../ui/icons';

import { Icon, Pressable, Text } from '../../ui';

/** One choice in a radio group of cards. */
export function OptionCard({
  label,
  hint,
  selected,
  onPress,
  left,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  left: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}, ${hint}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-14 flex-row items-center gap-3 overflow-hidden rounded-lg p-4 ${
        selected ? 'bg-accent/15' : 'bg-surface'
      }`}
    >
      {left}
      <View className="flex-1">
        <Text variant="heading">{label}</Text>
        <Text variant="bodySmall" tone="secondary">
          {hint}
        </Text>
      </View>
      {selected && <Icon icon={DoneIcon} size={22} color="accent" />}
    </Pressable>
  );
}
