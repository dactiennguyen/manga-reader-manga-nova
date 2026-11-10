import { CaretDownIcon, CaretUpIcon } from '../../ui/icons';
import { useState, type ReactNode } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TONE_DENSITIES } from '../../core/art/artMath';
import { SIZE_MAX, SIZE_MIN, supportsTone } from '../../core/art/tools';
import { t } from '../../core/i18n';
import { Chip, IconButton, Pressable, Slider, Text, ToolPanel } from '../../ui';
import type { CanvasTools } from './useCanvasTools';

function Swatch({ color, selected, onPick }: { color: string; selected: boolean; onPick: (color: string) => void }) {
  return (
    <Pressable
      onPress={() => onPick(color)}
      accessibilityLabel={t('Color {color}', { color })}
      accessibilityState={{ selected }}
      className="h-12 w-12 items-center justify-center"
    >
      <View
        className={`h-7 w-7 rounded-full ${selected ? 'border-2 border-accent' : 'border border-control-border'}`}
        style={{ backgroundColor: color }}
      />
    </Pressable>
  );
}

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
  fade,
  onPreview,
  onLayout,
}: {
  tools: CanvasTools;
  colored: boolean;
  fade: StyleProp<AnimatedStyle<ViewStyle>>;
  onPreview: (showing: boolean) => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);
  const { tool, color, tone, size, opacity, palette, recent } = tools;
  const recentShown = colored ? recent : [];
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
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center">
                {supportsTone(tool) ? <TonePicker value={tone} onChange={tools.setTone} /> : null}
                {recentShown.map(item => (
                  <Swatch key={`r-${item}`} color={item} selected={item === color} onPick={tools.setColor} />
                ))}
                {recentShown.length ? <View className="mx-1 h-6 w-0.5 bg-divider" /> : null}
                {palette.map(item => (
                  <Swatch key={item} color={item} selected={item === color} onPick={tools.setColor} />
                ))}
              </ScrollView>
            )}
          </View>
          <IconButton
            icon={open ? CaretDownIcon : CaretUpIcon}
            color="text-muted"
            onPress={() => setOpen(value => !value)}
            accessibilityLabel={open ? t('Collapse tool panel') : t('Expand tool panel')}
          />
        </View>
        {open && tool !== 'move' ? (
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
