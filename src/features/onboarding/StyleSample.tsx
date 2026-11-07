import { View } from 'react-native';
import { Coffee, Eye, Flame, Heart, Skull, Smile } from 'lucide-react-native';

import type { ArtStyle } from '../../core/model/types';
import { Icon, type LucideIcon } from '../../ui';

const STYLE_ICON: Record<ArtStyle, LucideIcon> = {
  shounen: Flame,
  shoujo: Heart,
  seinen: Eye,
  chibi: Smile,
  horror: Skull,
  slice: Coffee,
};

export function StyleSample({ style, selected }: { style: ArtStyle; selected?: boolean }) {
  return (
    <View className="h-28 items-center justify-center bg-overlay">
      <Icon icon={STYLE_ICON[style]} size={40} strokeWidth={1.5} color={selected ? 'accent' : 'text-secondary'} />
    </View>
  );
}
