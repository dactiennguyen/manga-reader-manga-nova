import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Image, PixelRatio, View, useWindowDimensions } from 'react-native';

import { getLocale, t } from '../../core/i18n';
import { BUBBLE_PRESETS, SFX_GROUPS, SFX_PRESETS, presetBubble, type LetteringPreset } from '../../core/lettering/presets';
import { bubbleMeasure } from '../../render/drawBubble';
import { Pressable, Sheet, Tabs, Text } from '../../ui';
import { bubbleThumb, usePreview } from './previewImages';
import type { LetteringController } from './useLetteringController';

// One place for the grid sizes: the tiles and the pictures drawn for them both read these.
const SHEET_MAX_W = 560;
const SIDE = 16;
const GAP = 8;
const COLUMNS = 3;
const THUMB_H = 64;
const THUMB_INSET = 4;
/** Room for any preset at its full size, so a thumbnail shows it unshrunk. */
const PREVIEW_BOX = { x: 0, y: 0, w: 1000, h: 1000 };

type PresetTab = 'bubbles' | 'sfx';

function PresetTile({
  preset,
  width,
  fonts,
  onPress,
}: {
  preset: LetteringPreset;
  width: number;
  fonts: SkTypefaceFontProvider | null;
  onPress: () => void;
}) {
  const text = t(preset.text);
  const name = t(preset.label);
  const ratio = Math.min(3, PixelRatio.get());
  const preview = usePreview(fonts ? `preset:${preset.id}:${getLocale()}:${width}:${ratio}` : null, () =>
    fonts
      ? bubbleThumb(
          presetBubble(preset, text, PREVIEW_BOX, { id: `preset-${preset.id}`, measure: bubbleMeasure(fonts) }),
          fonts,
          width - THUMB_INSET * 2,
          THUMB_H - THUMB_INSET * 2,
          ratio,
        )
      : null,
  );
  return (
    <Pressable accessibilityLabel={t('Add the {name} preset', { name })} onPress={onPress} className="gap-1 pb-1" style={{ width }}>
      <View className="items-center justify-center overflow-hidden rounded-md bg-white" style={{ width, height: THUMB_H }}>
        {preview ? (
          <Image accessible={false} source={{ uri: preview.uri }} style={{ width: preview.width, height: preview.height }} />
        ) : (
          <Text variant="label" tone="onPaper" numberOfLines={2} className="px-1 text-center">
            {text}
          </Text>
        )}
      </View>
      {preset.type !== 'sfx' && (
        <Text variant="caption" tone="secondary" numberOfLines={1} className="text-center">
          {name}
        </Text>
      )}
    </Pressable>
  );
}

function PresetGrid({
  presets,
  width,
  fonts,
  onPick,
}: {
  presets: LetteringPreset[];
  width: number;
  fonts: SkTypefaceFontProvider | null;
  onPick: (preset: LetteringPreset) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: GAP }}>
      {presets.map(preset => (
        <PresetTile key={preset.id} preset={preset} width={width} fonts={fonts} onPress={() => onPick(preset)} />
      ))}
    </View>
  );
}

export function PresetSheet({ c }: { c: LetteringController }) {
  const { state, dispatch, fonts } = c;
  const [tab, setTab] = useState<PresetTab>('bubbles');
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, SHEET_MAX_W) - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  return (
    <Sheet
      visible={state.sheet === 'presets'}
      onClose={() => dispatch({ type: 'closeSheet' })}
      title={t('Presets')}
      subtitle={
        c.presetPanelId
          ? t('Tap one to add it to panel {n}', { n: c.panelNumber(c.presetPanelId) })
          : t('Tap one to add it to the page')
      }
    >
      <View className="gap-3 pb-2" style={{ paddingHorizontal: SIDE }}>
        <Tabs
          stretch
          tabs={[
            { key: 'bubbles', label: t('Bubbles') },
            { key: 'sfx', label: t('Sound effects') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'bubbles' ? (
          <PresetGrid presets={BUBBLE_PRESETS} width={tile} fonts={fonts} onPick={c.addPreset} />
        ) : (
          SFX_GROUPS.map(group => (
            <View key={group.key} className="gap-2">
              <Text variant="label" tone="secondary" accessibilityRole="header">
                {t(group.label)}
              </Text>
              <PresetGrid
                presets={SFX_PRESETS.filter(preset => preset.group === group.key)}
                width={tile}
                fonts={fonts}
                onPick={c.addPreset}
              />
            </View>
          ))
        )}
      </View>
    </Sheet>
  );
}
