import { useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon, CopyIcon, DeleteIcon, MoreIcon, PlusIcon, SearchIcon, ShapesIcon, ShareIcon } from '../../ui/icons';

import { msg, t } from '../../core/i18n';
import { WORLD_TYPES, WORLD_TYPE_LABEL } from '../../core/model/constants';
import type { ID, WorldEntry, WorldType } from '../../core/model/types';
import { UNTITLED, matchesQuery, wikiText } from '../../core/world/worldTools';
import { useChapters, useProject } from '../../state/hooks';
import type { ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import {
  AppBar,
  Button,
  Chip,
  ChipRow,
  Fab,
  IconButton,
  Menu,
  Screen,
  SearchField,
  SectionHeader,
  Segmented,
  Text,
  confirm,
  toast,
} from '../../ui';
import { useSticky } from '../characters/fields';
import { WorldTimeline } from './WorldTimeline';
import { EntryRow, WORLD_TYPE_ICON } from './worldShared';

type ViewMode = 'list' | 'timeline';

const VIEW_OPTIONS: readonly { value: ViewMode; label: string }[] = [
  { value: 'list', label: msg('List') },
  { value: 'timeline', label: msg('Timeline') },
];

function emptyText(query: string, view: ViewMode, filter: WorldType | 'all'): string {
  if (query) {
    return t('No entries match "{query}".', { query });
  }
  if (view === 'timeline') {
    return t('No events yet. Add events and give them a time anchor to see how the story flows.');
  }
  if (filter === 'all') {
    return t('The story world is empty. Note down places, factions, terms and events so you remember them while writing.');
  }
  return t('No {type} entries yet.', { type: t(WORLD_TYPE_LABEL[filter]).toLowerCase() });
}

export function WorldScreen({ route, navigation }: ScreenProps<'World'>) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const project = useProject(projectId);
  const chapters = useChapters(projectId);
  const world = useStory(s => s.world);
  const [filter, setFilter] = useState<WorldType | 'all'>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [typeMenu, setTypeMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<ID | null>(null);
  const [retypeId, setRetypeId] = useState<ID | null>(null);

  const entries = useMemo(
    () =>
      Object.values(world)
        .filter(entry => entry.projectId === projectId)
        .sort((a, b) => a.order - b.order),
    [world, projectId],
  );
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: entries.length };
    for (const entry of entries) {
      result[entry.type] = (result[entry.type] ?? 0) + 1;
    }
    return result;
  }, [entries]);
  const found = useMemo(() => entries.filter(entry => matchesQuery(entry, query)), [entries, query]);
  const events = useMemo(() => found.filter(entry => entry.type === 'event'), [found]);
  const groups = useMemo(
    () =>
      WORLD_TYPES.filter(type => filter === 'all' || filter === type)
        .map(type => ({ type, items: found.filter(entry => entry.type === type) }))
        .filter(group => group.items.length > 0),
    [found, filter],
  );
  const rowEntry = rowMenuId ? world[rowMenuId] : undefined;
  const rowShown = useSticky(rowEntry);
  const retypeEntry = retypeId ? world[retypeId] : undefined;

  const open = (entryId: ID) => navigation.navigate('WorldEntry', { entryId });

  const create = (type: WorldType) => open(useStory.getState().addWorldEntry(projectId, type));

  const duplicate = (entry: WorldEntry) => {
    const title = entry.title.trim() ? `${entry.title.trim()} (copy)` : '';
    useStory.getState().addWorldEntry(projectId, entry.type, {
      title,
      body: entry.body,
      images: [...entry.images],
      characterIds: [...entry.characterIds],
      sendToAi: entry.sendToAi,
      anchor: entry.anchor,
      reading: entry.reading,
      leaderId: entry.leaderId,
    });
    toast(t('Entry duplicated'));
  };

  const remove = async (entry: WorldEntry) => {
    const ok = await confirm(t('Delete "{title}"?', { title: entry.title.trim() || t(UNTITLED) }), t('This entry will be removed from the story world.'), {
      confirmText: t('Delete'),
      destructive: true,
    });
    if (ok) {
      useStory.getState().removeWorldEntry(entry.id);
    }
  };

  const exportWiki = async () => {
    if (entries.length === 0) {
      toast(t('Nothing to export yet'));
      return;
    }
    const { characters } = useStory.getState();
    try {
      await Share.share({
        title: t('{title} — World wiki', { title: project?.title ?? t('Story') }),
        message: wikiText(project?.title ?? '', entries, chapters, characters),
      });
    } catch {
      toast(t('Could not share'));
    }
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const trimmedQuery = query.trim();
  const showingEmpty = view === 'list' ? groups.length === 0 : events.length === 0;
  const emptyAction = () => {
    if (view === 'timeline') {
      create('event');
    } else if (filter === 'all') {
      setTypeMenu(true);
    } else {
      create(filter);
    }
  };
  const emptyActionTitle =
    view === 'timeline' ? t('Add event') : filter === 'all' ? t('New entry') : t('Add {type}', { type: t(WORLD_TYPE_LABEL[filter]).toLowerCase() });

  return (
    <Screen padded={false} bottom={false}>
      <AppBar
        title={t('World')}
        subtitle={project?.title}
        onBack={() => navigation.goBack()}
        right={
          <>
            <IconButton
              icon={SearchIcon}
              active={searching}
              onPress={() => (searching ? closeSearch() : setSearching(true))}
              accessibilityLabel={t('Search')}
            />
            <IconButton icon={MoreIcon} onPress={() => setMoreMenu(true)} accessibilityLabel={t('More')} />
          </>
        }
      />
      {searching && (
        <View className="px-4 pt-2">
          <SearchField
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder={t('Search titles and content')}
            accessibilityLabel={t('Search titles and content')}
            autoFocus
          />
        </View>
      )}
      <View className="px-4 pt-3">
        <Segmented options={VIEW_OPTIONS.map(item => ({ ...item, label: t(item.label) }))} value={view} onChange={setView} />
      </View>
      {view === 'list' && (
        <View className="pt-2">
          <ChipRow className="px-4">
            <Chip label={t('All')} selected={filter === 'all'} count={counts.all} onPress={() => setFilter('all')} />
            {WORLD_TYPES.map(type => (
              <Chip
                key={type}
                label={t(WORLD_TYPE_LABEL[type])}
                icon={WORLD_TYPE_ICON[type]}
                selected={filter === type}
                count={counts[type] ?? 0}
                onPress={() => setFilter(type)}
              />
            ))}
          </ChipRow>
        </View>
      )}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {showingEmpty ? (
          <View className="items-start gap-6 pt-6">
            <Text tone="secondary">{emptyText(trimmedQuery, view, filter)}</Text>
            {!trimmedQuery && <Button title={emptyActionTitle} icon={PlusIcon} onPress={emptyAction} />}
          </View>
        ) : view === 'timeline' ? (
          <WorldTimeline events={events} chapters={chapters} onOpen={open} onLongPress={setRowMenuId} />
        ) : (
          groups.map(group => (
            <View key={group.type} className="mb-3 gap-2">
              <SectionHeader>{t(WORLD_TYPE_LABEL[group.type])}</SectionHeader>
              <View>
                {group.items.map(entry => (
                  <EntryRow key={entry.id} entry={entry} onPress={() => open(entry.id)} onLongPress={() => setRowMenuId(entry.id)} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <Fab icon={PlusIcon} label={t('New entry')} onPress={() => setTypeMenu(true)} bottom={16 + insets.bottom} />

      <Menu
        visible={typeMenu}
        onClose={() => setTypeMenu(false)}
        title={t('What type of entry?')}
        items={WORLD_TYPES.map(type => ({
          label: t(WORLD_TYPE_LABEL[type]),
          icon: WORLD_TYPE_ICON[type],
          onPress: () => create(type),
        }))}
      />
      <Menu
        visible={moreMenu}
        onClose={() => setMoreMenu(false)}
        items={[{ label: t('Export wiki as text'), icon: ShareIcon, onPress: exportWiki }]}
      />
      <Menu
        visible={!!rowEntry}
        onClose={() => setRowMenuId(null)}
        title={rowShown ? rowShown.title.trim() || t(UNTITLED) : undefined}
        subtitle={rowShown ? t(WORLD_TYPE_LABEL[rowShown.type]) : undefined}
        items={[
          { label: t('Change type'), icon: ShapesIcon, onPress: () => setRetypeId(rowMenuId) },
          {
            label: t('Duplicate'),
            icon: CopyIcon,
            onPress: () => {
              if (rowEntry) {
                duplicate(rowEntry);
              }
            },
          },
          {
            label: t('Delete'),
            icon: DeleteIcon,
            destructive: true,
            onPress: () => {
              if (rowEntry) {
                remove(rowEntry);
              }
            },
          },
        ]}
      />
      <Menu
        visible={!!retypeEntry}
        onClose={() => setRetypeId(null)}
        title={t('Change type')}
        items={WORLD_TYPES.map(type => ({
          label: t(WORLD_TYPE_LABEL[type]),
          icon: retypeEntry?.type === type ? CheckIcon : WORLD_TYPE_ICON[type],
          onPress: () => {
            if (retypeId) {
              useStory.getState().updateWorldEntry(retypeId, { type });
            }
          },
        }))}
      />
    </Screen>
  );
}
