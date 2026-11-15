import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { importBrushFile, parseBrushFile, planImport, type ImportRow, type ImportTarget } from '../../core/art/brushFile';
import { SETS_MAX, SET_NAME_MAX } from '../../core/art/presets';
import { findSet } from '../../core/art/presetSets';
import { t, tn } from '../../core/i18n';
import { uid } from '../../core/util/id';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useArtPresets } from '../../state/useArtPresets';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  FieldLabel,
  Pressable,
  Screen,
  Section,
  Text,
  TextField,
  toast,
} from '../../ui';
import { MoveToIcon, WarningIcon } from '../../ui/icons';
import { baseLabel } from '../canvas/BrushSheet';
import { toneSummary } from '../canvas/ToneSheet';
import { brushFileError, countLabel, setLabel } from './labels';
import { BrushPreview, SetCover, TickBox, TonePreview } from './parts';

const NEW_SET = 'new';

function Row({
  row,
  checked,
  subtitle,
  preview,
  onToggle,
}: {
  row: ImportRow;
  checked: boolean;
  subtitle: string;
  preview: ReactNode;
  onToggle: () => void;
}) {
  const renamed = checked && row.finalName !== row.name;
  const note = renamed ? t('You have one with this name. Added as “{name}”.', { name: row.finalName }) : subtitle;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${row.name}, ${note}`}
      onPress={onToggle}
      className="min-h-14 flex-row items-center gap-3 px-4 py-2"
    >
      <TickBox checked={checked} />
      {preview}
      <View className="flex-1">
        <Text numberOfLines={1}>{row.name}</Text>
        <Text variant="bodySmall" tone={row.conflict ? 'warning' : 'muted'} numberOfLines={2}>
          {note}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The preview before a set of brushes comes in, from a file or from a friend in the room: what is in it,
 * which names are taken, and where it goes. Only what the person ticks is added, with new ids; nothing they
 * have is overwritten, and nothing is added when it would go over the limits.
 */
export function BrushImportScreen() {
  const navigation = useAppNavigation();
  const { text } = useAppRoute<'BrushImport'>().params;
  const parsed = useMemo(() => parseBrushFile(text), [text]);
  const presets = useArtPresets();
  const update = useArtPresets(s => s.update);
  const file = parsed.ok ? parsed.file : null;
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(file ? [...file.brushes, ...file.tones].map(item => item.id) : []));
  const [target, setTarget] = useState<string>(NEW_SET);
  const [setName, setSetName] = useState(() => file?.name || t('Shared brushes'));

  if (!file) {
    return (
      <Screen>
        <AppBar title={t('Import brushes')} onBack={() => navigation.goBack()} />
        <EmptyState
          icon={WarningIcon}
          title={brushFileError(parsed.ok ? 'read' : parsed.reason)}
          action={{ label: t('Go back'), onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const plan = planImport(presets, file, chosen);
  const rows = new Map(plan.rows.map(row => [row.id, row]));
  const pickedBrushes = file.brushes.filter(item => chosen.has(item.id)).length;
  const pickedTones = file.tones.filter(item => chosen.has(item.id)).length;
  const picked = pickedBrushes + pickedTones;
  const all = file.brushes.length + file.tones.length;
  const existing = target === NEW_SET ? undefined : findSet(presets, target);
  const newSet = target === NEW_SET || !existing;
  const tooManyBrushes = pickedBrushes > plan.room.brushes;
  const tooManyTones = pickedTones > plan.room.tones;
  const noSetRoom = newSet && plan.room.sets === 0;
  const blocked = !picked || tooManyBrushes || tooManyTones || noSetRoom;

  const toggle = (id: string) =>
    setChosen(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const runImport = () => {
    const to: ImportTarget = newSet
      ? { newSet: { id: uid(), name: setName.trim() || file.name || t('Shared brushes') } }
      : { setId: existing.id };
    const result = importBrushFile(useArtPresets.getState(), file, chosen, to, uid, setLabel);
    if (!result.ok) {
      toast(
        result.reason === 'sets'
          ? t('You can keep up to {n} sets.', { n: SETS_MAX })
          : t('There is not enough room. Pick fewer, or delete some first.'),
      );
      return;
    }
    update(() => result.presets);
    const setId = 'newSet' in to ? to.newSet.id : to.setId;
    const where = findSet(result.presets, setId);
    toast(t('Added {items} to {set}', { items: countLabel(result.added.brushes, result.added.tones), set: where ? setLabel(where) : '' }));
    navigation.replace('BrushSet', { setId });
  };

  return (
    <Screen scroll keyboard>
      <AppBar title={t('Import brushes')} subtitle={file.name || undefined} onBack={() => navigation.goBack()} />
      <Card className="flex-row items-center gap-3 p-4">
        <SetCover contents={file} />
        <View className="flex-1">
          <Text variant="heading" numberOfLines={2}>
            {file.name || t('Shared brushes')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {countLabel(file.brushes.length, file.tones.length)}
          </Text>
        </View>
      </Card>
      {parsed.ok && parsed.dropped > 0 && (
        <Banner
          tone="warning"
          icon={WarningIcon}
          text={tn(
            parsed.dropped,
            '{count} item in this file was damaged and is left out.',
            '{count} items in this file were damaged and are left out.',
          )}
        />
      )}

      <View className="gap-2">
        <FieldLabel>{t('Add to')}</FieldLabel>
        <ChipRow>
          <Chip label={t('New set')} selected={newSet} onPress={() => setTarget(NEW_SET)} />
          {presets.sets.map(set => (
            <Chip key={set.id} label={setLabel(set)} selected={target === set.id} onPress={() => setTarget(set.id)} />
          ))}
        </ChipRow>
        {newSet && (
          <TextField
            value={setName}
            onChangeText={setSetName}
            maxLength={SET_NAME_MAX}
            placeholder={t('Set name')}
            accessibilityLabel={t('Set name')}
          />
        )}
      </View>

      <View className="flex-row items-center justify-between gap-2">
        <Text variant="label" tone="secondary" className="flex-1">
          {t('{count} of {all} chosen', { count: picked, all })}
        </Text>
        <Button
          title={picked === all ? t('Choose none') : t('Select all')}
          variant="ghost"
          small
          onPress={() => setChosen(picked === all ? new Set() : new Set([...file.brushes, ...file.tones].map(item => item.id)))}
        />
      </View>

      {file.brushes.length > 0 && (
        <Section title={t('Brushes')}>
          {file.brushes.map(item => (
            <Row
              key={item.id}
              row={rows.get(item.id)!}
              checked={chosen.has(item.id)}
              subtitle={baseLabel(item.base)}
              preview={<BrushPreview preset={item} />}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </Section>
      )}
      {file.tones.length > 0 && (
        <Section title={t('Tones')}>
          {file.tones.map(item => (
            <Row
              key={item.id}
              row={rows.get(item.id)!}
              checked={chosen.has(item.id)}
              subtitle={toneSummary(item)}
              preview={<TonePreview preset={item} />}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </Section>
      )}

      {tooManyBrushes && (
        <Banner
          tone="danger"
          icon={WarningIcon}
          text={tn(
            plan.room.brushes,
            'You have room for {count} more brush. Pick fewer, or delete some first.',
            'You have room for {count} more brushes. Pick fewer, or delete some first.',
          )}
        />
      )}
      {tooManyTones && (
        <Banner
          tone="danger"
          icon={WarningIcon}
          text={tn(
            plan.room.tones,
            'You have room for {count} more tone. Pick fewer, or delete some first.',
            'You have room for {count} more tones. Pick fewer, or delete some first.',
          )}
        />
      )}
      {noSetRoom && (
        <Banner tone="danger" icon={WarningIcon} text={t('You have as many sets as you can keep. Add these to a set you have.')} />
      )}
      <Button
        title={picked ? t('Import {items}', { items: countLabel(pickedBrushes, pickedTones) }) : t('Import')}
        icon={MoveToIcon}
        disabled={blocked}
        onPress={runImport}
      />
      <Text variant="caption" tone="muted">
        {t('Nothing you already have is changed. A name you already use gets a number.')}
      </Text>
    </Screen>
  );
}
