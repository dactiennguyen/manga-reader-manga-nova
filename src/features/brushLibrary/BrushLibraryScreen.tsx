import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BUILTIN_BRUSHES } from '../../core/art/brushes';
import { BUILTIN_SET_ID, DEFAULT_SET_ID, SETS_MAX, type PresetSet } from '../../core/art/presets';
import { matchesSearch, moveSet, setContents } from '../../core/art/presetSets';
import { BUILTIN_TONES } from '../../core/art/tone';
import { t } from '../../core/i18n';
import { useAppNavigation } from '../../state/navigation';
import { useArtPresets } from '../../state/useArtPresets';
import { AppBar, Button, EmptyState, IconButton, ListItem, Menu, Screen, SearchField, Section, Tag } from '../../ui';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DeleteIcon,
  EditIcon,
  LockIcon,
  MoreIcon,
  MoveToIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
} from '../../ui/icons';
import { baseLabel } from '../canvas/BrushSheet';
import { toneSummary } from '../canvas/ToneSheet';
import { pickBrushFile } from './brushFiles';
import { countLabel, setLabel } from './labels';
import { BrushPreview, SetCover, TonePreview } from './parts';
import { useSetActions } from './useSetActions';

const BUILTIN_CONTENTS = { brushes: BUILTIN_BRUSHES, tones: BUILTIN_TONES };

/** Every brush and tone whose name matches, each with the set it is in. */
function SearchResults({ query }: { query: string }) {
  const navigation = useAppNavigation();
  const presets = useArtPresets();
  const labelOf = (id: string | undefined) => {
    const set = presets.sets.find(item => item.id === id);
    return set ? setLabel(set) : '';
  };
  const brushes = presets.brushes.filter(item => matchesSearch(item.name, query));
  const tones = presets.tones.filter(item => matchesSearch(item.name, query));
  const builtinBrushes = BUILTIN_BRUSHES.filter(item => matchesSearch(t(item.name), query));
  const builtinTones = BUILTIN_TONES.filter(item => matchesSearch(t(item.name), query));
  if (!brushes.length && !tones.length && !builtinBrushes.length && !builtinTones.length) {
    return (
      <EmptyState icon={SearchIcon} title={t('Nothing matches “{query}”', { query: query.trim() })} message={t('Try another name.')} />
    );
  }
  return (
    <>
      {brushes.length + builtinBrushes.length > 0 && (
        <Section title={t('Brushes')}>
          {brushes.map(item => (
            <ListItem
              key={item.id}
              title={item.name}
              subtitle={`${labelOf(item.set)} · ${baseLabel(item.base)}`}
              left={<BrushPreview preset={item} />}
              chevron
              onPress={() =>
                navigation.navigate('BrushSet', {
                  setId: item.set ?? DEFAULT_SET_ID,
                })
              }
            />
          ))}
          {builtinBrushes.map(item => (
            <ListItem
              key={item.id}
              title={t(item.name)}
              subtitle={`${t('Built-in')} · ${baseLabel(item.base)}`}
              left={<BrushPreview preset={item} />}
              chevron
              onPress={() => navigation.navigate('BrushSet', { setId: BUILTIN_SET_ID })}
            />
          ))}
        </Section>
      )}
      {tones.length + builtinTones.length > 0 && (
        <Section title={t('Tones')}>
          {tones.map(item => (
            <ListItem
              key={item.id}
              title={item.name}
              subtitle={`${labelOf(item.set)} · ${toneSummary(item)}`}
              left={<TonePreview preset={item} />}
              chevron
              onPress={() =>
                navigation.navigate('BrushSet', {
                  setId: item.set ?? DEFAULT_SET_ID,
                })
              }
            />
          ))}
          {builtinTones.map(item => (
            <ListItem
              key={item.id}
              title={t(item.name)}
              subtitle={`${t('Built-in')} · ${toneSummary(item)}`}
              left={<TonePreview preset={item} />}
              chevron
              onPress={() => navigation.navigate('BrushSet', { setId: BUILTIN_SET_ID })}
            />
          ))}
        </Section>
      )}
    </>
  );
}

/**
 * My brushes and tones: the person's sets, the built-ins as a read-only set, search, and the way in for a
 * brush file someone shared. Opened from the Brushes and Tones sheets and from Profile.
 */
export function BrushLibraryScreen() {
  const navigation = useAppNavigation();
  const presets = useArtPresets();
  const update = useArtPresets(s => s.update);
  const [query, setQuery] = useState('');
  // The set stays known while its menu slides away, so the menu does not empty out as it closes.
  const [menuFor, setMenuFor] = useState<PresetSet | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const actions = useSetActions({
    onCreated: setId => navigation.navigate('BrushSet', { setId }),
  });
  const contents = useMemo(() => new Map(presets.sets.map(set => [set.id, setContents(presets, set.id)])), [presets]);
  const index = menuFor ? presets.sets.findIndex(set => set.id === menuFor.id) : -1;

  return (
    <Screen scroll keyboard>
      <AppBar
        title={t('My brushes and tones')}
        subtitle={countLabel(presets.brushes.length, presets.tones.length)}
        onBack={() => navigation.goBack()}
        right={<IconButton icon={MoveToIcon} accessibilityLabel={t('Open a brush file')} onPress={() => pickBrushFile(navigation)} />}
      />
      <SearchField value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder={t('Search brushes and tones')} />
      {query.trim() ? (
        <SearchResults query={query} />
      ) : (
        <>
          <Section title={t('My sets')} footer={t('Your brushes and tones work in every story. Keep up to {n} sets.', { n: SETS_MAX })}>
            {presets.sets.map(set => {
              const inside = contents.get(set.id) ?? { brushes: [], tones: [] };
              return (
                <ListItem
                  key={set.id}
                  title={setLabel(set)}
                  subtitle={countLabel(inside.brushes.length, inside.tones.length)}
                  left={<SetCover contents={inside} />}
                  onPress={() => navigation.navigate('BrushSet', { setId: set.id })}
                  right={
                    <IconButton
                      icon={MoreIcon}
                      color="text-muted"
                      accessibilityLabel={t('More for {name}', {
                        name: setLabel(set),
                      })}
                      onPress={() => {
                        setMenuFor(set);
                        setMenuOpen(true);
                      }}
                    />
                  }
                />
              );
            })}
          </Section>
          <View className="flex-row flex-wrap gap-2">
            <Button title={t('New set')} icon={PlusIcon} variant="secondary" className="flex-1" onPress={actions.newSet} />
            <Button
              title={t('Open a brush file')}
              icon={MoveToIcon}
              variant="secondary"
              className="flex-1"
              onPress={() => pickBrushFile(navigation)}
            />
          </View>
          <Section title={t('Built-in')} footer={t('These come with the app. Duplicate one to change it.')}>
            <ListItem
              title={t('Built-in')}
              subtitle={countLabel(BUILTIN_BRUSHES.length, BUILTIN_TONES.length)}
              left={<SetCover contents={BUILTIN_CONTENTS} />}
              right={<Tag icon={LockIcon} label={t('Read only')} />}
              chevron
              onPress={() => navigation.navigate('BrushSet', { setId: BUILTIN_SET_ID })}
            />
          </Section>
        </>
      )}
      <Menu
        visible={menuOpen && !!menuFor}
        onClose={() => setMenuOpen(false)}
        title={menuFor ? setLabel(menuFor) : undefined}
        items={
          menuFor
            ? [
                {
                  label: t('Share this set'),
                  icon: ShareIcon,
                  onPress: () => actions.share(menuFor.id),
                },
                {
                  label: t('Rename'),
                  icon: EditIcon,
                  onPress: () => actions.rename(menuFor.id),
                },
                index > 0 && {
                  label: t('Move up'),
                  icon: ArrowUpIcon,
                  onPress: () => update(p => moveSet(p, menuFor.id, -1)),
                },
                index >= 0 &&
                  index < presets.sets.length - 1 && {
                    label: t('Move down'),
                    icon: ArrowDownIcon,
                    onPress: () => update(p => moveSet(p, menuFor.id, 1)),
                  },
                menuFor.id !== DEFAULT_SET_ID && {
                  label: t('Delete set'),
                  icon: DeleteIcon,
                  destructive: true,
                  onPress: () => actions.remove(menuFor.id),
                },
              ]
            : []
        }
      />
      {actions.dialogs}
    </Screen>
  );
}
