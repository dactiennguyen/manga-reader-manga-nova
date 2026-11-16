import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import {
  BRUSH_BASES,
  BRUSH_GRAINS,
  BRUSH_SIZE_MAX,
  BRUSH_SIZE_MIN,
  BUILTIN_BRUSHES,
  DEFAULT_BRUSH,
  PRESET_NAME_MAX,
  TAPER_MAX,
  isBuiltinBrush,
  type BrushBase,
  type BrushPreset,
} from '../../core/art/brushes';
import { DEFAULT_OPACITY, DEFAULT_SIZES } from '../../core/art/tools';
import { t } from '../../core/i18n';
import type { BrushGrain, StrokeBrush } from '../../core/model/types';
import { uid } from '../../core/util/id';
import { setContents } from '../../core/art/presetSets';
import { useAppNavigation } from '../../state/navigation';
import {
  PRESETS_MAX,
  activeBrush,
  duplicateBrush,
  findBrush,
  moveBrush,
  removeBrush,
  saveBrush,
  useArtPresets,
} from '../../state/useArtPresets';
import {
  BackIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  PlusIcon,
  PresetsIcon,
} from '../../ui/icons';
import {
  Button,
  Chip,
  ChipGroup,
  FieldLabel,
  IconButton,
  ListItem,
  Section,
  Segmented,
  Sheet,
  Text,
  TextField,
  confirm,
  toast,
} from '../../ui';
import { setLabel } from '../brushLibrary/labels';
import {
  BrushThumb,
  EditorSection,
  SettingSlider,
  oneDecimal,
  percent,
} from './presetThumbs';

const THUMB_W = 96;
const THUMB_H = 40;
const PREVIEW_H = 104;

/** Built-in names are English keys; the person's own are shown as typed. */
export function brushName(preset: BrushPreset): string {
  return isBuiltinBrush(preset.id) ? t(preset.name) : preset.name;
}

export function baseLabel(base: BrushBase): string {
  return t(BRUSH_BASES.find(item => item.id === base)?.label ?? '');
}

/** Edits one of the person's brushes. Also used by the brush library (features/brushLibrary). */
export function BrushEditor({
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
  draft: BrushPreset;
  onChange: (next: BrushPreset) => void;
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
  const brush = (patch: Partial<StrokeBrush>) =>
    onChange({ ...draft, brush: { ...draft.brush, ...patch } });
  const sizes = (
    patch: Partial<Pick<BrushPreset, 'size' | 'sizeMin' | 'sizeMax'>>,
  ) => {
    const next = { ...draft, ...patch };
    const sizeMin = Math.min(next.sizeMin, next.sizeMax);
    const sizeMax = Math.max(next.sizeMin, next.sizeMax);
    onChange({
      ...next,
      sizeMin,
      sizeMax,
      size: Math.max(sizeMin, Math.min(sizeMax, next.size)),
    });
  };
  const times = (value: number) => t('{n}× size', { n: oneDecimal(value) });
  return (
    <View className="gap-4 px-4 pb-4">
      <View className="flex-row items-center gap-2">
        <IconButton
          icon={BackIcon}
          onPress={onBack}
          accessibilityLabel={t('Back')}
        />
        <Text
          variant="title"
          accessibilityRole="header"
          className="flex-1"
          numberOfLines={1}
        >
          {t('Edit brush')}
        </Text>
        <Button title={t('Save')} small onPress={onSave} />
      </View>
      <BrushThumb
        base={draft.base}
        preset={draft}
        width={previewW}
        height={PREVIEW_H}
      />
      <Text variant="caption" tone="muted">
        {t(
          'Changes apply to new strokes. What you drew before keeps its look.',
        )}
      </Text>
      <View className="gap-1">
        <FieldLabel>{t('Name')}</FieldLabel>
        <TextField
          value={draft.name}
          maxLength={PRESET_NAME_MAX}
          onChangeText={name => onChange({ ...draft, name })}
          placeholder={t('Brush name')}
        />
      </View>
      <View className="gap-1">
        <FieldLabel>{t('Draws like')}</FieldLabel>
        <Segmented
          options={BRUSH_BASES.map(item => ({
            value: item.id,
            label: t(item.label),
          }))}
          value={draft.base}
          onChange={base => onChange({ ...draft, base })}
        />
      </View>
      <EditorSection title={t('Size')}>
        <SettingSlider
          label={t('Starting size')}
          value={draft.size}
          min={draft.sizeMin}
          max={draft.sizeMax}
          step={0.5}
          format={oneDecimal}
          onChange={size => sizes({ size })}
        />
        <SettingSlider
          label={t('Smallest size')}
          value={draft.sizeMin}
          min={BRUSH_SIZE_MIN}
          max={BRUSH_SIZE_MAX}
          step={0.5}
          format={oneDecimal}
          onChange={sizeMin => sizes({ sizeMin })}
        />
        <SettingSlider
          label={t('Largest size')}
          value={draft.sizeMax}
          min={BRUSH_SIZE_MIN}
          max={BRUSH_SIZE_MAX}
          step={0.5}
          format={oneDecimal}
          onChange={sizeMax => sizes({ sizeMax })}
        />
      </EditorSection>
      <EditorSection title={t('Ink')}>
        <SettingSlider
          label={t('Opacity')}
          value={draft.opacity}
          min={0.05}
          max={1}
          step={0.01}
          format={percent}
          onChange={opacity => onChange({ ...draft, opacity })}
        />
        <SettingSlider
          label={t('Hardness')}
          value={draft.brush.hardness}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={hardness => brush({ hardness })}
        />
      </EditorSection>
      <EditorSection title={t('Pressure')}>
        <SettingSlider
          label={t('Pressure changes size')}
          value={draft.brush.pressureSize}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={pressureSize => brush({ pressureSize })}
        />
        <SettingSlider
          label={t('Pressure changes opacity')}
          value={draft.brush.pressureOpacity}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={pressureOpacity => brush({ pressureOpacity })}
        />
      </EditorSection>
      <EditorSection title={t('Line')}>
        <SettingSlider
          label={t('Taper at start')}
          value={draft.brush.taperStart}
          min={0}
          max={TAPER_MAX}
          step={0.1}
          format={times}
          onChange={taperStart => brush({ taperStart })}
        />
        <SettingSlider
          label={t('Taper at end')}
          value={draft.brush.taperEnd}
          min={0}
          max={TAPER_MAX}
          step={0.1}
          format={times}
          onChange={taperEnd => brush({ taperEnd })}
        />
        <SettingSlider
          label={t('Smoothing')}
          value={draft.brush.smoothing}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={smoothing => brush({ smoothing })}
        />
      </EditorSection>
      <EditorSection title={t('Texture')}>
        <ChipGroup>
          {BRUSH_GRAINS.map(item => (
            <Chip
              key={item.id}
              label={t(item.label)}
              selected={draft.brush.grain === item.id}
              onPress={() => brush({ grain: item.id as BrushGrain })}
            />
          ))}
        </ChipGroup>
      </EditorSection>
      <View className="flex-row flex-wrap gap-2">
        <Button
          title={t('Move up')}
          variant="secondary"
          small
          disabled={!canMoveUp}
          onPress={() => onMove(-1)}
        />
        <Button
          title={t('Move down')}
          variant="secondary"
          small
          disabled={!canMoveDown}
          onPress={() => onMove(1)}
        />
        <Button
          title={t('Duplicate')}
          icon={CopyIcon}
          variant="secondary"
          small
          onPress={onDuplicate}
        />
        <Button
          title={t('Delete')}
          icon={DeleteIcon}
          variant="danger"
          small
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

/**
 * Brushes: each tool's own, the built-in presets and the person's own. Choosing one switches to its tool.
 * The person's brushes can be edited, duplicated, reordered and deleted here; built-ins only duplicated.
 */
export function BrushSheet({
  visible,
  tool,
  onClose,
  onChoose,
}: {
  visible: boolean;
  tool: BrushBase;
  onClose: () => void;
  onChoose: (id: string | null, base: BrushBase) => void;
}) {
  const presets = useArtPresets();
  const update = useArtPresets(s => s.update);
  const navigation = useAppNavigation();
  const [draft, setDraft] = useState<BrushPreset | null>(null);
  const current = activeBrush(presets, tool);
  // The library is a screen: the sheet closes first, then it opens.
  const afterClose = useRef<(() => void) | null>(null);
  const manage = () => {
    afterClose.current = () => navigation.navigate('BrushLibrary');
    onClose();
  };
  const groups = presets.sets
    .map(set => ({ set, brushes: setContents(presets, set.id).brushes }))
    .filter(group => group.brushes.length > 0);

  useEffect(() => {
    if (!visible) {
      setDraft(null);
    }
  }, [visible]);

  const full = presets.brushes.length >= PRESETS_MAX;
  const tellFull = () =>
    toast(t('You can keep up to {n} brushes.', { n: PRESETS_MAX }));

  const duplicate = (source: BrushPreset) => {
    if (full) {
      tellFull();
      return;
    }
    const id = uid();
    update(p => duplicateBrush(p, source, id, brushName(source)));
    const copy = findBrush(useArtPresets.getState(), id);
    if (copy) {
      setDraft(copy);
    }
  };

  const create = () => {
    if (full) {
      tellFull();
      return;
    }
    setDraft({
      id: uid(),
      name: t('New brush'),
      base: tool,
      size: DEFAULT_SIZES[tool],
      sizeMin: BRUSH_SIZE_MIN,
      sizeMax: 40,
      opacity: DEFAULT_OPACITY[tool],
      brush: { ...DEFAULT_BRUSH },
    });
  };

  const save = () => {
    if (!draft) {
      return;
    }
    const named = draft.name.trim()
      ? draft
      : { ...draft, name: t('New brush') };
    update(p => saveBrush(p, named));
    setDraft(null);
  };

  // A confirm dialog cannot open over the sheet on iOS: the sheet closes first, then it asks.
  const remove = () => {
    if (!draft) {
      return;
    }
    const target = draft;
    afterClose.current = async () => {
      const ok = await confirm(
        t('Delete {name}?', { name: target.name || t('New brush') }),
        t('Your drawings keep how they look.'),
        {
          confirmText: t('Delete'),
          destructive: true,
        },
      );
      if (ok) {
        update(p => removeBrush(p, target.id));
      }
    };
    onClose();
  };

  // Moving goes among the brushes of the same set, the order the library shows.
  const peers = draft
    ? setContents(
        presets,
        presets.brushes.find(item => item.id === draft.id)?.set ?? '',
      ).brushes
    : [];
  const index = draft ? peers.findIndex(item => item.id === draft.id) : -1;

  const pick = (id: string | null, base: BrushBase) => {
    onChoose(id, base);
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
      title={draft ? undefined : t('Brushes')}
      subtitle={draft ? undefined : t('Your brushes work in every story.')}
      maxHeight="80%"
    >
      {draft ? (
        <BrushEditor
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onBack={() => setDraft(null)}
          onDuplicate={() => {
            update(p => saveBrush(p, draft));
            duplicate(draft);
          }}
          onDelete={remove}
          onMove={delta => update(p => moveBrush(p, draft.id, delta))}
          canMoveUp={index > 0}
          canMoveDown={index >= 0 && index < peers.length - 1}
        />
      ) : (
        <View className="gap-4 px-4 pb-4">
          <Section title={t('Standard')}>
            {BRUSH_BASES.map(item => (
              <ListItem
                key={item.id}
                title={t(item.label)}
                left={
                  <BrushThumb base={item.id} width={THUMB_W} height={THUMB_H} />
                }
                selected={item.id === tool && !current}
                onPress={() => pick(null, item.id)}
              />
            ))}
          </Section>
          <Section title={t('Built-in')}>
            {BUILTIN_BRUSHES.map(preset => (
              <ListItem
                key={preset.id}
                title={t(preset.name)}
                subtitle={baseLabel(preset.base)}
                left={
                  <BrushThumb
                    base={preset.base}
                    preset={preset}
                    width={THUMB_W}
                    height={THUMB_H}
                  />
                }
                selected={current?.id === preset.id}
                onPress={() => pick(preset.id, preset.base)}
                right={
                  <IconButton
                    icon={CopyIcon}
                    color="text-muted"
                    onPress={() => duplicate(preset)}
                    accessibilityLabel={t('Duplicate {name}', {
                      name: t(preset.name),
                    })}
                  />
                }
              />
            ))}
          </Section>
          {groups.length === 0 ? (
            <Section
              title={t('My brushes')}
              footer={t(
                'Nothing here yet. Duplicate a brush above or make a new one.',
              )}
            >
              {null}
            </Section>
          ) : (
            // One section per set, in the person's order; with only the default set it reads "My brushes".
            groups.map(({ set, brushes }) => (
              <Section
                key={set.id}
                title={
                  presets.sets.length > 1 ? setLabel(set) : t('My brushes')
                }
              >
                {brushes.map(preset => (
                  <ListItem
                    key={preset.id}
                    title={preset.name}
                    subtitle={baseLabel(preset.base)}
                    left={
                      <BrushThumb
                        base={preset.base}
                        preset={preset}
                        width={THUMB_W}
                        height={THUMB_H}
                      />
                    }
                    selected={current?.id === preset.id}
                    onPress={() => pick(preset.id, preset.base)}
                    right={
                      <IconButton
                        icon={EditIcon}
                        color="text-muted"
                        onPress={() => setDraft(preset)}
                        accessibilityLabel={t('Edit {name}', {
                          name: preset.name,
                        })}
                      />
                    }
                  />
                ))}
              </Section>
            ))
          )}
          <View className="flex-row flex-wrap gap-2">
            <Button
              title={t('New brush')}
              icon={PlusIcon}
              variant="secondary"
              className="flex-1"
              onPress={create}
            />
            <Button
              title={t('Manage…|brushes')}
              icon={PresetsIcon}
              variant="secondary"
              className="flex-1"
              onPress={manage}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}
