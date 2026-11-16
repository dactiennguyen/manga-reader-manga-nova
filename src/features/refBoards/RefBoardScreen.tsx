import { useMemo, useRef, useState } from 'react';
import { FlatList, Image, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, tn } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { BOARD_GRID, masonry, masonryColumnCount, sidePadding } from '../../core/refBoards/layout';
import { fileUri } from '../../core/util/paths';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import {
  REF_KIND_LABEL,
  boardLink,
  boardTags,
  hasTag,
  useBoard,
  useBoardImages,
  useLinkTargets,
  useRefBoards,
  type RefImage,
} from '../../state/useRefBoards';
import {
  AppBar,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Fab,
  IconButton,
  LoadingView,
  Menu,
  Pressable,
  Screen,
  Text,
  confirm,
} from '../../ui';
import {
  AddImageIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CharactersIcon,
  DeleteIcon,
  EditIcon,
  ImagesIcon,
  MoreIcon,
  MoveToIcon,
  MoveToStartIcon,
  OrderIcon,
  TagIcon,
} from '../../ui/icons';
import { addFromApp, addFromDevice, type DeviceSource } from './addImages';
import { AppImagesSheet, type AppPick } from './AppImagesSheet';
import { BoardFormSheet } from './BoardFormSheet';
import { RefImageSheet } from './RefImageSheet';
import { RefViewer } from './RefViewer';

const ROW_THUMB = { width: 56, height: 56 };

function Tile({
  image,
  width,
  height,
  label,
  onPress,
  onLongPress,
}: {
  image: RefImage;
  width: number;
  height: number;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={image.caption ? `${label}, ${image.caption}` : label}
      accessibilityHint={t('Long-press for the note, tags and order')}
      onPress={onPress}
      onLongPress={onLongPress}
      className="overflow-hidden rounded-md bg-overlay"
      style={{ width, height }}
    >
      <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(image.path) }} style={{ width, height }} resizeMode="cover" />
      {image.caption ? (
        <View className="absolute inset-x-0 bottom-0 bg-raised px-2 py-1">
          <Text variant="caption" numberOfLines={1}>
            {image.caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function RefBoardScreen() {
  const navigation = useAppNavigation();
  const { boardId } = useAppRoute<'RefBoard'>().params;
  const board = useBoard(boardId);
  if (!board) {
    return (
      <Screen padded={false}>
        <AppBar title={t('Reference boards')} onBack={navigation.goBack} />
        <EmptyState icon={ImagesIcon} title={t('Board not found')} message={t('This board was deleted.')} />
      </Screen>
    );
  }
  return <BoardBody boardId={boardId} />;
}

function BoardBody({ boardId }: { boardId: ID }) {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const windowWidth = useWindowDimensions().width;
  // Kept while the screen leaves after the board is deleted.
  const live = useBoard(boardId);
  const kept = useRef(live);
  if (live) {
    kept.current = live;
  }
  const board = kept.current!;
  const images = useBoardImages(boardId);
  const targets = useLinkTargets();
  const link = boardLink(board, targets);
  const [width, setWidth] = useState(windowWidth);
  const [tag, setTag] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<'add' | 'board' | 'edit' | 'app' | null>(null);
  const [menuImage, setMenuImage] = useState<RefImage | null>(null);
  const [editing, setEditing] = useState<RefImage | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  const tags = useMemo(() => boardTags(images), [images]);
  const shown = useMemo(() => (tag ? images.filter(image => hasTag(image, tag)) : images), [images, tag]);
  const pad = sidePadding(width);
  const columns = masonryColumnCount(width);
  const columnWidth = Math.floor((width - pad * 2 - BOARD_GRID.gap * (columns - 1)) / columns);
  const layout = useMemo(
    () => masonry(shown.map(image => ({ id: image.id, width: image.width, height: image.height })), columns, columnWidth, BOARD_GRID.gap),
    [shown, columns, columnWidth],
  );

  const count = tn(images.length, '{count} picture', '{count} pictures');
  const linkName = link.characterName || link.projectTitle;
  const subtitle = [t(REF_KIND_LABEL[board.kind]), count, linkName].filter(Boolean).join(' · ');

  const run = async (work: () => Promise<number>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };
  const addDevice = (from: DeviceSource) => run(() => addFromDevice(boardId, from));
  const addApp = (picks: AppPick[]) => run(() => addFromApp(boardId, picks));

  const removeBoard = async () => {
    const ok = await confirm(
      t('Delete "{name}"?', { name: board.name }),
      images.length
        ? tn(images.length, 'Its {count} picture will be deleted from this device.', 'Its {count} pictures will be deleted from this device.')
        : undefined,
      { confirmText: t('Delete'), destructive: true },
    );
    if (ok) {
      navigation.goBack();
      useRefBoards.getState().deleteBoard(boardId);
    }
  };

  const removeImage = async (image: RefImage) => {
    const ok = await confirm(t('Remove this picture from the board?'), undefined, { confirmText: t('Remove'), destructive: true });
    if (ok) {
      useRefBoards.getState().removeImage(image.id);
    }
  };

  const place = (image: RefImage) => images.findIndex(item => item.id === image.id);
  const move = (image: RefImage, to: number) => useRefBoards.getState().moveImage(image.id, to);

  const renderRow = ({ item, index }: { item: RefImage; index: number }) => (
    <View className="min-h-16 flex-row items-center gap-3 rounded-md bg-surface px-2 py-1">
      <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(item.path) }} className="rounded-sm bg-overlay" style={ROW_THUMB} resizeMode="cover" />
      <Text variant="bodySmall" tone={item.caption ? 'text' : 'muted'} numberOfLines={2} className="flex-1">
        {item.caption || t('Picture {n}', { n: index + 1 })}
      </Text>
      <IconButton
        icon={ArrowUpIcon}
        disabled={index === 0}
        onPress={() => move(item, index - 1)}
        accessibilityLabel={t('Move earlier')}
      />
      <IconButton
        icon={ArrowDownIcon}
        disabled={index === images.length - 1}
        onPress={() => move(item, index + 1)}
        accessibilityLabel={t('Move later')}
      />
    </View>
  );

  return (
    <Screen padded={false}>
      <AppBar
        title={board.name}
        subtitle={subtitle}
        onBack={navigation.goBack}
        right={
          reorder ? (
            <Button title={t('Done')} variant="ghost" onPress={() => setReorder(false)} />
          ) : (
            <>
              <IconButton icon={AddImageIcon} onPress={() => setOpen('add')} accessibilityLabel={t('Add pictures')} />
              <IconButton icon={MoreIcon} onPress={() => setOpen('board')} accessibilityLabel={t('More')} />
            </>
          )
        }
      />
      {reorder ? (
        <FlatList
          data={images}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          className="flex-1"
          contentContainerClassName="gap-2 pt-2"
          contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 24 }}
        />
      ) : (
        <ScrollView
          className="flex-1"
          onLayout={event => setWidth(event.nativeEvent.layout.width)}
          contentContainerClassName="grow gap-3 pt-2"
          contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 96 }}
        >
          {busy ? <LoadingView label={t('Adding pictures…')} /> : null}
          {tags.length > 0 && (
            <ChipRow>
              <Chip label={t('All')} count={images.length} selected={!tag} onPress={() => setTag(null)} />
              {tags.map(item => (
                <Chip
                  key={item.tag}
                  icon={TagIcon}
                  label={item.tag}
                  count={item.count}
                  selected={!!tag && tag.toLocaleLowerCase() === item.tag.toLocaleLowerCase()}
                  onPress={() => setTag(item.tag)}
                />
              ))}
            </ChipRow>
          )}
          {images.length === 0 && !busy ? (
            <EmptyState
              icon={AddImageIcon}
              title={t('No pictures yet')}
              message={t('Add photos from your device, or pictures you already keep for your characters and world.')}
              action={{ label: t('Add pictures'), onPress: () => setOpen('add') }}
            />
          ) : (
            <View className="flex-row items-start" style={{ gap: BOARD_GRID.gap }}>
              {layout.map((column, columnIndex) => (
                <View key={columnIndex} style={{ width: columnWidth, gap: BOARD_GRID.gap }}>
                  {column.map(tile => (
                    <Tile
                      key={tile.id}
                      image={shown[tile.index]}
                      width={columnWidth}
                      height={tile.height}
                      label={t('Picture {n}', { n: tile.index + 1 })}
                      onPress={() => setViewing(tile.index)}
                      onLongPress={() => setMenuImage(shown[tile.index])}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      {!reorder && images.length > 0 && (
        <Fab icon={AddImageIcon} label={t('Add pictures')} onPress={() => setOpen('add')} bottom={insets.bottom + 16} />
      )}

      <Menu
        visible={open === 'add'}
        onClose={() => setOpen(null)}
        title={t('Add pictures')}
        items={[
          { label: t('From your photos'), subtitle: t('Pick several at once'), icon: ImagesIcon, onPress: () => addDevice('photos') },
          { label: t('From Files'), subtitle: t('Image files on this device or in the cloud'), icon: MoveToIcon, onPress: () => addDevice('files') },
          {
            label: t('From your stories'),
            subtitle: t('Character design sheets and world entries'),
            icon: CharactersIcon,
            onPress: () => setOpen('app'),
          },
        ]}
      />
      <Menu
        visible={open === 'board'}
        onClose={() => setOpen(null)}
        title={board.name}
        items={[
          { label: t('Edit board'), icon: EditIcon, onPress: () => setOpen('edit') },
          images.length > 1 && { label: t('Reorder pictures'), icon: OrderIcon, onPress: () => setReorder(true) },
          { label: t('Delete board'), icon: DeleteIcon, destructive: true, onPress: removeBoard },
        ]}
      />
      <Menu
        visible={!!menuImage}
        onClose={() => setMenuImage(null)}
        title={menuImage?.caption || t('Picture {n}', { n: menuImage ? place(menuImage) + 1 : 0 })}
        items={
          menuImage
            ? [
                { label: t('Note and tags'), icon: EditIcon, onPress: () => setEditing(menuImage) },
                place(menuImage) > 0 && { label: t('Move to start'), icon: MoveToStartIcon, onPress: () => move(menuImage, 0) },
                place(menuImage) > 0 && { label: t('Move earlier'), icon: ArrowUpIcon, onPress: () => move(menuImage, place(menuImage) - 1) },
                place(menuImage) < images.length - 1 && {
                  label: t('Move later'),
                  icon: ArrowDownIcon,
                  onPress: () => move(menuImage, place(menuImage) + 1),
                },
                { label: t('Remove from board'), icon: DeleteIcon, destructive: true, onPress: () => removeImage(menuImage) },
              ]
            : []
        }
      />
      <BoardFormSheet visible={open === 'edit'} board={board} onClose={() => setOpen(null)} />
      <AppImagesSheet visible={open === 'app'} projectId={link.projectId} onClose={() => setOpen(null)} onAdd={addApp} />
      <RefImageSheet image={editing} boardTags={tags.map(item => item.tag)} onClose={() => setEditing(null)} />
      <RefViewer images={shown} index={viewing} title={board.name} onIndex={setViewing} onClose={() => setViewing(null)} />
    </Screen>
  );
}
