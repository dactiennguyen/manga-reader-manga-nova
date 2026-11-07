import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { BoldIcon, CircleIcon, DeleteIcon, DoneIcon, PenLineIcon, UserIcon } from '../../ui/icons';

import { clampFontSize } from '../../core/lettering/bubbleEdit';
import { SFX_STYLES } from '../../core/lettering/bubbles';
import { hasTranslation, translationOf } from '../../core/lettering/translation';
import { BUBBLE_TYPE_LABEL, EFFECT_LABEL } from '../../core/model/constants';
import type { Bubble, BubbleFont, BubbleType, Effect, EffectType } from '../../core/model/types';
import { FONT_LABEL } from '../../render/fonts';
import { Chip, Icon, IconButton, Pressable, Segmented, Slider, Stepper, Text, ToolPanel } from '../../ui';

const SPEECH_TYPES: BubbleType[] = ['speak', 'think', 'shout', 'whisper', 'machine'];
const FONTS = Object.keys(FONT_LABEL) as BubbleFont[];
const EFFECT_TYPES = Object.keys(EFFECT_LABEL) as EffectType[];
const NARRATION_STYLES: { value: NonNullable<Bubble['narrationStyle']>; label: string }[] = [
  { value: 'box', label: 'Border' },
  { value: 'inverse', label: 'Black' },
  { value: 'plain', label: 'No border' },
];
const OUTLINE_COLORS: { value: NonNullable<Bubble['outlineColor']>; label: string }[] = [
  { value: 'white', label: 'White outline' },
  { value: 'black', label: 'Black outline' },
];

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View className="min-h-12 flex-row items-center gap-2">
      {!!label && (
        <Text variant="caption" tone="secondary" className="w-14">
          {label}
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 pr-2">
        {children}
      </ScrollView>
    </View>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  text,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  text: string;
  onChange: (value: number) => void;
}) {
  return (
    <View className="min-h-12 flex-row items-center gap-2">
      <Text variant="caption" tone="secondary" className="w-14">
        {label}
      </Text>
      <Slider label={label} value={value} min={min} max={max} step={step} onChange={onChange} className="flex-1" />
      <Text variant="mono" className="min-w-10 text-center">
        {text}
      </Text>
    </View>
  );
}

export function BubbleCard({
  bubble,
  speaker,
  lang,
  onChange,
  onEdit,
  onDelete,
  onToggleTail,
  onPickSpeaker,
}: {
  bubble: Bubble;
  speaker?: string;
  lang?: string | null;
  onChange: (patch: Partial<Bubble>, tag?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleTail: () => void;
  onPickSpeaker: () => void;
}) {
  const sfx = bubble.type === 'sfx';
  const narration = bubble.type === 'narration';
  const speech = !sfx && !narration;
  const translated = hasTranslation(bubble, lang);
  const skew = Math.round((bubble.skew ?? SFX_STYLES[bubble.sfxStyle ?? 0]?.skew ?? 0) * 100);
  return (
    <ToolPanel className="gap-0 py-1">
      <View className="flex-row items-center gap-1">
        <Text variant="label" numberOfLines={1} className="flex-1">
          {BUBBLE_TYPE_LABEL[bubble.type]}
        </Text>
        <Stepper
          label="font size"
          value={bubble.fontSize}
          min={clampFontSize(bubble.type, 0)}
          max={clampFontSize(bubble.type, Infinity)}
          step={2}
          format={value => `${Math.round(value)}`}
          onChange={fontSize => onChange({ fontSize }, 'size')}
        />
        {!sfx && (
          <IconButton
            icon={BoldIcon}
            size={18}
            active={bubble.bold}
            onPress={() => onChange({ bold: !bubble.bold })}
            accessibilityLabel="Bold"
          />
        )}
        <IconButton icon={PenLineIcon} size={18} onPress={onEdit} accessibilityLabel="Edit text" />
        <IconButton icon={DeleteIcon} size={18} color="danger" onPress={onDelete} accessibilityLabel="Delete" />
      </View>
      {!!lang && (
        <Pressable
          accessibilityLabel={translated ? `Edit ${lang} text` : `Add ${lang} text`}
          onPress={onEdit}
          className="min-h-12 flex-row items-center gap-2"
        >
          <Icon icon={translated ? DoneIcon : CircleIcon} size={14} color={translated ? 'success' : 'warning'} />
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
            {translated ? `${lang}: ${translationOf(bubble, lang)}` : `No ${lang} text yet · showing the original`}
          </Text>
        </Pressable>
      )}
      {speech && (
        <Row label="Style">
          {SPEECH_TYPES.map(type => (
            <Chip
              key={type}
              label={BUBBLE_TYPE_LABEL[type]}
              selected={bubble.type === type}
              onPress={() => onChange({ type, bold: type === 'shout' ? true : bubble.bold })}
            />
          ))}
        </Row>
      )}
      {narration && (
        <Row label="Box">
          {NARRATION_STYLES.map(style => (
            <Chip
              key={style.value}
              label={style.label}
              selected={(bubble.narrationStyle ?? 'box') === style.value}
              onPress={() => onChange({ narrationStyle: style.value })}
            />
          ))}
        </Row>
      )}
      {sfx ? (
        <>
          <Row label="Style">
            {SFX_STYLES.map((style, index) => (
              <Chip
                key={style.label}
                label={style.label}
                selected={(bubble.sfxStyle ?? 0) === index}
                onPress={() => onChange({ sfxStyle: index, skew: style.skew })}
              />
            ))}
          </Row>
          <SliderRow
            label="Rotate"
            value={Math.round(bubble.rotation)}
            min={-180}
            max={180}
            step={1}
            text={`${Math.round(bubble.rotation)}°`}
            onChange={rotation => onChange({ rotation }, 'rotation')}
          />
          <SliderRow
            label="Skew"
            value={skew}
            min={-60}
            max={60}
            step={5}
            text={`${skew}`}
            onChange={value => onChange({ skew: value / 100 }, 'skew')}
          />
          <SliderRow
            label="Outline"
            value={bubble.outline ?? 0}
            min={0}
            max={16}
            step={1}
            text={`${bubble.outline ?? 0}`}
            onChange={outline => onChange({ outline }, 'outline')}
          />
          <View className="py-1">
            <Segmented
              options={OUTLINE_COLORS}
              value={bubble.outlineColor ?? 'white'}
              onChange={outlineColor => onChange({ outlineColor })}
            />
          </View>
        </>
      ) : (
        <Row label="Font">
          {FONTS.map(key => (
            <Chip key={key} label={FONT_LABEL[key]} selected={bubble.font === key} onPress={() => onChange({ font: key })} />
          ))}
        </Row>
      )}
      {speech && (
        <Row>
          <Chip label="Tail" selected={!!bubble.tail} onPress={onToggleTail} />
          <Chip label={speaker ?? 'Speaker'} icon={UserIcon} selected={!!speaker} onPress={onPickSpeaker} />
        </Row>
      )}
    </ToolPanel>
  );
}

export function EffectCard({
  effect,
  panelNumber,
  onChange,
  onDelete,
}: {
  effect: Effect;
  panelNumber: number;
  onChange: (patch: Partial<Effect>, tag?: string) => void;
  onDelete: () => void;
}) {
  const angled = effect.type === 'speed' || effect.type === 'gradient';
  return (
    <ToolPanel className="gap-0 py-1">
      <View className="flex-row items-center gap-1">
        <Text variant="label" className="flex-1">{`Effect · Panel ${panelNumber}`}</Text>
        <IconButton icon={DeleteIcon} size={18} color="danger" onPress={onDelete} accessibilityLabel="Delete effect" />
      </View>
      <Row label="Type">
        {EFFECT_TYPES.map(type => (
          <Chip key={type} label={EFFECT_LABEL[type]} selected={effect.type === type} onPress={() => onChange({ type })} />
        ))}
      </Row>
      <SliderRow
        label="Density"
        value={Math.round(effect.density * 100)}
        min={0}
        max={100}
        step={5}
        text={`${Math.round(effect.density * 100)}%`}
        onChange={value => onChange({ density: value / 100 }, 'density')}
      />
      {angled && (
        <SliderRow
          label="Angle"
          value={Math.round(effect.angle)}
          min={0}
          max={345}
          step={15}
          text={`${Math.round(effect.angle)}°`}
          onChange={angle => onChange({ angle }, 'angle')}
        />
      )}
      <SliderRow
        label="Opacity"
        value={Math.round(effect.opacity * 100)}
        min={10}
        max={100}
        step={5}
        text={`${Math.round(effect.opacity * 100)}%`}
        onChange={value => onChange({ opacity: value / 100 }, 'opacity')}
      />
      {effect.type === 'focus' && (
        <Text variant="caption" tone="secondary" className="py-1">
          Drag the dot inside the panel to set the center.
        </Text>
      )}
    </ToolPanel>
  );
}
