import { useMemo } from 'react';
import { View } from 'react-native';

import type { BrushPreset } from '../../core/art/brushes';
import type { SetContents } from '../../core/art/presetSets';
import { toneFromPreset, type TonePreset } from '../../core/art/tone';
import { Icon } from '../../ui';
import { BrushIcon, CheckIcon } from '../../ui/icons';
import { ICON } from '../../ui/tokens';
import { BrushThumb, ToneThumb } from '../canvas/presetThumbs';

export const BRUSH_THUMB_W = 96;
export const BRUSH_THUMB_H = 40;
export const TONE_THUMB = 40;
const COVER_W = 80;
const COVER_H = 48;
/** The tone's strip when a cover shows both. */
const COVER_TONE_W = 28;

export function TonePreview({ preset, width = TONE_THUMB, height = TONE_THUMB }: { preset: TonePreset; width?: number; height?: number }) {
  const tone = useMemo(() => toneFromPreset(preset, { x: 0, y: 0, w: width, h: height }), [preset, width, height]);
  return <ToneThumb tone={tone} width={width} height={height} />;
}

export function BrushPreview({ preset }: { preset: BrushPreset }) {
  return <BrushThumb base={preset.base} preset={preset} width={BRUSH_THUMB_W} height={BRUSH_THUMB_H} />;
}

/**
 * A set's picture in a list: its first tone beside its first brush stroke, so a glance tells "Inking" from
 * "Backgrounds". An empty set shows a brush icon on paper.
 */
export function SetCover({ contents }: { contents: SetContents }) {
  const brush = contents.brushes[0];
  const tone = contents.tones[0];
  if (!brush && !tone) {
    return (
      <View className="items-center justify-center rounded-sm bg-overlay" style={{ width: COVER_W, height: COVER_H }}>
        <Icon icon={BrushIcon} size={ICON.lg} color="text-muted" />
      </View>
    );
  }
  return (
    <View className="flex-row overflow-hidden rounded-sm bg-paper" style={{ width: COVER_W, height: COVER_H }}>
      {tone && <TonePreview preset={tone} width={brush ? COVER_TONE_W : COVER_W} height={COVER_H} />}
      {brush && <BrushThumb base={brush.base} preset={brush} width={tone ? COVER_W - COVER_TONE_W : COVER_W} height={COVER_H} />}
    </View>
  );
}

/** A tick box drawn like the shared Checkbox, for rows that carry a picture next to it. */
export function TickBox({ checked }: { checked: boolean }) {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-sm border ${checked ? 'border-accent bg-accent' : 'border-control-border'}`}
    >
      {checked && <Icon icon={CheckIcon} size={ICON.sm} color="on-accent" />}
    </View>
  );
}
