import { View, useWindowDimensions } from 'react-native';
import { CheckIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { ART_STYLES } from '../../core/model/constants';
import type { ArtStyle } from '../../core/model/types';
import { ICON, Icon, Pressable, Text } from '../../ui';
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
            accessibilityLabel={`${t(item.label)}, ${t(item.hint)}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.id)}
            className={`grow overflow-hidden rounded-lg ${wide ? 'w-[30%]' : 'w-[47%]'} ${
              selected ? 'bg-accent/15' : 'bg-surface'
            }`}
          >
            <StyleSample style={item.id} />
            <View className="gap-0.5 p-2">
              <Text variant="label" tone={selected ? 'accent' : 'text'}>
                {t(item.label)}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {t(item.hint)}
              </Text>
            </View>
            {selected && (
              <View className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-accent">
                <Icon icon={CheckIcon} size={ICON.xs} color="on-accent" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
