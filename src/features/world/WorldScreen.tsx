import { useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Copy, EllipsisVertical, Plus, Search, Shapes, Share2, Trash2 } from 'lucide-react-native';

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
  { value: 'list', label: 'List' },
  { value: 'timeline', label: 'Timeline' },
];

function emptyText(query: string, view: ViewMode, filter: WorldType | 'all'): string {
  if (query) {
    return `No entries match "${query}".`;
  }
  if (view === 'timeline') {
    return 'No events yet. Add events and give them a time anchor to see how the story flows.';
  }
  if (filter === 'all') {
    return 'The story world is empty. Note down places, factions, terms and events so you remember them while writing.';
  }
  return `No ${WORLD_TYPE_LABEL[filter].toLowerCase()} entries yet.`;
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
    toast('Entry duplicated');
  };

  const remove = async (entry: WorldEntry) => {
    const ok = await confirm(`Delete "${entry.title.trim() || UNTITLED}"?`, 'This entry will be removed from the story world.', {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) {
      useStory.getState().removeWorldEntry(entry.id);
    }
  };

  const exportWiki = async () => {
    if (entries.length === 0) {
      toast('Nothing to export yet');
      return;
    }
    const { characters } = useStory.getState();
    try {
      await Share.share({
        title: `${project?.title ?? 'Story'} — World wiki`,
        message: wikiText(project?.title ?? '', entries, chapters, characters),
      });
    } catch {
      toast('Could not share');
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
    view === 'timeline' ? 'Add event' : filter === 'all' ? 'New entry' : `Add ${WORLD_TYPE_LABEL[filter].toLowerCase()}`;

  return (
    <Screen padded={false} bottom={false}>
      <AppBar
        title="World"
        subtitle={project?.title}
        onBack={() => navigation.goBack()}
        right={
          <>
            <IconButton
              icon={Search}
              active={searching}
              onPress={() => (searching ? closeSearch() : setSearching(true))}
              accessibilityLabel="Search"
            />
            <IconButton icon={EllipsisVertical} onPress={() => setMoreMenu(true)} accessibilityLabel="More" />
          </>
        }
      />
      {searching && (
        <View className="px-4 pt-2">
          <SearchField
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search titles and content"
            accessibilityLabel="Search titles and content"
            autoFocus
          />
        </View>
      )}
      <View className="px-4 pt-3">
        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />
      </View>
      {view === 'list' && (
        <View className="pt-2">
          <ChipRow className="px-4">
            <Chip label="All" selected={filter === 'all'} count={counts.all} onPress={() => setFilter('all')} />
            {WORLD_TYPES.map(type => (
              <Chip
                key={type}
                label={WORLD_TYPE_LABEL[type]}
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
            {!trimmedQuery && <Button title={emptyActionTitle} icon={Plus} onPress={emptyAction} />}
          </View>
        ) : view === 'timeline' ? (
          <WorldTimeline events={events} chapters={chapters} onOpen={open} onLongPress={setRowMenuId} />
        ) : (
          groups.map(group => (
            <View key={group.type} className="mb-3 gap-2">
              <SectionHeader>{WORLD_TYPE_LABEL[group.type]}</SectionHeader>
              <View>
                {group.items.map(entry => (
                  <EntryRow key={entry.id} entry={entry} onPress={() => open(entry.id)} onLongPress={() => setRowMenuId(entry.id)} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <Fab icon={Plus} label="New entry" onPress={() => setTypeMenu(true)} bottom={16 + insets.bottom} />

      <Menu
        visible={typeMenu}
        onClose={() => setTypeMenu(false)}
        title="What type of entry?"
        items={WORLD_TYPES.map(type => ({
          label: WORLD_TYPE_LABEL[type],
          icon: WORLD_TYPE_ICON[type],
          onPress: () => create(type),
        }))}
      />
      <Menu
        visible={moreMenu}
        onClose={() => setMoreMenu(false)}
        items={[{ label: 'Export wiki as text', icon: Share2, onPress: exportWiki }]}
      />
      <Menu
        visible={!!rowEntry}
        onClose={() => setRowMenuId(null)}
        title={rowShown ? rowShown.title.trim() || UNTITLED : undefined}
        subtitle={rowShown ? WORLD_TYPE_LABEL[rowShown.type] : undefined}
        items={[
          { label: 'Change type', icon: Shapes, onPress: () => setRetypeId(rowMenuId) },
          {
            label: 'Duplicate',
            icon: Copy,
            onPress: () => {
              if (rowEntry) {
                duplicate(rowEntry);
              }
            },
          },
          {
            label: 'Delete',
            icon: Trash2,
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
        title="Change type"
        items={WORLD_TYPES.map(type => ({
          label: WORLD_TYPE_LABEL[type],
          icon: retypeEntry?.type === type ? Check : WORLD_TYPE_ICON[type],
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
