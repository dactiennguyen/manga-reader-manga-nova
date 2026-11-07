import { View, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';

import { ART_STYLES } from '../../core/model/constants';
import type { ArtStyle } from '../../core/model/types';
import { Icon, Pressable, Text } from '../../ui';
import { StyleSample } from './StyleSample';

export function StylePicker({ value, onChange }: { value: ArtStyle; onChange: (style: ArtStyle) => void }) {
  const wide = useWindowDimensions().width >= 600;
  return (
    <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
      {ART_STYLES.map(item => {
        const selected = item.id === value;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityLabel={`${item.label}, ${item.hint}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.id)}
            className={`grow overflow-hidden rounded-lg ${wide ? 'w-[30%]' : 'w-[47%]'} ${
              selected ? 'bg-accent/15' : 'bg-surface'
            }`}
          >
            <StyleSample style={item.id} selected={selected} />
            <View className="gap-0.5 p-2">
              <Text variant="label" tone={selected ? 'accent' : 'text'}>
                {item.label}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {item.hint}
              </Text>
            </View>
            {selected && (
              <View className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-accent">
                <Icon icon={Check} size={14} color="on-accent" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
