import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { ForwardIcon, PlusIcon } from '../../ui/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isRtl } from '../../core/layout/layout';
import { estimatePages } from '../../core/model/paginate';
import { chapterLabel, scriptOutdated } from '../../core/model/selectors';
import type { Chapter, ID, Scene } from '../../core/model/types';
import type { AiAction } from '../../core/script/aiDrafts';
import { blockEdges, hasScriptText, pagesText, panelRefs } from '../../core/script/blockOps';
import { formatScript, scriptFileName } from '../../core/script/scriptTools';
import { plural } from '../../core/util/format';
import { uid } from '../../core/util/id';
import { MIME, RNFS, shareFile } from '../../native/files';
import { useChapter, useLastOpened } from '../../state/hooks';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { undoable, useStory } from '../../state/useStory';
import { AppBar, Banner, Button, EmptyState, Screen, toast } from '../../ui';
import { CharacterPicker } from '../characters/CharacterPicker';
import { AiWriteSheet } from './AiWriteSheet';
import { FindBar } from './FindBar';
import { SceneSection } from './SceneSection';
import { ScriptHeader } from './ScriptHeader';
import { BlockMenu, MoveToSceneMenu, SceneMenu, ScriptMainMenu } from './ScriptMenus';
import { ScriptToolbar, TOOLBAR_HEIGHT } from './ScriptToolbar';
import { StatsSheet } from './StatsSheet';
import { VersionsSheet } from './VersionsSheet';
import { useScriptController } from './useScriptController';
import { useScriptFind } from './useScriptFind';

const CARET_GAP = 16;
const DRAW_DISTANCE = 800;

/** Keeps the caret above the keyboard and the toolbar sitting on it. Module level, because FlashList remounts on a new identity. */
const ScriptScroller = forwardRef<KeyboardAwareScrollViewRef, ScrollViewProps>((props, ref) => (
  <KeyboardAwareScrollView {...props} ref={ref} bottomOffset={TOOLBAR_HEIGHT + CARET_GAP} />
));

const sceneKey = (scene: Scene) => scene.id;

export function ScriptScreen({ route, navigation }: ScreenProps<'Script'>) {
  const { chapterId, blockId } = route.params;
  const chapter = useChapter(chapterId);
  if (!chapter) {
    return (
      <Screen>
        <AppBar title="Script" onBack={() => navigation.goBack()} />
        <EmptyState title="Chapter not found" message="This chapter may have been deleted." />
      </Screen>
    );
  }
  return <ScriptEditor key={chapterId} chapter={chapter} initialBlockId={blockId} />;
}

function ScriptEditor({ chapter, initialBlockId }: { chapter: Chapter; initialBlockId: ID | undefined }) {
  const insets = useSafeAreaInsets();
  const chapterId = chapter.id;
  const navigation = useAppNavigation();
  const allScenes = useStory(s => s.scenes);
  const allPages = useStory(s => s.pages);
  const characters = useStory(s => s.characters);
  const title = useStory(s => chapterLabel(s, chapterId));
  const rtl = useStory(s => {
    const project = s.projects[chapter.projectId];
    return project ? isRtl(project) : true;
  });
  const [focusMode, setFocusMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sceneMenuId, setSceneMenuId] = useState<ID | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pickFor, setPickFor] = useState<ID | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [blockMenuId, setBlockMenuId] = useState<ID | null>(null);
  const [moveFor, setMoveFor] = useState<ID | null>(null);
  const [ai, setAi] = useState<{ blockId: ID | null; action: AiAction | null } | null>(null);
  const menuAnchor = useRef<ID | null>(null);
  const pickedFor = useRef<ID | null>(null);
  useLastOpened(chapter.projectId, { screen: 'Script', chapterId });

  const openAi = (blockId: ID | null, action: AiAction | null = null) => {
    ctl.flush();
    Keyboard.dismiss();
    setAi({ blockId, action });
  };

  const ctl = useScriptController(chapterId, initialBlockId, {
    pickCharacter: blockId => {
      pickedFor.current = blockId;
      setPickFor(blockId);
    },
    shorten: blockId => openAi(blockId, 'shorten'),
    openSceneMenu: setSceneMenuId,
    openPanel: pageId => navigation.navigate('PanelLayout', { pageId }),
  });

  const scenes = useMemo(
    () => chapter.sceneIds.map(id => allScenes[id]).filter((scene): scene is Scene => Boolean(scene)),
    [chapter.sceneIds, allScenes],
  );
  const panels = useMemo(() => panelRefs(chapter.pageIds, allPages, rtl), [chapter.pageIds, allPages, rtl]);
  const find = useScriptFind(chapterId, scenes, ctl);

  const sceneCount = chapter.sceneIds.length;
  useEffect(() => {
    if (sceneCount === 0) {
      // The empty first scene is not an edit, or Undo would only bring it straight back.
      undoable({}, () => useStory.getState().addScene(chapterId, { blocks: [{ id: uid(), type: 'setting', text: '' }] }));
    }
  }, [sceneCount, chapterId]);

  const { api, sceneApi } = ctl;
  const { matchIds, currentSceneId, currentBlockId } = find;
  const renderScene = useCallback<ListRenderItem<Scene>>(
    ({ item, index }) => (
      <SceneSection
        key={item.id}
        scene={item}
        index={index}
        characters={characters}
        panels={panels}
        matchIds={matchIds}
        currentId={item.id === currentSceneId ? currentBlockId : undefined}
        api={api}
        sceneApi={sceneApi}
      />
    ),
    [api, characters, currentBlockId, currentSceneId, matchIds, panels, sceneApi],
  );

  const openStoryboard = () => {
    ctl.flush();
    navigation.navigate('Storyboard', { chapterId });
  };

  const shareScript = async () => {
    ctl.flush();
    const current = ctl.scenes();
    if (!hasScriptText(current)) {
      toast('Nothing to share yet');
      return;
    }
    const path = `${RNFS.CachesDirectoryPath}/${scriptFileName(title)}`;
    try {
      await RNFS.writeFile(path, formatScript(title, current, useStory.getState().characters), 'utf8');
      await shareFile(path, MIME.text, title);
    } catch {
      toast('Could not share the script');
    }
  };

  const focused = ctl.find(ctl.focusedId);
  const focusedId = ctl.focusedId;
  const focusedEdge = blockEdges(chapter.sceneIds, focused);
  const blockCount = scenes.reduce((sum, scene) => sum + scene.blocks.length, 0);
  const statsText = `${pagesText(estimatePages(scenes))} · ${plural(scenes.length, 'scene')} · ${plural(blockCount, 'block')}`;
  const pickedCharacter = ctl.find(pickFor)?.block.characterId;

  const footer = (
    <View className="gap-3 px-4 pb-24 md:px-6">
      <Button title="New scene" icon={PlusIcon} variant="secondary" onPress={ctl.addScene} />
      <Button title="Paginate" icon={ForwardIcon} onPress={openStoryboard} />
    </View>
  );

  return (
    <Screen padded={false}>
      <ScriptHeader
        focusMode={focusMode}
        title={title}
        stats={statsText}
        saving={ctl.saving}
        canUndo={ctl.canUndo}
        canRedo={ctl.canRedo}
        onBack={() => navigation.goBack()}
        onUndo={ctl.undo}
        onRedo={ctl.redo}
        onExitFocus={() => setFocusMode(false)}
        onMore={() => {
          menuAnchor.current = focusedId;
          setMenuOpen(true);
        }}
      />
      {scriptOutdated(chapter) && (
        <View className="px-4 pb-2">
          <Banner tone="warning" text="Script changed since pagination" action={{ label: 'Open storyboard', onPress: openStoryboard }} />
        </View>
      )}
      <View className="flex-1">
        <FlashList
          ref={ctl.listRef}
          data={scenes}
          keyExtractor={sceneKey}
          renderItem={renderScene}
          renderScrollComponent={ScriptScroller}
          drawDistance={DRAW_DISTANCE}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          onLoad={ctl.onListLoad}
          ListFooterComponent={footer}
        />
        {/* Overlaid, so showing the toolbar does not resize the list on every focus change. */}
        <KeyboardStickyView className="absolute inset-x-0 bottom-0" offset={{ closed: 0, opened: insets.bottom }}>
          {find.open ? (
            <FindBar {...find.bar} />
          ) : focused ? (
            <ScriptToolbar
              type={focused.block.type}
              first={focusedEdge.first}
              last={focusedEdge.last}
              canDelete={focused.scene.blocks.length > 1}
              onAi={() => openAi(focusedId)}
              onType={type => ctl.changeType(focusedId, type)}
              onAdd={() => ctl.insertAfter(focusedId)}
              onMove={delta => ctl.moveBlock(focusedId, delta, true)}
              onDelete={() => ctl.removeBlock(focusedId)}
              onMore={() => {
                ctl.flush();
                setBlockMenuId(focusedId);
              }}
            />
          ) : null}
        </KeyboardStickyView>
      </View>

      <ScriptMainMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAi={() => openAi(menuAnchor.current)}
        onFind={find.start}
        onPaginate={openStoryboard}
        onVersions={() => setVersionsOpen(true)}
        onFocusMode={() => setFocusMode(true)}
        onStats={() => setStatsOpen(true)}
        onShare={shareScript}
      />
      <BlockMenu
        location={ctl.find(blockMenuId)}
        sceneIds={chapter.sceneIds}
        onClose={() => setBlockMenuId(null)}
        onMove={(blockId, delta) => ctl.moveBlock(blockId, delta, false)}
        onMoveToScene={setMoveFor}
        onDelete={ctl.removeBlock}
      />
      <MoveToSceneMenu
        visible={moveFor !== null}
        scenes={scenes}
        currentSceneId={ctl.find(moveFor)?.scene.id}
        onClose={() => setMoveFor(null)}
        onPick={sceneId => {
          if (moveFor) {
            ctl.moveToScene(moveFor, sceneId);
          }
        }}
      />
      <SceneMenu
        sceneId={sceneMenuId}
        sceneIds={chapter.sceneIds}
        onClose={() => setSceneMenuId(null)}
        onMove={ctl.moveScene}
        onDelete={ctl.removeScene}
      />
      <StatsSheet visible={statsOpen} onClose={() => setStatsOpen(false)} title={title} scenes={scenes} characters={characters} />
      <VersionsSheet
        visible={versionsOpen}
        chapterId={chapterId}
        onClose={() => setVersionsOpen(false)}
        onRestore={version => ctl.restoreVersion(version).then(ok => ok && setVersionsOpen(false))}
      />
      {ai && (
        <AiWriteSheet
          chapterId={chapterId}
          projectId={chapter.projectId}
          blockId={ai.blockId}
          initialAction={ai.action ?? undefined}
          onClose={() => setAi(null)}
          onInsert={ctl.insertAiDrafts}
          onReplace={ctl.replaceAiTexts}
          onOpenProfile={() => navigation.navigate('Tabs', { screen: 'Profile' })}
        />
      )}
      <CharacterPicker
        visible={pickFor !== null}
        onClose={() => setPickFor(null)}
        onClosed={() => {
          if (pickedFor.current) {
            ctl.focusBlock(pickedFor.current);
            pickedFor.current = null;
          }
        }}
        projectId={chapter.projectId}
        selectedIds={pickedCharacter ? [pickedCharacter] : []}
        allowClear
        onPick={characterId => ctl.patchBlock(pickedFor.current, block => ({ ...block, characterId }))}
      />
    </Screen>
  );
}
