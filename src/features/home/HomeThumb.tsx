import { Image, View } from 'react-native';

import type { ID } from '../../core/model/types';
import { useThumb } from '../../render/thumbs';
import { Skeleton } from '../../ui';

/**
 * A page as the saved thumbnail image, the same one the storyboard shows. Home stays a list of plain images
 * this way, with no Skia canvas per page.
 */
export function HomeThumb({ pageId, width, height }: { pageId: ID; width: number; height: number }) {
  const uri = useThumb(pageId);
  return (
    <View className="overflow-hidden rounded-sm bg-white" style={{ width, height }}>
      {uri ? (
        <Image accessibilityIgnoresInvertColors source={{ uri }} style={{ width, height }} resizeMode="cover" resizeMethod="resize" />
      ) : (
        <Skeleton className="flex-1" />
      )}
    </View>
  );
}
