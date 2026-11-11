import { Image, View } from 'react-native';

import { castMember } from '../../../core/studio/cast';
import type { CastId } from '../../../core/studio/types';
import { READER_ART } from '../../../ui/studioArt';

/** A round printed portrait of the editor or a reading club member, labelled with their name. */
export function CastAvatar({ id, size = 44 }: { id: CastId; size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={castMember(id).name}
      className="overflow-hidden rounded-full bg-paper"
      style={{ width: size, height: size }}
    >
      <Image accessibilityIgnoresInvertColors source={READER_ART[id]} style={{ width: size, height: size }} />
    </View>
  );
}
