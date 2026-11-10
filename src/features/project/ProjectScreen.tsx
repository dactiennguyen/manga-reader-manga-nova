import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CopyIcon, DeleteIcon, EditIcon, ExportIcon, ImageIcon, MarkDoneIcon, MoreIcon, PaletteIcon, PlayIcon } from '../../ui/icons';

import { msg, t } from '../../core/i18n';
import { ART_STYLE_LABEL, ART_STYLES } from '../../core/model/constants';
import { projectProgress } from '../../core/model/selectors';
import { nextStepOf } from '../../core/story/nextStep';
import { useStoryData } from '../../state/hooks';
import type { ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { AppBar, EmptyState, IconButton, Menu, Screen, Tabs } from '../../ui';
import { ChaptersTab } from './ChaptersTab';
import { ProjectTools } from './ProjectTools';
import { EditInfoSheet } from './EditInfoSheet';
import { NextStepCard, ProjectSummary } from './ProjectSummary';
import { CharactersTab, NotesTab, WorldTab } from './ProjectTabs';
import { changeProjectCover, duplicateStory, exportProjectFile, trashProjectWithConfirm } from './projectActions';

type ProjectTab = 'chapters' | 'characters' | 'world' | 'notes';

const TABS: { key: ProjectTab; label: string }[] = [
  { key: 'chapters', label: msg('Chapters') },
  { key: 'characters', label: msg('Characters') },
  { key: 'world', label: msg('World') },
  { key: 'notes', label: msg('Notes') },
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
        <AppBar title={t('Story')} onBack={navigation.goBack} />
        <EmptyState title={t('Story not found')} message={t('This story was deleted or is in Trash.')} />
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
        title={project.title || t('Untitled')}
        onBack={navigation.goBack}
        right={
          <>
            <IconButton
              icon={PlayIcon}
              accessibilityLabel={t('Preview')}
              onPress={() => navigation.navigate('Preview', { projectId })}
            />
            <IconButton
              icon={ExportIcon}
              accessibilityLabel={t('Export')}
              onPress={() => navigation.navigate('Export', { projectId })}
            />
            <IconButton icon={MoreIcon} accessibilityLabel={t('More')} onPress={() => setMenu(true)} />
          </>
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="pb-12" stickyHeaderIndices={[2]}>
        <ProjectSummary project={project} progress={progress} onAddSummary={() => setEditing(true)} />

        <View>
          <ProjectTools project={project} onTab={setTab} />
          {!!nextStep && !stepHidden && (
            <View className="px-4 pb-3">
              <NextStepCard step={nextStep} onHide={() => setStepHidden(true)} />
            </View>
          )}
        </View>

        <View className="bg-bg px-2">
          <Tabs tabs={TABS.map(item => ({ ...item, label: t(item.label) }))} value={tab} onChange={setTab} stretch />
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
        title={project.title || t('Untitled')}
        items={[
          { label: t('Edit details'), icon: EditIcon, onPress: () => setEditing(true) },
          { label: t('Change cover'), icon: ImageIcon, onPress: () => changeProjectCover(projectId) },
          {
            label: t('Change art style'),
            subtitle: t(ART_STYLE_LABEL[project.style]),
            icon: PaletteIcon,
            onPress: () => setStyleMenu(true),
          },
          {
            label: t('Duplicate story'),
            icon: CopyIcon,
            onPress: () => duplicateStory(projectId, copyId => navigation.push('Project', { projectId: copyId })),
          },
          { label: t('Export project (.manganova)'), icon: ExportIcon, onPress: () => exportProjectFile(projectId) },
          {
            label: project.done ? t('Mark as not completed') : t('Mark as completed'),
            icon: MarkDoneIcon,
            onPress: () => useStory.getState().updateProject(projectId, { done: !project.done }),
          },
          { label: t('Delete story'), icon: DeleteIcon, destructive: true, onPress: remove },
        ]}
      />
      <Menu
        visible={styleMenu}
        onClose={() => setStyleMenu(false)}
        title={t('Art style')}
        items={ART_STYLES.map(item => ({
          label: item.id === project.style ? t('{style} (selected)', { style: t(item.label) }) : t(item.label),
          subtitle: t(item.hint),
          onPress: () => useStory.getState().updateProject(projectId, { style: item.id }),
        }))}
      />
      <EditInfoSheet project={project} visible={editing} onClose={() => setEditing(false)} />
    </Screen>
  );
}
