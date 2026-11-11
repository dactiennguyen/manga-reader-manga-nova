import { Skia, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { FONT_FAMILY } from '../core/lettering/fonts';
import type { BubbleFont } from '../core/model/types';

export { FONT_FAMILY, FONT_LABEL } from '../core/lettering/fonts';

const SOURCES: Record<BubbleFont, number> = {
  hand: require('../assets/fonts/PatrickHand-Regular.ttf'),
  sans: require('../assets/fonts/BeVietnamPro-Regular.ttf'),
  sansBold: require('../assets/fonts/BeVietnamPro-Bold.ttf'),
  display: require('../assets/fonts/Anton-Regular.ttf'),
  comic: require('../assets/fonts/Bangers-Regular.ttf'),
  casual: require('../assets/fonts/Mali-Medium.ttf'),
  rounded: require('../assets/fonts/MPLUSRounded1c-Medium.ttf'),
  marker: require('../assets/fonts/YuseiMagic-Regular.ttf'),
  heavy: require('../assets/fonts/DelaGothicOne-Regular.ttf'),
  bubbly: require('../assets/fonts/Jua-Regular.ttf'),
  playful: require('../assets/fonts/ZCOOLKuaiLe-Regular.ttf'),
  soft: require('../assets/fonts/Huninn-Regular.ttf'),
};

let provider: SkTypefaceFontProvider | null = null;
let loading: Promise<SkTypefaceFontProvider> | null = null;

export function getFonts(): SkTypefaceFontProvider | null {
  return provider;
}

export function loadFonts(): Promise<SkTypefaceFontProvider> {
  if (provider) {
    return Promise.resolve(provider);
  }
  if (!loading) {
    loading = (async () => {
      const manager = Skia.TypefaceFontProvider.Make();
      await Promise.all(
        (Object.keys(SOURCES) as BubbleFont[]).map(async font => {
          try {
            const uri = Image.resolveAssetSource(SOURCES[font])?.uri;
            if (!uri) {
              return;
            }
            const data = await Skia.Data.fromURI(uri);
            const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
            if (typeface) {
              manager.registerFont(typeface, FONT_FAMILY[font]);
            }
          } catch {}
        }),
      );
      provider = manager;
      return manager;
    })();
  }
  return loading;
}

export function useEngineFonts(): SkTypefaceFontProvider | null {
  const [fonts, setFonts] = useState<SkTypefaceFontProvider | null>(provider);
  useEffect(() => {
    let alive = true;
    if (!fonts) {
      loadFonts().then(loaded => {
        if (alive) {
          setFonts(loaded);
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [fonts]);
  return fonts;
}
