import { Image, View } from 'react-native';

import type { ArtStyle } from '../../core/model/types';
import { STYLE_ART } from '../../ui';

export function StyleSample({ style }: { style: ArtStyle }) {
  return (
    <View className="h-44 bg-paper">
      <Image accessibilityIgnoresInvertColors source={STYLE_ART[style]} resizeMode="cover" className="h-full w-full" />
    </View>
  );
}
