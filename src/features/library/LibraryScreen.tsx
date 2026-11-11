import { useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CopyIcon, DeleteIcon, EditIcon, ExportIcon, ImageIcon, ListIcon, MarkDoneIcon, MoreIcon, MoveToIcon, PlayTogetherIcon, PlusIcon, ReadIcon, SearchIcon, SortIcon, TemplatesIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { LIMITS, PROJECT_STATUS_LABEL } from '../../core/model/constants';
import type { ID } from '../../core/model/types';
import {
  LIBRARY_FILTERS,
  LIBRARY_SORT_LABEL,
  libraryCounts,
  libraryGrid,
  libraryRows,
  visibleRows,
  type LibraryFilter,
  type LibraryRow,
  type LibrarySort,
} from '../../core/story/library';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import {
  ART,
  AppBar,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Fab,
  IconButton,
  LoadingView,
  Menu,
  PromptDialog,
  Screen,
  SearchField,
  Text,
  useColor,
  useDockInset,
} from '../../ui';
import {
  changeProjectCover,
  duplicateStory,
  exportProjectFile,
  trashProjectWithConfirm,
} from '../project/projectActions';
import { GridCard, ListCard } from './ProjectCards';
import { useSampleStory } from '../home/sampleStory';
import { useLibraryImport } from './useLibraryImport';

export function LibraryScreen() {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const dockInset = useDockInset();
  const accent = useColor('accent');
  const windowWidth = useWindowDimensions().width;
  const layout = useSettings(s => s.libraryLayout);
  const sort = useSettings(s => s.librarySort);
  const state = useStoryData();
  const listRef = useRef<FlatList<LibraryRow>>(null);
  const [listWidth, setListWidth] = useState(windowWidth);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [highlightId, setHighlightId] = useState<ID | null>(null);
  const [targetId, setTargetId] = useState<ID | null>(null);
  const [open, setOpen] = useState<'item' | 'rename' | 'header' | 'sort' | null>(null);

  const rows = useMemo(() => libraryRows(state), [state]);
  const counts = useMemo(() => libraryCounts(rows), [rows]);
  const visible = useMemo(() => visibleRows(rows, filter, query, sort), [rows, filter, query, sort]);
  const { columns, padding, cardWidth } = libraryGrid(listWidth, layout);
  const target = targetId ? state.projects[targetId] : undefined;

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const clearFilters = () => {
    setFilter('all');
    closeSearch();
  };

  const { openSample } = useSampleStory();
  const { importing, importProject } = useLibraryImport(projectId => {
    clearFilters();
    setHighlightId(projectId);
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
    setTimeout(() => setHighlightId(null), 2500);
  });

  const refresh = () => {
    setRefreshing(true);
    useStory.getState().purgeTrash();
    setTimeout(() => setRefreshing(false), 400);
  };

  const newStory = () => navigation.navigate('NewProject');

  const renderItem = ({ item }: { item: LibraryRow }) => {
    const props = {
      row: item,
      highlighted: highlightId === item.project.id,
      onPress: () => navigation.navigate('Project', { projectId: item.project.id }),
      onLongPress: () => {
        setTargetId(item.project.id);
        setOpen('item');
      },
    };
    return layout === 'list' ? <ListCard {...props} /> : <GridCard {...props} width={cardWidth} />;
  };

  return (
    <Screen padded={false} bottomInset={dockInset}>
      <AppBar
        hideBack
        right={
          <>
            {!searching && <IconButton icon={SearchIcon} onPress={() => setSearching(true)} accessibilityLabel={t('Search')} />}
            {/* Send a story to a friend, or read one together. */}
            <IconButton icon={PlayTogetherIcon} onPress={() => navigation.navigate('Nearby')} accessibilityLabel={t('Play together')} />
            <IconButton icon={MoreIcon} onPress={() => setOpen('header')} accessibilityLabel={t('More')} />
          </>
        }
      >
        {searching ? (
          <SearchField
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search by title')}
            accessibilityLabel={t('Search by title')}
            onClear={closeSearch}
          />
        ) : (
          <Text variant="display" accessibilityRole="header">
            {t('Library')}
          </Text>
        )}
      </AppBar>
      <FlatList
        ref={listRef}
        key={`${layout}-${columns}`}
        data={visible}
        keyExtractor={row => row.project.id}
        renderItem={renderItem}
        numColumns={columns}
        onLayout={event => setListWidth(event.nativeEvent.layout.width)}
        className="flex-1"
        columnWrapperClassName="gap-3"
        contentContainerClassName="grow gap-3 pb-24 pt-2"
        contentContainerStyle={{ paddingHorizontal: padding }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[accent]} />}
        ListHeaderComponent={
          rows.length > 0 ? (
            <View className="gap-2">
              <ChipRow>
                {LIBRARY_FILTERS.map(key => (
                  <Chip
                    key={key}
                    label={key === 'all' ? t('All') : t(PROJECT_STATUS_LABEL[key])}
                    count={counts[key]}
                    selected={filter === key}
                    onPress={() => setFilter(key)}
                  />
                ))}
              </ChipRow>
              <View className="flex-row items-center justify-between">
                <Text variant="label" tone="secondary">
                  {tn(visible.length, '{count} story', '{count} stories')}
                </Text>
                <Button
                  title={t(LIBRARY_SORT_LABEL[sort])}
                  icon={SortIcon}
                  variant="ghost"
                  small
                  onPress={() => setOpen('sort')}
                />
              </View>
              {importing && <LoadingView label={t('Importing project…')} />}
            </View>
          ) : importing ? (
            <LoadingView label={t('Importing project…')} />
          ) : undefined
        }
        ListEmptyComponent={
          rows.length === 0 ? (
            <EmptyState
              art={ART.emptyLibrary}
              title={t('Your shelf is empty.')}
              message={t('Create your first story!')}
              action={{ label: t('New story'), onPress: newStory }}
            />
          ) : (
            <EmptyState title={t('No stories match')} action={{ label: t('Clear filters'), onPress: clearFilters }} />
          )
        }
      />
      {rows.length > 0 && <Fab icon={PlusIcon} label={t('New story')} onPress={newStory} bottom={insets.bottom + (dockInset || 16)} />}

      <Menu
        visible={open === 'header'}
        onClose={() => setOpen(null)}
        items={[
          { label: t('Import project (.manganova)'), icon: MoveToIcon, onPress: importProject },
          { label: t('Open the sample story'), icon: ReadIcon, onPress: openSample },
          { label: t('Trash'), icon: DeleteIcon, onPress: () => navigation.navigate('Trash') },
          {
            label: layout === 'grid' ? t('List view') : t('Grid view'),
            icon: layout === 'grid' ? ListIcon : TemplatesIcon,
            onPress: () => useSettings.getState().set({ libraryLayout: layout === 'grid' ? 'list' : 'grid' }),
          },
        ]}
      />
      <Menu
        visible={open === 'sort'}
        onClose={() => setOpen(null)}
        title={t('Sort by')}
        items={(Object.keys(LIBRARY_SORT_LABEL) as LibrarySort[]).map(key => ({
          label: t(LIBRARY_SORT_LABEL[key]),
          subtitle: key === sort ? t('Selected') : undefined,
          onPress: () => useSettings.getState().set({ librarySort: key }),
        }))}
      />
      <Menu
        visible={open === 'item'}
        onClose={() => setOpen(null)}
        title={target?.title || t('Untitled')}
        items={
          target
            ? [
                { label: t('Rename'), icon: EditIcon, onPress: () => setOpen('rename') },
                { label: t('Change cover'), icon: ImageIcon, onPress: () => changeProjectCover(target.id) },
                {
                  label: t('Duplicate'),
                  subtitle: t('A full copy with its own script, pages and art'),
                  icon: CopyIcon,
                  onPress: () =>
                    duplicateStory(target.id, copyId => navigation.navigate('Project', { projectId: copyId })),
                },
                {
                  label: t('Export project'),
                  subtitle: t('A .manganova file for backup or moving devices'),
                  icon: ExportIcon,
                  onPress: () => exportProjectFile(target.id),
                },
                {
                  label: target.done ? t('Mark as not done') : t('Mark as done'),
                  icon: MarkDoneIcon,
                  onPress: () => useStory.getState().updateProject(target.id, { done: !target.done }),
                },
                { label: t('Delete'), icon: DeleteIcon, destructive: true, onPress: () => trashProjectWithConfirm(target) },
              ]
            : []
        }
      />
      <PromptDialog
        visible={open === 'rename'}
        onClose={() => setOpen(null)}
        title={t('Rename story')}
        initialValue={target?.title ?? ''}
        placeholder={t('Story title')}
        maxLength={LIMITS.projectTitle}
        onSubmit={value => {
          setOpen(null);
          if (target && value) {
            useStory.getState().updateProject(target.id, { title: value });
          }
        }}
      />
    </Screen>
  );
}
