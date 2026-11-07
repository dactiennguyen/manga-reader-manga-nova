import { Image, View } from 'react-native';

import { ART } from '../../ui';

export type WelcomeArtKind = 'write' | 'draw' | 'finish';

const SOURCE = { write: ART.welcomeWrite, draw: ART.welcomeDraw, finish: ART.welcomeFinish };

export function WelcomeArt({ kind }: { kind: WelcomeArtKind }) {
  return (
    <View className="min-h-[200px] flex-1 overflow-hidden rounded-xl bg-paper">
      <Image accessibilityIgnoresInvertColors source={SOURCE[kind]} resizeMode="cover" className="h-full w-full" />
    </View>
  );
}
