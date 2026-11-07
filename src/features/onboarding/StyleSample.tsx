import { View } from 'react-native';
import { ChibiIcon, HorrorIcon, PreviewIcon, ShoujoIcon, ShounenIcon, SliceOfLifeIcon } from '../../ui/icons';

import type { ArtStyle } from '../../core/model/types';
import { Icon, type IconGlyph } from '../../ui';

const STYLE_ICON: Record<ArtStyle, IconGlyph> = {
  shounen: ShounenIcon,
  shoujo: ShoujoIcon,
  seinen: PreviewIcon,
  chibi: ChibiIcon,
  horror: HorrorIcon,
  slice: SliceOfLifeIcon,
};

export function StyleSample({ style, selected }: { style: ArtStyle; selected?: boolean }) {
  return (
    <View className="h-28 items-center justify-center bg-overlay">
      <Icon icon={STYLE_ICON[style]} size={40} color={selected ? 'accent' : 'text-secondary'} />
    </View>
  );
}
