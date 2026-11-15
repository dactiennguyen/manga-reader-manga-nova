import { Image, View } from 'react-native';

import { fileUri } from '../../core/util/paths';
import { ICON, Icon } from '../../ui';
import { RefBoardIcon } from '../../ui/icons';

function Tile({ path }: { path: string }) {
  return (
    <View className="flex-1 overflow-hidden bg-overlay">
      <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(path) }} className="h-full w-full" resizeMode="cover" />
    </View>
  );
}

/** Up to four pinned pictures as the board's cover, with a hairline of the card between them. */
export function BoardCollage({ paths, width, height }: { paths: string[]; width: number; height: number }) {
  const [a, b, c, d] = paths;
  const box = { width, height };
  if (!a) {
    return (
      <View className="items-center justify-center bg-overlay" style={box}>
        <Icon icon={RefBoardIcon} size={ICON.xl} color="text-muted" weight="duotone" />
      </View>
    );
  }
  if (!b) {
    return (
      <View style={box}>
        <Tile path={a} />
      </View>
    );
  }
  return (
    <View className="flex-row gap-0.5" style={box}>
      <View className="flex-1 gap-0.5">
        <Tile path={a} />
        {d ? <Tile path={c} /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Tile path={b} />
        {d ? <Tile path={d} /> : c ? <Tile path={c} /> : null}
      </View>
    </View>
  );
}
