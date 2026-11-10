import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { Image, PixelRatio, View } from 'react-native';

import { LOCALE_NAME, getLocale, t } from '../../core/i18n';
import { FONT_LABEL, FONT_NAME, FONT_SCRIPTS, fontsFor, type FontScript } from '../../core/lettering/fonts';
import type { BubbleFont } from '../../core/model/types';
import { Pressable, Text, useColor } from '../../ui';
import { fontSample, usePreview } from './previewImages';

const SAMPLE_SIZE = 17;
/** Tall faces are scaled down so the name and the line under it both fit the 48dp chip. */
const SAMPLE_MAX_H = 24;
// Language codes, the same in every interface language. Screen readers get the full names.
const SCRIPT_TAG: Record<FontScript, string> = { vi: 'VI', ja: 'JA' };

function FontChip({
  font,
  selected,
  fonts,
  onPress,
}: {
  font: BubbleFont;
  selected: boolean;
  fonts: SkTypefaceFontProvider | null;
  onPress: () => void;
}) {
  const ink = useColor(selected ? 'on-accent' : 'text');
  const ratio = Math.min(3, PixelRatio.get());
  const sample = usePreview(fonts ? `font:${font}:${ratio}` : null, () => (fonts ? fontSample(font, fonts, SAMPLE_SIZE, ratio) : null));
  const scripts = FONT_SCRIPTS[font];
  const fit = sample ? Math.min(1, SAMPLE_MAX_H / sample.height) : 1;
  const tone = selected ? 'onAccent' : 'secondary';
  return (
    <Pressable
      accessibilityLabel={[FONT_NAME[font], t(FONT_LABEL[font]), ...scripts.map(script => LOCALE_NAME[script])].join(', ')}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`h-12 justify-center overflow-hidden rounded-sm px-3 ${selected ? 'bg-accent' : 'bg-overlay'}`}
    >
      {sample ? (
        <Image
          accessible={false}
          source={{ uri: sample.uri }}
          style={{ width: sample.width * fit, height: sample.height * fit, tintColor: ink }}
        />
      ) : (
        <Text variant="label" tone={tone} numberOfLines={1}>
          {FONT_NAME[font]}
        </Text>
      )}
      <View className="flex-row items-center gap-1.5">
        <Text variant="caption" tone={tone} numberOfLines={1}>
          {t(FONT_LABEL[font])}
        </Text>
        {scripts.map(script => (
          <View key={script} className={`rounded-sm border px-1 ${selected ? 'border-on-accent' : 'border-control-border'}`}>
            <Text variant="caption" tone={tone}>
              {SCRIPT_TAG[script]}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/** One chip per lettering font: its name set in the font, what it is for, and the scripts it covers. */
export function FontChoices({
  value,
  fonts,
  onChange,
}: {
  value: BubbleFont;
  fonts: SkTypefaceFontProvider | null;
  onChange: (font: BubbleFont) => void;
}) {
  return (
    <>
      {fontsFor(getLocale()).map(font => (
        <FontChip key={font} font={font} selected={value === font} fonts={fonts} onPress={() => onChange(font)} />
      ))}
    </>
  );
}
