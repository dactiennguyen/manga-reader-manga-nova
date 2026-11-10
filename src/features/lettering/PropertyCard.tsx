import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { BoldIcon, CircleIcon, DeleteIcon, DoneIcon, PenLineIcon, UserIcon } from '../../ui/icons';

import { msg, t } from '../../core/i18n';
import { clampFontSize } from '../../core/lettering/bubbleEdit';
import { SFX_STYLES } from '../../core/lettering/bubbles';
import { hasTranslation, translationOf } from '../../core/lettering/translation';
import { BUBBLE_TYPE_LABEL, EFFECT_LABEL } from '../../core/model/constants';
import type { Bubble, BubbleType, Effect, EffectType } from '../../core/model/types';
import { Chip, ICON, Icon, IconButton, Pressable, Segmented, Slider, Stepper, Text, ToolPanel } from '../../ui';
import { FontChoices } from './FontPicker';

const SPEECH_TYPES: BubbleType[] = ['speak', 'think', 'shout', 'whisper', 'machine'];
const EFFECT_TYPES = Object.keys(EFFECT_LABEL) as EffectType[];
const NARRATION_STYLES: { value: NonNullable<Bubble['narrationStyle']>; label: string }[] = [
  { value: 'box', label: msg('Border') },
  { value: 'inverse', label: msg('Black') },
  { value: 'plain', label: msg('No border') },
];
const OUTLINE_COLORS: { value: NonNullable<Bubble['outlineColor']>; label: string }[] = [
  { value: 'white', label: msg('White outline') },
  { value: 'black', label: msg('Black outline') },
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
  fonts,
  onChange,
  onEdit,
  onDelete,
  onToggleTail,
  onPickSpeaker,
}: {
  bubble: Bubble;
  speaker?: string;
  lang?: string | null;
  fonts?: SkTypefaceFontProvider | null;
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
        <Text variant="caption" tone="secondary" numberOfLines={1} className="min-w-14 flex-1">
          {t(BUBBLE_TYPE_LABEL[bubble.type])}
        </Text>
        <Stepper
          label={t('font size')}
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
            size={ICON.md}
            active={bubble.bold}
            onPress={() => onChange({ bold: !bubble.bold })}
            accessibilityLabel={t('Bold')}
          />
        )}
        <IconButton icon={PenLineIcon} size={ICON.md} onPress={onEdit} accessibilityLabel={t('Edit text')} />
        <IconButton icon={DeleteIcon} size={ICON.md} color="danger" onPress={onDelete} accessibilityLabel={t('Delete')} />
      </View>
      {!!lang && (
        <Pressable
          accessibilityLabel={translated ? t('Edit {lang} text', { lang }) : t('Add {lang} text', { lang })}
          onPress={onEdit}
          className="min-h-12 flex-row items-center gap-2"
        >
          <Icon icon={translated ? DoneIcon : CircleIcon} size={ICON.xs} color={translated ? 'success' : 'warning'} />
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
            {translated ? `${lang}: ${translationOf(bubble, lang)}` : t('No {lang} text yet · showing the original', { lang })}
          </Text>
        </Pressable>
      )}
      {speech && (
        <Row label={t('Style')}>
          {SPEECH_TYPES.map(type => (
            <Chip
              key={type}
              label={t(BUBBLE_TYPE_LABEL[type])}
              selected={bubble.type === type}
              onPress={() => onChange({ type, bold: type === 'shout' ? true : bubble.bold })}
            />
          ))}
        </Row>
      )}
      {narration && (
        <Row label={t('Box')}>
          {NARRATION_STYLES.map(style => (
            <Chip
              key={style.value}
              label={t(style.label)}
              selected={(bubble.narrationStyle ?? 'box') === style.value}
              onPress={() => onChange({ narrationStyle: style.value })}
            />
          ))}
        </Row>
      )}
      {sfx ? (
        <>
          <Row label={t('Style')}>
            {SFX_STYLES.map((style, index) => (
              <Chip
                key={style.label}
                label={t(style.label)}
                selected={(bubble.sfxStyle ?? 0) === index}
                onPress={() => onChange({ sfxStyle: index, skew: style.skew })}
              />
            ))}
          </Row>
          <SliderRow
            label={t('Rotate')}
            value={Math.round(bubble.rotation)}
            min={-180}
            max={180}
            step={1}
            text={`${Math.round(bubble.rotation)}°`}
            onChange={rotation => onChange({ rotation }, 'rotation')}
          />
          <SliderRow
            label={t('Skew')}
            value={skew}
            min={-60}
            max={60}
            step={5}
            text={`${skew}`}
            onChange={value => onChange({ skew: value / 100 }, 'skew')}
          />
          <SliderRow
            label={t('Edge')}
            value={bubble.outline ?? 0}
            min={0}
            max={16}
            step={1}
            text={`${bubble.outline ?? 0}`}
            onChange={outline => onChange({ outline }, 'outline')}
          />
          <View className="py-1">
            <Segmented
              options={OUTLINE_COLORS.map(option => ({ ...option, label: t(option.label) }))}
              value={bubble.outlineColor ?? 'white'}
              onChange={outlineColor => onChange({ outlineColor })}
            />
          </View>
        </>
      ) : (
        <Row label={t('Font')}>
          <FontChoices value={bubble.font} fonts={fonts ?? null} onChange={font => onChange({ font })} />
        </Row>
      )}
      {speech && (
        <Row>
          <Chip label={t('Tail')} selected={!!bubble.tail} onPress={onToggleTail} />
          <Chip label={speaker ?? t('Speaker')} icon={UserIcon} selected={!!speaker} onPress={onPickSpeaker} />
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
        <Text variant="label" className="flex-1">{t('Effect · Panel {n}', { n: panelNumber })}</Text>
        <IconButton icon={DeleteIcon} size={ICON.md} color="danger" onPress={onDelete} accessibilityLabel={t('Delete effect')} />
      </View>
      <Row label={t('Type')}>
        {EFFECT_TYPES.map(type => (
          <Chip key={type} label={t(EFFECT_LABEL[type])} selected={effect.type === type} onPress={() => onChange({ type })} />
        ))}
      </Row>
      <SliderRow
        label={t('Density')}
        value={Math.round(effect.density * 100)}
        min={0}
        max={100}
        step={5}
        text={`${Math.round(effect.density * 100)}%`}
        onChange={value => onChange({ density: value / 100 }, 'density')}
      />
      {angled && (
        <SliderRow
          label={t('Angle')}
          value={Math.round(effect.angle)}
          min={0}
          max={345}
          step={15}
          text={`${Math.round(effect.angle)}°`}
          onChange={angle => onChange({ angle }, 'angle')}
        />
      )}
      <SliderRow
        label={t('Opacity')}
        value={Math.round(effect.opacity * 100)}
        min={10}
        max={100}
        step={5}
        text={`${Math.round(effect.opacity * 100)}%`}
        onChange={value => onChange({ opacity: value / 100 }, 'opacity')}
      />
      {effect.type === 'focus' && (
        <Text variant="caption" tone="secondary" className="py-1">
          {t('Drag the dot inside the panel to set the center.')}
        </Text>
      )}
    </ToolPanel>
  );
}
