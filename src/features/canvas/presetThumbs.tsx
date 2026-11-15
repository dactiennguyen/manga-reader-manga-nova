import { Canvas, Picture } from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import type { BrushBase, BrushPreset } from '../../core/art/brushes';
import { DEFAULT_OPACITY, DEFAULT_SIZES } from '../../core/art/tools';
import type { StrokeTone } from '../../core/model/types';
import { sampleFill, sampleStroke } from '../../state/useArtPresets';
import { drawStroke, recordPicture } from '../../render/drawArt';
import { INK } from '../../render/ink';
import { Slider, Text } from '../../ui';

/**
 * Previews drawn with the canvas's own stroke code, on the page's paper, so what a preset shows is what
 * it draws. One dp is one page unit, the scale a page has when it fills a phone about twice over.
 */

/** A brush preview. Size is capped to the box, so a wide brush still shows its shape. */
export function BrushThumb({
  base,
  preset,
  width,
  height,
}: {
  base: BrushBase;
  preset?: BrushPreset;
  width: number;
  height: number;
}) {
  const picture = useMemo(() => {
    const box = { x: 0, y: 0, w: width, h: height };
    const size = Math.min(preset ? preset.size : DEFAULT_SIZES[base], height * 0.3);
    const stroke = sampleStroke(base, box, INK, size, preset ? preset.opacity : DEFAULT_OPACITY[base], preset?.brush);
    return recordPicture(canvas => drawStroke(canvas, stroke));
  }, [base, height, preset, width]);
  return (
    <View className="overflow-hidden rounded-sm bg-paper" style={{ width, height }}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

export function ToneThumb({ tone, width, height }: { tone: StrokeTone | null; width: number; height: number }) {
  const picture = useMemo(() => {
    const stroke = sampleFill({ x: 0, y: 0, w: width, h: height }, INK, tone);
    // Solid shows as a light wash so it reads as "no pattern" rather than a black block.
    return recordPicture(canvas => drawStroke(canvas, tone ? stroke : { ...stroke, opacity: 0.18 }));
  }, [height, tone, width]);
  return (
    <View className="overflow-hidden rounded-sm bg-paper" style={{ width, height }}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

/** A labelled slider with its value, for the preset editors. */
export function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <Text variant="mono" style={{ fontVariant: ['tabular-nums'] }} maxFontSizeMultiplier={1.3}>
          {format(value)}
        </Text>
      </View>
      <Slider label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
    </View>
  );
}

export function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const oneDecimal = (value: number) => `${Math.round(value * 10) / 10}`;
