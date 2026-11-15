import { useMemo, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, tn } from '../../core/i18n';
import { BOARD_GRID, boardListGrid } from '../../core/refBoards/layout';
import type { ID } from '../../core/model/types';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import {
  REF_BOARD_KINDS,
  REF_KIND_LABEL,
  boardLink,
  countByKind,
  filterBoards,
  imagesOf,
  useLinkTargets,
  useRefBoards,
  type RefBoard,
  type RefBoardKind,
} from '../../state/useRefBoards';
import { AppBar, Card, Chip, ChipRow, EmptyState, Fab, IconButton, Menu, Screen, SearchField, Tag, Text, confirm } from '../../ui';
import { CharactersIcon, DeleteIcon, EditIcon, PlusIcon, RefBoardIcon, SearchIcon, ScriptIcon } from '../../ui/icons';
import { BoardCollage } from './BoardCollage';
import { BoardFormSheet } from './BoardFormSheet';

const COVER_RATIO = 0.75;

function BoardCard({
  board,
  width,
  onPress,
  onLongPress,
}: {
  board: RefBoard;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const targets = useLinkTargets();
  const images = useRefBoards(s => s.images);
  const list = useMemo(() => imagesOf(images, board.id), [images, board.id]);
  const link = boardLink(board, targets);
  const count = tn(list.length, '{count} picture', '{count} pictures');
  return (
    <Card onPress={onPress} onLongPress={onLongPress} accessibilityLabel={`${board.name}, ${count}`} style={{ width }}>
      <BoardCollage paths={list.slice(0, 4).map(image => image.path)} width={width} height={Math.round(width * COVER_RATIO)} />
      <View className="gap-1 p-3">
        <Text variant="heading" numberOfLines={1}>
          {board.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`${t(REF_KIND_LABEL[board.kind])} · ${count}`}
        </Text>
        {link.projectTitle ? (
          <Tag
            icon={link.characterName ? CharactersIcon : ScriptIcon}
            label={link.characterName || link.projectTitle.trim() || t('Untitled')}
          />
        ) : null}
      </View>
    </Card>
  );
}

export function RefBoardsScreen() {
  const navigation = useAppNavigation();
  const params = useAppRoute<'RefBoards'>().params;
  const insets = useSafeAreaInsets();
  const windowWidth = useWindowDimensions().width;
  const targets = useLinkTargets();
  const boardMap = useRefBoards(s => s.boards);
  const images = useRefBoards(s => s.images);
  const [listWidth, setListWidth] = useState(windowWidth);
  const [kind, setKind] = useState<RefBoardKind | 'all'>('all');
  const [scoped, setScoped] = useState(!!params?.projectId);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<'new' | 'edit' | null>(null);
  const [menuId, setMenuId] = useState<ID | null>(null);
  const [editId, setEditId] = useState<ID | null>(null);

  const scopeProject = params?.projectId ? targets.projects[params.projectId] : undefined;
  const scopeId = scoped && scopeProject && !scopeProject.deletedAt ? params?.projectId : undefined;
  const scope = useMemo(() => (scopeId ? { projectId: scopeId } : undefined), [scopeId]);
  const boards = useMemo(() => Object.values(boardMap), [boardMap]);
  const inScope = useMemo(
    () => filterBoards(boards, [], { query: '', kind: 'all', scope }, targets),
    [boards, scope, targets],
  );
  const counts = useMemo(() => countByKind(inScope), [inScope]);
  const visible = useMemo(
    () => filterBoards(boards, Object.values(images), { query, kind, scope }, targets),
    [boards, images, query, kind, scope, targets],
  );
  const { columns, padding, cardWidth } = boardListGrid(listWidth);
  const target = menuId ? boardMap[menuId] : undefined;
  const editing = editId ? boardMap[editId] : undefined;

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };
  const clearFilters = () => {
    closeSearch();
    setKind('all');
    setScoped(false);
  };
  const open = (boardId: ID) => navigation.navigate('RefBoard', { boardId });
  const newBoard = () => {
    setEditId(null);
    setForm('new');
  };

  const remove = async (board: RefBoard) => {
    const count = imagesOf(useRefBoards.getState().images, board.id).length;
    const ok = await confirm(
      t('Delete "{name}"?', { name: board.name }),
      count ? tn(count, 'Its {count} picture will be deleted from this device.', 'Its {count} pictures will be deleted from this device.') : undefined,
      { confirmText: t('Delete'), destructive: true },
    );
    if (ok) {
      useRefBoards.getState().deleteBoard(board.id);
    }
  };

  return (
    <Screen padded={false}>
      <AppBar
        onBack={navigation.goBack}
        right={
          !searching && boards.length > 0 ? (
            <IconButton icon={SearchIcon} onPress={() => setSearching(true)} accessibilityLabel={t('Search')} />
          ) : undefined
        }
      >
        {searching ? (
          <SearchField
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search boards, notes and tags')}
            accessibilityLabel={t('Search boards, notes and tags')}
            onClear={closeSearch}
          />
        ) : (
          <Text variant="title" numberOfLines={1} accessibilityRole="header">
            {t('Reference boards')}
          </Text>
        )}
      </AppBar>
      <FlatList
        key={`boards-${columns}`}
        data={visible}
        keyExtractor={board => board.id}
        numColumns={columns}
        onLayout={event => setListWidth(event.nativeEvent.layout.width)}
        className="flex-1"
        columnWrapperStyle={columns > 1 ? { gap: BOARD_GRID.gap } : undefined}
        contentContainerClassName="grow gap-3 pt-2"
        contentContainerStyle={{ paddingHorizontal: padding, paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <BoardCard board={item} width={cardWidth} onPress={() => open(item.id)} onLongPress={() => setMenuId(item.id)} />
        )}
        ListHeaderComponent={
          boards.length > 0 ? (
            <ChipRow>
              {scopeProject && !scopeProject.deletedAt ? (
                <Chip
                  icon={ScriptIcon}
                  label={scopeProject.title.trim() || t('Untitled')}
                  selected={scoped}
                  onPress={() => setScoped(value => !value)}
                />
              ) : null}
              <Chip label={t('All')} count={counts.all} selected={kind === 'all'} onPress={() => setKind('all')} />
              {REF_BOARD_KINDS.map(item => (
                <Chip
                  key={item}
                  label={t(REF_KIND_LABEL[item])}
                  count={counts[item]}
                  selected={kind === item}
                  onPress={() => setKind(item)}
                />
              ))}
            </ChipRow>
          ) : undefined
        }
        ListEmptyComponent={
          boards.length === 0 ? (
            <EmptyState
              icon={RefBoardIcon}
              title={t('Pin pictures to draw from')}
              message={t('Group references by character, place or pose, then keep one open beside the page while you draw.')}
              action={{ label: t('New board'), onPress: newBoard }}
            />
          ) : (
            <EmptyState icon={SearchIcon} title={t('No boards match')} action={{ label: t('Clear filters'), onPress: clearFilters }} />
          )
        }
      />
      {boards.length > 0 && <Fab icon={PlusIcon} label={t('New board')} onPress={newBoard} bottom={insets.bottom + 16} />}

      <Menu
        visible={!!menuId}
        onClose={() => setMenuId(null)}
        title={target?.name}
        items={
          target
            ? [
                {
                  label: t('Edit board'),
                  icon: EditIcon,
                  onPress: () => {
                    setEditId(target.id);
                    setForm('edit');
                  },
                },
                { label: t('Delete board'), icon: DeleteIcon, destructive: true, onPress: () => remove(target) },
              ]
            : []
        }
      />
      <BoardFormSheet
        visible={form !== null}
        board={editing}
        draft={{
          projectId: scope?.projectId ?? params?.projectId,
          characterId: params?.characterId,
          kind: kind === 'all' ? undefined : kind,
        }}
        onClose={() => setForm(null)}
        onSaved={id => {
          if (!editId) {
            open(id);
          }
        }}
      />
    </Screen>
  );
}
