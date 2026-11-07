import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { EllipsisVertical, Plus, Sparkles } from 'lucide-react-native';

import { LIMITS } from '../../core/model/constants';
import { chapterIdsOf, chapterStatus } from '../../core/model/selectors';
import type { Act, ChapterStatus, ID, Project } from '../../core/model/types';
import { chapterCount, outlineText } from '../../core/story/outlineTools';
import { useLastOpened, useProject } from '../../state/hooks';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { AppBar, Button, EmptyState, IconButton, Menu, Pressable, PromptDialog, Screen, Text, TextField, toast } from '../../ui';
import { ChapterEditSheet } from './ChapterEditSheet';
import { AddActButton, OutlineCard } from './OutlineCard';
import { DragCard, DragLayer, DragScroll, DragZone, OUTLINE_SIZES, useOutlineDrag } from './OutlineDrag';
import { PlotHolesSheet } from './PlotHolesSheet';
import { PlotIdeasSheet } from './PlotIdeasSheet';
import { SceneIdeasSheet } from './SceneIdeasSheet';
import { useOutlineMenu } from './useOutlineMenu';

const ACT_TITLE_MAX = 40;
const COLUMN_RATIO = 0.85;
const SCREEN_PAD = 16;

const { cardGap, columnGap, columnPad, headHeight } = OUTLINE_SIZES;

const CARDS_STYLE = { paddingHorizontal: columnPad, paddingBottom: 16, gap: cardGap };
const BOARD_STYLE = { paddingHorizontal: SCREEN_PAD, paddingBottom: 16, gap: columnGap };
const LIST_STYLE = { paddingHorizontal: SCREEN_PAD, paddingBottom: 24, gap: columnGap };

export function OutlineScreen({ route, navigation }: ScreenProps<'Outline'>) {
  const project = useProject(route.params.projectId);
  if (!project) {
    return (
      <Screen>
        <AppBar title="Outline" onBack={() => navigation.goBack()} />
        <EmptyState title="Story not found" message="This story may have been deleted." />
      </Screen>
    );
  }
  return <OutlineBoard key={project.id} project={project} />;
}

function OutlineBoard({ project }: { project: Project }) {
  const projectId = project.id;
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const chapters = useStory(s => s.chapters);
  const statuses = useStory(
    useShallow(s => {
      const out: Record<ID, ChapterStatus> = {};
      for (const id of chapterIdsOf(s.projects[projectId])) {
        out[id] = chapterStatus(s, id);
      }
      return out;
    }),
  );
  const [listMode, setListMode] = useState(false);
  const [editingId, setEditingId] = useState<ID | undefined>();
  const [renamingActId, setRenamingActId] = useState<ID | undefined>();
  const [plotOpen, setPlotOpen] = useState(false);
  const [holesOpen, setHolesOpen] = useState(false);
  const [scenesForId, setScenesForId] = useState<ID | undefined>();
  const [logline, setLogline] = useState(project.logline);
  useLastOpened(projectId, { screen: 'Outline' });

  useEffect(() => setLogline(project.logline), [project.logline]);

  const numbers = useMemo(() => {
    const out: Record<ID, number> = {};
    chapterIdsOf(project).forEach((id, index) => {
      out[id] = index + 1;
    });
    return out;
  }, [project]);

  const saveLogline = () => {
    const value = logline.trim();
    if (value !== project.logline) {
      useStory.getState().updateProject(projectId, { logline: value });
    }
  };

  const openPlotIdeas = () => {
    saveLogline();
    setPlotOpen(true);
  };

  const menu = useOutlineMenu({
    project,
    chapters,
    numbers,
    listMode,
    actions: {
      toggleList: () => setListMode(value => !value),
      openPlotIdeas,
      openPlotHoles: () => setHolesOpen(true),
      shareOutline: () => {
        Share.share({ title: `${project.title} outline`, message: outlineText(project, chapters, numbers) }).catch(() =>
          toast('Sharing failed'),
        );
      },
      editChapter: setEditingId,
      breakIntoScenes: setScenesForId,
      renameAct: setRenamingActId,
    },
  });

  const sections = useMemo(() => project.acts.map(act => act.chapterIds), [project]);
  const ctl = useOutlineDrag({
    sections,
    horizontal: !listMode,
    onMove: (chapterId, section, index) => {
      const target = project.acts[section];
      if (!target) {
        return;
      }
      const crossed = !target.chapterIds.includes(chapterId);
      useStory.getState().moveChapter(chapterId, target.id, index);
      if (crossed) {
        toast(`Moved to ${target.title}`);
      }
    },
    onMenu: chapterId => menu.open({ kind: 'chapter', chapterId }),
  });

  const acts = project.acts;
  const total = chapterIdsOf(project).length;
  const columnWidth = Math.round(width * COLUMN_RATIO);
  const canDrag = total > 1 || acts.length > 1;
  const outlined = chapterIdsOf(project).some(id => chapters[id]?.summary.trim());

  const addChapter = (actId?: ID) => {
    setEditingId(useStory.getState().addChapter(projectId, { actId: actId ?? acts[0]?.id }));
  };

  const renderCard = (id: ID, ghost = false) => {
    const chapter = chapters[id];
    if (!chapter) {
      return null;
    }
    const openMenu = () => menu.open({ kind: 'chapter', chapterId: id });
    const card = (
      <OutlineCard
        chapter={chapter}
        number={numbers[id]}
        status={statuses[id] ?? 'unwritten'}
        onPress={() => {
          if (!ctl.busy.current) {
            setEditingId(id);
          }
        }}
        onLongPress={canDrag ? undefined : openMenu}
        onMenu={openMenu}
      />
    );
    return ghost ? (
      card
    ) : (
      <DragCard key={id} ctl={ctl} id={id} enabled={canDrag}>
        {card}
      </DragCard>
    );
  };

  const renderAct = (act: Act, board: boolean) => {
    const body = (
      <>
        {act.chapterIds.map(id => renderCard(id))}
        <Button title="Chapter" icon={Plus} variant="secondary" small onPress={() => addChapter(act.id)} />
      </>
    );
    return (
      <DragZone
        key={act.id}
        ctl={ctl}
        index={acts.indexOf(act)}
        className="overflow-hidden rounded-lg bg-surface"
        style={board ? { width: columnWidth } : undefined}
      >
        <Pressable
          accessibilityLabel={`Rename ${act.title}`}
          onPress={() => setRenamingActId(act.id)}
          onLongPress={() => menu.open({ kind: 'act', actId: act.id })}
          className="flex-row items-center justify-between gap-2"
          style={{ height: headHeight, paddingHorizontal: columnPad }}
        >
          <Text variant="heading" numberOfLines={1} className="flex-1">
            {act.title}
          </Text>
          <Text variant="caption" tone="muted">
            {chapterCount(act.chapterIds.length)}
          </Text>
        </Pressable>
        {board ? (
          <ScrollView nestedScrollEnabled contentContainerStyle={CARDS_STYLE} showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={CARDS_STYLE}>{body}</View>
        )}
      </DragZone>
    );
  };

  const addAct = () => useStory.getState().addAct(projectId);

  const renamingAct = acts.find(act => act.id === renamingActId);

  return (
    <Screen padded={false}>
      <AppBar
        title="Outline"
        subtitle={project.title}
        onBack={() => navigation.goBack()}
        right={<IconButton icon={EllipsisVertical} onPress={() => menu.open({ kind: 'main' })} accessibilityLabel="More" />}
      />
      <View className="gap-2 px-4 pb-2">
        <TextField
          value={logline}
          onChangeText={setLogline}
          onBlur={saveLogline}
          onEndEditing={saveLogline}
          placeholder="Your story in one sentence…"
          accessibilityLabel="Logline"
          maxLength={LIMITS.logline}
          multiline
          submitBehavior="blurAndSubmit"
        />
        {!outlined && <Button title="AI plot ideas" icon={Sparkles} variant="ai" small onPress={openPlotIdeas} className="self-start" />}
      </View>
      {total === 0 && (
        <View className="gap-4 px-4 py-3">
          <Text tone="secondary">Not sure where to start? Add your first chapter and sum it up in one sentence.</Text>
          <Button title="Add chapter" icon={Plus} onPress={() => addChapter()} className="self-start" />
        </View>
      )}
      <View className="flex-1">
        {listMode ? (
          <DragScroll key="list" ctl={ctl} className="flex-1" contentContainerStyle={LIST_STYLE} keyboardShouldPersistTaps="handled">
            {acts.map(act => renderAct(act, false))}
            <AddActButton board={false} onPress={addAct} />
          </DragScroll>
        ) : (
          <DragScroll
            key="board"
            ctl={ctl}
            className="flex-1"
            snapToInterval={columnWidth + columnGap}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={BOARD_STYLE}
          >
            {acts.map(act => renderAct(act, true))}
            <AddActButton board onPress={addAct} />
          </DragScroll>
        )}
        <DragLayer ctl={ctl} renderCard={id => renderCard(id, true)} />
      </View>
      <Menu visible={menu.visible} onClose={menu.close} title={menu.title} subtitle={menu.subtitle} items={menu.items} />
      <PromptDialog
        visible={renamingAct !== undefined}
        onClose={() => setRenamingActId(undefined)}
        title="Rename act"
        initialValue={renamingAct?.title ?? ''}
        placeholder="Act title"
        maxLength={ACT_TITLE_MAX}
        onSubmit={value => {
          if (renamingAct) {
            useStory.getState().renameAct(projectId, renamingAct.id, value.trim());
          }
          setRenamingActId(undefined);
        }}
      />
      {plotOpen && <PlotIdeasSheet projectId={projectId} onClose={() => setPlotOpen(false)} />}
      {holesOpen && <PlotHolesSheet projectId={projectId} onClose={() => setHolesOpen(false)} />}
      {scenesForId !== undefined && (
        <SceneIdeasSheet chapterId={scenesForId} number={numbers[scenesForId] ?? 0} onClose={() => setScenesForId(undefined)} />
      )}
      {editingId !== undefined && (
        <ChapterEditSheet chapterId={editingId} number={numbers[editingId] ?? 0} onClose={() => setEditingId(undefined)} />
      )}
    </Screen>
  );
}
