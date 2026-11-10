import { CaretDownIcon, CaretUpIcon } from '../../ui/icons';
import { useState, type ReactNode } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TONE_DENSITIES } from '../../core/art/artMath';
import { SIZE_MAX, SIZE_MIN, supportsTone } from '../../core/art/tools';
import { t } from '../../core/i18n';
import { Chip, IconButton, Slider, Text, ToolPanel } from '../../ui';
import { CanvasColorRow } from './CanvasColorRow';
import { CanvasSelectionBar, type SelectionControls } from './CanvasSelectionBar';
import type { CanvasTools } from './useCanvasTools';

function TonePicker({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <View className="flex-row items-center gap-2 pr-2">
      <Chip label={t('Solid')} selected={value === null} onPress={() => onChange(null)} />
      {TONE_DENSITIES.map(density => (
        <Chip
          key={density}
          label={`${Math.round(density * 100)}%`}
          selected={value === density}
          onPress={() => onChange(density)}
        />
      ))}
    </View>
  );
}

function LabeledSlider({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <Text variant="caption" tone="muted" maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      <View className="flex-1">{children}</View>
      <Text variant="mono" style={{ fontVariant: ['tabular-nums'] }} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
    </View>
  );
}

export function CanvasToolPanel({
  tools,
  colored,
  selection,
  fade,
  onPreview,
  onLayout,
}: {
  tools: CanvasTools;
  colored: boolean;
  selection: SelectionControls;
  fade: StyleProp<AnimatedStyle<ViewStyle>>;
  onPreview: (showing: boolean) => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);
  const { tool, tone, size, opacity } = tools;
  const plain = tool === 'move' || tool === 'select';
  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      className="absolute left-2 right-2"
      style={[{ bottom: insets.bottom + 8 }, fade]}
    >
      <ToolPanel>
        <View className="flex-row items-center">
          <View className="flex-1">
            {tool === 'move' ? (
              <Text variant="bodySmall" tone="secondary" className="px-1">
                {t('Drag to move the layer. Pinch or drag a corner handle to scale it.')}
              </Text>
            ) : tool === 'select' ? (
              <CanvasSelectionBar selection={selection} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center">
                {supportsTone(tool) ? <TonePicker value={tone} onChange={tools.setTone} /> : null}
                <CanvasColorRow tools={tools} colored={colored} />
              </ScrollView>
            )}
          </View>
          {tool === 'select' ? null : (
            <IconButton
              icon={open ? CaretDownIcon : CaretUpIcon}
              color="text-muted"
              onPress={() => setOpen(value => !value)}
              accessibilityLabel={open ? t('Collapse tool panel') : t('Expand tool panel')}
            />
          )}
        </View>
        {open && !plain ? (
          <View className="flex-row gap-3">
            {tool === 'fill' ? null : (
              <LabeledSlider label={t('Size')} value={`${Math.round(size)}`}>
                <Slider
                  label={t('Size')}
                  value={size}
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  onChange={value => {
                    onPreview(true);
                    tools.setSize(value);
                  }}
                  onComplete={() => onPreview(false)}
                />
              </LabeledSlider>
            )}
            <LabeledSlider label={t('Opacity')} value={`${Math.round(opacity * 100)}%`}>
              <Slider label={t('Opacity')} value={opacity} min={0.05} max={1} onChange={tools.setOpacity} />
            </LabeledSlider>
          </View>
        ) : null}
      </ToolPanel>
    </Animated.View>
  );
}
