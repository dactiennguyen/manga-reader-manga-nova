import { useRef, useState } from 'react';
import { View } from 'react-native';

import { BRUSH_SIZE_MIN, BUILTIN_BRUSHES, DEFAULT_BRUSH, type BrushPreset } from '../../core/art/brushes';
import {
  BUILTIN_SET_ID,
  DEFAULT_SET_ID,
  PRESETS_MAX,
  SETS_MAX,
  duplicateBrush,
  duplicateTone,
  findBrush,
  findTone,
  moveBrush,
  moveTone,
  removeBrush,
  removeTone,
  saveBrush,
  saveTone,
} from '../../core/art/presets';
import { addSet, addToSet, findSet, moveToSet, roomLeft, setContents, uniqueSetName, type PresetKind } from '../../core/art/presetSets';
import { BUILTIN_TONES, type TonePreset } from '../../core/art/tone';
import { DEFAULT_OPACITY, DEFAULT_SIZES } from '../../core/art/tools';
import { t } from '../../core/i18n';
import { uid } from '../../core/util/id';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useArtPresets } from '../../state/useArtPresets';
import {
  AppBar,
  Banner,
  Button,
  EmptyState,
  IconButton,
  ListItem,
  Menu,
  Screen,
  Section,
  Sheet,
  confirm,
  toast,
  type MenuItem,
} from '../../ui';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BrushIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  LockIcon,
  MoreIcon,
  MoveToIcon,
  PlusIcon,
  ShareIcon,
  ToneIcon,
} from '../../ui/icons';
import { BrushEditor, baseLabel, brushName } from '../canvas/BrushSheet';
import { ToneEditor, toneName, toneSummary } from '../canvas/ToneSheet';
import { countLabel, setLabel } from './labels';
import { BrushPreview, TonePreview } from './parts';
import { useSetActions } from './useSetActions';

type Item = { kind: PresetKind; id: string; name: string };

const BUILTIN = { brushes: BUILTIN_BRUSHES, tones: BUILTIN_TONES };

function fullMessage(kind: PresetKind): string {
  return kind === 'brush'
    ? t('You can keep up to {n} brushes.', { n: PRESETS_MAX })
    : t('You can keep up to {n} tones.', { n: PRESETS_MAX });
}

/**
 * One set: its brushes and tones with previews. The person's own can be edited with the canvas editors,
 * duplicated, reordered, moved to another set and deleted. The built-in set can only be copied from.
 */
export function BrushSetScreen() {
  const navigation = useAppNavigation();
  const { setId } = useAppRoute<'BrushSet'>().params;
  const presets = useArtPresets();
  const update = useArtPresets(s => s.update);
  const builtin = setId === BUILTIN_SET_ID;
  const set = findSet(presets, setId);
  const inside = builtin ? BUILTIN : setContents(presets, setId);
  const title = builtin ? t('Built-in') : set ? setLabel(set) : '';

  const [brushDraft, setBrushDraft] = useState<BrushPreset | null>(null);
  const [toneDraft, setToneDraft] = useState<TonePreset | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Menus keep their item while they slide away; `open` says which one shows.
  const [item, setItem] = useState<Item | null>(null);
  const [open, setOpen] = useState<'item' | 'moveTo' | 'copyTo' | 'set' | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const actions = useSetActions({ onRemoved: () => navigation.goBack() });

  if (!builtin && !set) {
    return (
      <Screen>
        <AppBar title={t('My brushes and tones')} onBack={() => navigation.goBack()} />
        <EmptyState icon={BrushIcon} title={t('This set is gone')} action={{ label: t('Go back'), onPress: () => navigation.goBack() }} />
      </Screen>
    );
  }

  const editBrush = (preset: BrushPreset) => {
    setToneDraft(null);
    setBrushDraft(preset);
    setEditorOpen(true);
  };
  const editTone = (preset: TonePreset) => {
    setBrushDraft(null);
    setToneDraft(preset);
    setEditorOpen(true);
  };
  const closeEditor = () => setEditorOpen(false);
  // A confirm cannot open over the editor sheet on iOS: the sheet closes first, then it asks.
  const thenCloseEditor = (run: () => void) => {
    afterClose.current = run;
    setEditorOpen(false);
  };

  const newBrush = () => {
    if (!roomLeft(useArtPresets.getState()).brushes) {
      toast(fullMessage('brush'));
      return;
    }
    editBrush({
      id: uid(),
      name: t('New brush'),
      base: 'gpen',
      size: DEFAULT_SIZES.gpen,
      sizeMin: BRUSH_SIZE_MIN,
      sizeMax: 40,
      opacity: DEFAULT_OPACITY.gpen,
      brush: { ...DEFAULT_BRUSH },
      set: setId,
    });
  };
  const newTone = () => {
    if (!roomLeft(useArtPresets.getState()).tones) {
      toast(fullMessage('tone'));
      return;
    }
    editTone({ ...BUILTIN_TONES[0], id: uid(), name: t('New tone'), set: setId });
  };

  /** A copy in `target` (the same set for the person's own), opened in the editor when asked. */
  const duplicate = (kind: PresetKind, id: string, target: string, thenEdit: boolean) => {
    const state = useArtPresets.getState();
    if (!roomLeft(state)[kind === 'brush' ? 'brushes' : 'tones']) {
      toast(fullMessage(kind));
      return;
    }
    const copyId = uid();
    if (kind === 'brush') {
      const source = findBrush(state, id);
      if (!source) {
        return;
      }
      update(p => duplicateBrush(p, source, copyId, brushName(source), target));
      const copy = findBrush(useArtPresets.getState(), copyId);
      if (copy && thenEdit) {
        editBrush(copy);
      }
    } else {
      const source = findTone(state, id);
      if (!source) {
        return;
      }
      update(p => duplicateTone(p, source, copyId, toneName(source), target));
      const copy = findTone(useArtPresets.getState(), copyId);
      if (copy && thenEdit) {
        editTone(copy);
      }
    }
    if (!thenEdit) {
      const to = findSet(useArtPresets.getState(), target);
      toast(t('Copied to {set}', { set: to ? setLabel(to) : '' }));
    }
  };

  const remove = async (target: Item) => {
    const ok = await confirm(t('Delete {name}?', { name: target.name }), t('Your drawings keep how they look.'), {
      confirmText: t('Delete'),
      destructive: true,
    });
    if (ok) {
      update(p => (target.kind === 'brush' ? removeBrush(p, target.id) : removeTone(p, target.id)));
    }
  };

  /** Every built-in into a new set of the person's own, when there is room for all of them. */
  const copyAllBuiltins = () => {
    const state = useArtPresets.getState();
    const room = roomLeft(state);
    if (!room.sets) {
      toast(t('You can keep up to {n} sets.', { n: SETS_MAX }));
      return;
    }
    const id = uid();
    const named = BUILTIN_BRUSHES.map(preset => ({ ...preset, name: t(preset.name) }));
    const tones = BUILTIN_TONES.map(preset => ({ ...preset, name: t(preset.name) }));
    const withSet = addSet(state, id, uniqueSetName(state, t('Built-in copy'), setLabel));
    const result = addToSet(withSet, { brushes: named, tones }, id, uid);
    if (!result.ok) {
      toast(t('There is room for {brushes} more brushes and {tones} more tones. Delete some first.', room));
      return;
    }
    update(() => result.presets);
    navigation.replace('BrushSet', { setId: id });
  };

  const save = () => {
    if (brushDraft) {
      update(p => saveBrush(p, brushDraft.name.trim() ? brushDraft : { ...brushDraft, name: t('New brush') }));
    } else if (toneDraft) {
      update(p => saveTone(p, toneDraft.name.trim() ? toneDraft : { ...toneDraft, name: t('New tone') }));
    }
    closeEditor();
  };

  const brushIndex = brushDraft ? inside.brushes.findIndex(entry => entry.id === brushDraft.id) : -1;
  const toneIndex = toneDraft ? inside.tones.findIndex(entry => entry.id === toneDraft.id) : -1;
  const itemIndex = item ? (item.kind === 'brush' ? inside.brushes : inside.tones).findIndex(entry => entry.id === item.id) : -1;
  const itemCount = item?.kind === 'brush' ? inside.brushes.length : inside.tones.length;
  const otherSets = presets.sets.filter(entry => entry.id !== setId);

  const openItem = (next: Item) => {
    setItem(next);
    setOpen(builtin ? 'copyTo' : 'item');
  };

  const itemMenu: (MenuItem | false)[] = item
    ? [
        {
          label: t('Edit'),
          icon: EditIcon,
          onPress: () => {
            const state = useArtPresets.getState();
            const found = item.kind === 'brush' ? findBrush(state, item.id) : undefined;
            const tone = item.kind === 'tone' ? findTone(state, item.id) : undefined;
            if (found) {
              editBrush(found);
            } else if (tone) {
              editTone(tone);
            }
          },
        },
        { label: t('Duplicate'), icon: CopyIcon, onPress: () => duplicate(item.kind, item.id, setId, true) },
        itemIndex > 0 && {
          label: t('Move up'),
          icon: ArrowUpIcon,
          onPress: () => update(p => (item.kind === 'brush' ? moveBrush(p, item.id, -1) : moveTone(p, item.id, -1))),
        },
        itemIndex >= 0 &&
          itemIndex < itemCount - 1 && {
            label: t('Move down'),
            icon: ArrowDownIcon,
            onPress: () => update(p => (item.kind === 'brush' ? moveBrush(p, item.id, 1) : moveTone(p, item.id, 1))),
          },
        otherSets.length > 0 && { label: t('Move to another set…'), icon: MoveToIcon, onPress: () => setOpen('moveTo') },
        { label: t('Delete'), icon: DeleteIcon, destructive: true, onPress: () => remove(item) },
      ]
    : [];

  return (
    <Screen scroll>
      <AppBar
        title={title}
        subtitle={countLabel(inside.brushes.length, inside.tones.length)}
        onBack={() => navigation.goBack()}
        right={
          builtin ? undefined : (
            <View className="flex-row">
              <IconButton icon={ShareIcon} accessibilityLabel={t('Share this set')} onPress={() => actions.share(setId)} />
              <IconButton icon={MoreIcon} accessibilityLabel={t('More for {name}', { name: title })} onPress={() => setOpen('set')} />
            </View>
          )
        }
      />
      {builtin ? (
        <>
          <Banner icon={LockIcon} text={t('Built-in brushes and tones cannot be changed. Copy one into your own set to make it yours.')} />
          <Button title={t('Copy all to a new set')} icon={CopyIcon} variant="secondary" onPress={copyAllBuiltins} />
        </>
      ) : null}
      {!builtin && !inside.brushes.length && !inside.tones.length ? (
        <EmptyState
          icon={BrushIcon}
          title={t('This set is empty')}
          message={t('Make a new brush or tone here, or move some in from another set.')}
          action={{ label: t('New brush'), onPress: newBrush }}
        />
      ) : (
        <>
          {inside.brushes.length > 0 && (
            <Section title={t('Brushes')}>
              {inside.brushes.map(preset => {
                const name = builtin ? t(preset.name) : preset.name;
                return (
                  <ListItem
                    key={preset.id}
                    title={name}
                    subtitle={baseLabel(preset.base)}
                    left={<BrushPreview preset={preset} />}
                    onPress={() => (builtin ? openItem({ kind: 'brush', id: preset.id, name }) : editBrush(preset))}
                    right={
                      <IconButton
                        icon={builtin ? CopyIcon : MoreIcon}
                        color="text-muted"
                        accessibilityLabel={builtin ? t('Duplicate {name}', { name }) : t('More for {name}', { name })}
                        onPress={() => openItem({ kind: 'brush', id: preset.id, name })}
                      />
                    }
                  />
                );
              })}
            </Section>
          )}
          {inside.tones.length > 0 && (
            <Section title={t('Tones')}>
              {inside.tones.map(preset => {
                const name = builtin ? t(preset.name) : preset.name;
                return (
                  <ListItem
                    key={preset.id}
                    title={name}
                    subtitle={toneSummary(preset)}
                    left={<TonePreview preset={preset} />}
                    onPress={() => (builtin ? openItem({ kind: 'tone', id: preset.id, name }) : editTone(preset))}
                    right={
                      <IconButton
                        icon={builtin ? CopyIcon : MoreIcon}
                        color="text-muted"
                        accessibilityLabel={builtin ? t('Duplicate {name}', { name }) : t('More for {name}', { name })}
                        onPress={() => openItem({ kind: 'tone', id: preset.id, name })}
                      />
                    }
                  />
                );
              })}
            </Section>
          )}
        </>
      )}
      {!builtin && (
        <View className="flex-row flex-wrap gap-2">
          <Button title={t('New brush')} icon={BrushIcon} variant="secondary" className="flex-1" onPress={newBrush} />
          <Button title={t('New tone')} icon={ToneIcon} variant="secondary" className="flex-1" onPress={newTone} />
        </View>
      )}

      <Menu visible={open === 'item'} onClose={() => setOpen(null)} title={item?.name} items={itemMenu} />
      <Menu
        visible={open === 'moveTo'}
        onClose={() => setOpen(null)}
        title={t('Move to another set…')}
        items={otherSets.map(entry => ({
          label: setLabel(entry),
          icon: PlusIcon,
          onPress: () => item && update(p => moveToSet(p, item.kind, item.id, entry.id)),
        }))}
      />
      <Menu
        visible={open === 'copyTo'}
        onClose={() => setOpen(null)}
        title={item ? t('Duplicate {name}', { name: item.name }) : undefined}
        subtitle={t('Choose the set the copy goes into.')}
        items={presets.sets.map(entry => ({
          label: setLabel(entry),
          icon: CopyIcon,
          onPress: () => item && duplicate(item.kind, item.id, entry.id, false),
        }))}
      />
      <Menu
        visible={open === 'set'}
        onClose={() => setOpen(null)}
        title={title}
        items={[
          { label: t('Rename'), icon: EditIcon, onPress: () => actions.rename(setId) },
          { label: t('Share this set'), icon: ShareIcon, onPress: () => actions.share(setId) },
          setId !== DEFAULT_SET_ID && { label: t('Delete set'), icon: DeleteIcon, destructive: true, onPress: () => actions.remove(setId) },
        ]}
      />
      <Sheet
        visible={editorOpen}
        onClose={closeEditor}
        onClosed={() => {
          setBrushDraft(null);
          setToneDraft(null);
          const run = afterClose.current;
          afterClose.current = null;
          run?.();
        }}
        maxHeight="90%"
      >
        {brushDraft ? (
          <BrushEditor
            draft={brushDraft}
            onChange={setBrushDraft}
            onSave={save}
            onBack={closeEditor}
            onDuplicate={() => {
              update(p => saveBrush(p, brushDraft));
              duplicate('brush', brushDraft.id, setId, true);
            }}
            onDelete={() => {
              const target = { kind: 'brush' as const, id: brushDraft.id, name: brushDraft.name || t('New brush') };
              thenCloseEditor(() => remove(target));
            }}
            onMove={delta => update(p => moveBrush(p, brushDraft.id, delta))}
            canMoveUp={brushIndex > 0}
            canMoveDown={brushIndex >= 0 && brushIndex < inside.brushes.length - 1}
          />
        ) : toneDraft ? (
          <ToneEditor
            draft={toneDraft}
            onChange={setToneDraft}
            onSave={save}
            onBack={closeEditor}
            onDuplicate={() => {
              update(p => saveTone(p, toneDraft));
              duplicate('tone', toneDraft.id, setId, true);
            }}
            onDelete={() => {
              const target = { kind: 'tone' as const, id: toneDraft.id, name: toneDraft.name || t('New tone') };
              thenCloseEditor(() => remove(target));
            }}
            onMove={delta => update(p => moveTone(p, toneDraft.id, delta))}
            canMoveUp={toneIndex > 0}
            canMoveDown={toneIndex >= 0 && toneIndex < inside.tones.length - 1}
          />
        ) : null}
      </Sheet>
      {actions.dialogs}
    </Screen>
  );
}
