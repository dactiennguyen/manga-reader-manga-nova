import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  BookCheck,
  Copy,
  EllipsisVertical,
  Image as ImageIcon,
  Palette,
  Pencil,
  Play,
  Share,
  Trash,
  Upload,
} from 'lucide-react-native';

import { ART_STYLE_LABEL, ART_STYLES } from '../../core/model/constants';
import { projectProgress } from '../../core/model/selectors';
import { nextStepOf } from '../../core/story/nextStep';
import { useStoryData } from '../../state/hooks';
import type { ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { AppBar, EmptyState, IconButton, Menu, Screen, Tabs } from '../../ui';
import { ChaptersTab } from './ChaptersTab';
import { EditInfoSheet } from './EditInfoSheet';
import { NextStepCard, ProjectSummary } from './ProjectSummary';
import { CharactersTab, NotesTab, WorldTab } from './ProjectTabs';
import { changeProjectCover, duplicateStory, exportProjectFile, trashProjectWithConfirm } from './projectActions';

type ProjectTab = 'chapters' | 'characters' | 'world' | 'notes';

const TABS: { key: ProjectTab; label: string }[] = [
  { key: 'chapters', label: 'Chapters' },
  { key: 'characters', label: 'Characters' },
  { key: 'world', label: 'World' },
  { key: 'notes', label: 'Notes' },
];

export function ProjectScreen({ navigation, route }: ScreenProps<'Project'>) {
  const { projectId } = route.params;
  const state = useStoryData();
  const project = state.projects[projectId];
  const [tab, setTab] = useState<ProjectTab>('chapters');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [styleMenu, setStyleMenu] = useState(false);
  const [stepHidden, setStepHidden] = useState(false);

  const progress = useMemo(() => projectProgress(state, projectId), [state, projectId]);
  const nextStep = useMemo(() => (project ? nextStepOf(state, project) : undefined), [state, project]);

  if (!project || project.deletedAt) {
    return (
      <Screen padded={false}>
        <AppBar title="Story" onBack={navigation.goBack} />
        <EmptyState title="Story not found" message="This story was deleted or is in Trash." />
      </Screen>
    );
  }

  const remove = async () => {
    if (await trashProjectWithConfirm(project)) {
      navigation.navigate('Tabs', { screen: 'Library' });
    }
  };

  return (
    <Screen padded={false}>
      <AppBar
        title={project.title || 'Untitled'}
        onBack={navigation.goBack}
        right={
          <>
            <IconButton
              icon={Play}
              accessibilityLabel="Preview"
              onPress={() => navigation.navigate('Preview', { projectId })}
            />
            <IconButton
              icon={Upload}
              accessibilityLabel="Export"
              onPress={() => navigation.navigate('Export', { projectId })}
            />
            <IconButton icon={EllipsisVertical} accessibilityLabel="More" onPress={() => setMenu(true)} />
          </>
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="pb-12" stickyHeaderIndices={[2]}>
        <ProjectSummary project={project} progress={progress} onAddSummary={() => setEditing(true)} />

        <View className="px-4 pb-3">
          {!!nextStep && !stepHidden && <NextStepCard step={nextStep} onHide={() => setStepHidden(true)} />}
        </View>

        <View className="bg-bg px-2">
          <Tabs tabs={TABS} value={tab} onChange={setTab} stretch />
        </View>

        <View className="p-4">
          {tab === 'chapters' && <ChaptersTab state={state} project={project} />}
          {tab === 'characters' && <CharactersTab state={state} projectId={projectId} />}
          {tab === 'world' && <WorldTab state={state} projectId={projectId} />}
          {tab === 'notes' && <NotesTab state={state} projectId={projectId} />}
        </View>
      </ScrollView>

      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title={project.title || 'Untitled'}
        items={[
          { label: 'Edit details', icon: Pencil, onPress: () => setEditing(true) },
          { label: 'Change cover', icon: ImageIcon, onPress: () => changeProjectCover(projectId) },
          {
            label: 'Change art style',
            subtitle: ART_STYLE_LABEL[project.style],
            icon: Palette,
            onPress: () => setStyleMenu(true),
          },
          {
            label: 'Duplicate story',
            icon: Copy,
            onPress: () => duplicateStory(projectId, copyId => navigation.push('Project', { projectId: copyId })),
          },
          { label: 'Export project (.mangaka)', icon: Share, onPress: () => exportProjectFile(projectId) },
          {
            label: project.done ? 'Mark as not completed' : 'Mark as completed',
            icon: BookCheck,
            onPress: () => useStory.getState().updateProject(projectId, { done: !project.done }),
          },
          { label: 'Delete story', icon: Trash, destructive: true, onPress: remove },
        ]}
      />
      <Menu
        visible={styleMenu}
        onClose={() => setStyleMenu(false)}
        title="Art style"
        items={ART_STYLES.map(item => ({
          label: item.id === project.style ? `${item.label} (selected)` : item.label,
          subtitle: item.hint,
          onPress: () => useStory.getState().updateProject(projectId, { style: item.id }),
        }))}
      />
      <EditInfoSheet project={project} visible={editing} onClose={() => setEditing(false)} />
    </Screen>
  );
}
