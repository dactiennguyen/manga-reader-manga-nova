import { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { TONE_DENSITIES } from '../../core/art/artMath';
import { PRESET_NAME_MAX } from '../../core/art/brushes';
import {
  BUILTIN_TONES,
  TONE_KINDS,
  TONE_LIMITS,
  isBuiltinTone,
  toneFromPreset,
  toneSummaryParts,
  type TonePreset,
} from '../../core/art/tone';
import { t } from '../../core/i18n';
import type { ToneKind } from '../../core/model/types';
import { setContents } from '../../core/art/presetSets';
import { uid } from '../../core/util/id';
import { useAppNavigation } from '../../state/navigation';
import {
  PRESETS_MAX,
  duplicateTone,
  findTone,
  legacyToneId,
  moveTone,
  removeTone,
  saveTone,
  useArtPresets,
} from '../../state/useArtPresets';
import { BackIcon, CopyIcon, DeleteIcon, EditIcon, PlusIcon, PresetsIcon } from '../../ui/icons';
import {
  Button,
  Chip,
  ChipGroup,
  FieldLabel,
  IconButton,
  ListItem,
  Section,
  Sheet,
  Text,
  TextField,
  confirm,
  toast,
} from '../../ui';
import { setLabel } from '../brushLibrary/labels';
import { EditorSection, SettingSlider, ToneThumb, oneDecimal, percent } from './presetThumbs';

const THUMB = 48;
const PREVIEW_H = 120;
const degrees = (value: number) => `${Math.round(value)}°`;

export function toneName(preset: TonePreset): string {
  return isBuiltinTone(preset.id) ? t(preset.name) : preset.name;
}

export function toneSummary(preset: TonePreset): string {
  const parts = toneSummaryParts(preset);
  return `${t(parts.kind)} · ${parts.value}`;
}

/** Edits one of the person's tones. Also used by the brush library (features/brushLibrary). */
export function ToneEditor({
  draft,
  onChange,
  onSave,
  onBack,
  onDuplicate,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  draft: TonePreset;
  onChange: (next: TonePreset) => void;
  onSave: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { width } = useWindowDimensions();
  const previewW = Math.min(width, 560) - 32;
  const tone = useMemo(() => toneFromPreset(draft, { x: 0, y: 0, w: previewW, h: PREVIEW_H }), [draft, previewW]);
  const set = (patch: Partial<TonePreset>) => onChange({ ...draft, ...patch });
  const sand = draft.kind === 'noise';
  const ruled = draft.kind === 'lines' || draft.kind === 'cross';
  const pitchMin = sand ? TONE_LIMITS.grain.min : TONE_LIMITS.pitch.min;
  const pitchMax = sand ? TONE_LIMITS.grain.max : TONE_LIMITS.pitch.max;
  return (
    <View className="gap-4 px-4 pb-4">
      <View className="flex-row items-center gap-2">
        <IconButton icon={BackIcon} onPress={onBack} accessibilityLabel={t('Back')} />
        <Text variant="title" accessibilityRole="header" className="flex-1" numberOfLines={1}>
          {t('Edit tone')}
        </Text>
        <Button title={t('Save')} small onPress={onSave} />
      </View>
      <ToneThumb tone={tone} width={previewW} height={PREVIEW_H} />
      <Text variant="caption" tone="muted">
        {t('Changes apply to new strokes. What you drew before keeps its look.')}
      </Text>
      <View className="gap-1">
        <FieldLabel>{t('Name')}</FieldLabel>
        <TextField
          value={draft.name}
          maxLength={PRESET_NAME_MAX}
          onChangeText={name => set({ name })}
          placeholder={t('Tone name')}
        />
      </View>
      <View className="gap-1">
        <FieldLabel>{t('Pattern')}</FieldLabel>
        <ChipGroup>
          {TONE_KINDS.map(item => (
            <Chip
              key={item.id}
              label={t(item.label)}
              selected={draft.kind === item.id}
              onPress={() => {
                const kind = item.id as ToneKind;
                // Sand measures grains, the others spacing, so the number is reset to a fitting one.
                const pitch = kind === 'noise' ? 1 : draft.kind === 'noise' ? 6 : draft.pitch;
                set({ kind, pitch });
              }}
            />
          ))}
        </ChipGroup>
      </View>
      <EditorSection title={t('Pattern')}>
        {draft.kind === 'gradient' ? (
          <>
            <SettingSlider label={t('Start density')} value={draft.density} min={0} max={TONE_LIMITS.density.max} step={0.01} format={percent} onChange={density => set({ density })} />
            <SettingSlider label={t('End density')} value={draft.density2} min={0} max={TONE_LIMITS.density.max} step={0.01} format={percent} onChange={density2 => set({ density2 })} />
            <SettingSlider label={t('Direction')} value={draft.direction} min={0} max={359} step={1} format={degrees} onChange={direction => set({ direction })} />
          </>
        ) : ruled ? null : (
          <SettingSlider label={t('Density')} value={draft.density} min={TONE_LIMITS.density.min} max={TONE_LIMITS.density.max} step={0.01} format={percent} onChange={density => set({ density })} />
        )}
        <SettingSlider
          label={sand ? t('Grain size') : t('Spacing')}
          value={draft.pitch}
          min={pitchMin}
          max={pitchMax}
          step={0.1}
          format={oneDecimal}
          onChange={pitch => set({ pitch, weight: Math.min(draft.weight, pitch * 0.9) })}
        />
        {ruled ? (
          <SettingSlider label={t('Thickness')} value={draft.weight} min={TONE_LIMITS.weight.min} max={Math.max(TONE_LIMITS.weight.min, draft.pitch * 0.9)} step={0.1} format={oneDecimal} onChange={weight => set({ weight })} />
        ) : null}
        {sand ? null : (
          <SettingSlider label={t('Angle')} value={draft.angle} min={0} max={179} step={1} format={degrees} onChange={angle => set({ angle })} />
        )}
      </EditorSection>
      <View className="flex-row flex-wrap gap-2">
        <Button title={t('Move up')} variant="secondary" small disabled={!canMoveUp} onPress={() => onMove(-1)} />
        <Button title={t('Move down')} variant="secondary" small disabled={!canMoveDown} onPress={() => onMove(1)} />
        <Button title={t('Duplicate')} icon={CopyIcon} variant="secondary" small onPress={onDuplicate} />
        <Button title={t('Delete')} icon={DeleteIcon} variant="danger" small onPress={onDelete} />
      </View>
    </View>
  );
}

/**
 * Tones for brush tone painting and lasso fill: solid, the four original densities, built-in patterns and
 * the person's own. A gradient runs across the panel for the brush and across the filled area for a fill.
 */
export function ToneSheet({
  visible,
  value,
  onClose,
  onChoose,
}: {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onChoose: (choice: string | null) => void;
}) {
  const presets = useArtPresets();
  const update = useArtPresets(s => s.update);
  const navigation = useAppNavigation();
  const [draft, setDraft] = useState<TonePreset | null>(null);
  const box = { x: 0, y: 0, w: THUMB, h: THUMB };
  // The library is a screen: the sheet closes first, then it opens.
  const afterClose = useRef<(() => void) | null>(null);
  const manage = () => {
    afterClose.current = () => navigation.navigate('BrushLibrary');
    onClose();
  };
  const groups = presets.sets
    .map(set => ({ set, tones: setContents(presets, set.id).tones }))
    .filter(group => group.tones.length > 0);

  useEffect(() => {
    if (!visible) {
      setDraft(null);
    }
  }, [visible]);

  const full = presets.tones.length >= PRESETS_MAX;
  const tellFull = () => toast(t('You can keep up to {n} tones.', { n: PRESETS_MAX }));

  const duplicate = (source: TonePreset) => {
    if (full) {
      tellFull();
      return;
    }
    const id = uid();
    update(p => duplicateTone(p, source, id, toneName(source)));
    const copy = findTone(useArtPresets.getState(), id);
    if (copy) {
      setDraft(copy);
    }
  };

  const create = () => {
    if (full) {
      tellFull();
      return;
    }
    const base = BUILTIN_TONES[0];
    setDraft({ ...base, id: uid(), name: t('New tone') });
  };

  const save = () => {
    if (!draft) {
      return;
    }
    update(p => saveTone(p, draft.name.trim() ? draft : { ...draft, name: t('New tone') }));
    setDraft(null);
  };

  const remove = async () => {
    if (!draft) {
      return;
    }
    const ok = await confirm(t('Delete {name}?', { name: draft.name || t('New tone') }), t('Your drawings keep how they look.'), {
      confirmText: t('Delete'),
      destructive: true,
    });
    if (ok) {
      update(p => removeTone(p, draft.id));
      if (value === draft.id) {
        onChoose(null);
      }
      setDraft(null);
    }
  };

  // Moving goes among the tones of the same set, the order the library shows.
  const peers = draft ? setContents(presets, presets.tones.find(item => item.id === draft.id)?.set ?? '').tones : [];
  const index = draft ? peers.findIndex(item => item.id === draft.id) : -1;
  const pick = (choice: string | null) => {
    onChoose(choice);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const run = afterClose.current;
        afterClose.current = null;
        run?.();
      }}
      title={draft ? undefined : t('Tones')}
      subtitle={draft ? undefined : t('Your tones work in every story.')}
      maxHeight="80%"
    >
      {draft ? (
        <ToneEditor
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onBack={() => setDraft(null)}
          onDuplicate={() => {
            update(p => saveTone(p, draft));
            duplicate(draft);
          }}
          onDelete={remove}
          onMove={delta => update(p => moveTone(p, draft.id, delta))}
          canMoveUp={index > 0}
          canMoveDown={index >= 0 && index < peers.length - 1}
        />
      ) : (
        <View className="gap-4 px-4 pb-4">
          <Section title={t('Standard')}>
            <ListItem
              title={t('Solid')}
              left={<ToneThumb tone={null} width={THUMB} height={THUMB} />}
              selected={value === null}
              onPress={() => pick(null)}
            />
            {TONE_DENSITIES.map(density => (
              <ListItem
                key={density}
                title={percent(density)}
                left={<ToneThumb tone={{ density }} width={THUMB} height={THUMB} />}
                selected={value === legacyToneId(density)}
                onPress={() => pick(legacyToneId(density))}
              />
            ))}
          </Section>
          <Section title={t('Built-in')}>
            {BUILTIN_TONES.map(preset => (
              <ListItem
                key={preset.id}
                title={t(preset.name)}
                subtitle={toneSummary(preset)}
                left={<ToneThumb tone={toneFromPreset(preset, box)} width={THUMB} height={THUMB} />}
                selected={value === preset.id}
                onPress={() => pick(preset.id)}
                right={
                  <IconButton
                    icon={CopyIcon}
                    color="text-muted"
                    onPress={() => duplicate(preset)}
                    accessibilityLabel={t('Duplicate {name}', { name: t(preset.name) })}
                  />
                }
              />
            ))}
          </Section>
          {groups.length === 0 ? (
            <Section title={t('My tones')} footer={t('Nothing here yet. Duplicate a tone above or make a new one.')}>
              {null}
            </Section>
          ) : (
            // One section per set, in the person's order; with only the default set it reads "My tones".
            groups.map(({ set, tones }) => (
              <Section key={set.id} title={presets.sets.length > 1 ? setLabel(set) : t('My tones')}>
                {tones.map(preset => (
                  <ListItem
                    key={preset.id}
                    title={preset.name}
                    subtitle={toneSummary(preset)}
                    left={<ToneThumb tone={toneFromPreset(preset, box)} width={THUMB} height={THUMB} />}
                    selected={value === preset.id}
                    onPress={() => pick(preset.id)}
                    right={
                      <IconButton
                        icon={EditIcon}
                        color="text-muted"
                        onPress={() => setDraft(preset)}
                        accessibilityLabel={t('Edit {name}', { name: preset.name })}
                      />
                    }
                  />
                ))}
              </Section>
            ))
          )}
          <View className="flex-row flex-wrap gap-2">
            <Button title={t('New tone')} icon={PlusIcon} variant="secondary" className="flex-1" onPress={create} />
            <Button title={t('Manage…|brushes')} icon={PresetsIcon} variant="secondary" className="flex-1" onPress={manage} />
          </View>
        </View>
      )}
    </Sheet>
  );
}
