import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { DeleteIcon, RestoreIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { LIMITS } from '../../core/model/constants';
import { trashedProjects } from '../../core/model/selectors';
import type { Project } from '../../core/model/types';
import { trashCountdown, trashDaysLeft } from '../../core/story/stats';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { ART, AppBar, Button, Card, Cover, EmptyState, IconButton, Screen, Text, confirm, snackbar, toast } from '../../ui';

export function TrashScreen() {
  const navigation = useAppNavigation();
  const state = useStoryData();
  const items = useMemo(() => trashedProjects(state), [state]);
  const now = Date.now();

  const onRestore = (project: Project) => {
    useStory.getState().restoreProject(project.id);
    snackbar({
      message: t('Restored "{title}"', { title: project.title || t('Untitled') }),
      actionLabel: t('Open'),
      onAction: () => navigation.navigate('Project', { projectId: project.id }),
    });
  };

  const onDelete = async (project: Project) => {
    const ok = await confirm(
      t('Delete "{title}" forever?', { title: project.title }),
      t('The story and all of its pages and images will be gone for good.'),
      { confirmText: t('Delete forever'), destructive: true },
    );
    if (ok) {
      useStory.getState().deleteProjectForever(project.id);
    }
  };

  const onDeleteAll = async () => {
    const ok = await confirm(
      tn(items.length, 'Delete {count} story in the trash forever?', 'Delete {count} stories in the trash forever?'),
      t('This cannot be undone.'),
      { confirmText: t('Delete all'), destructive: true },
    );
    if (ok) {
      const { deleteProjectForever } = useStory.getState();
      items.forEach(project => deleteProjectForever(project.id));
      toast(t('Trash emptied'));
    }
  };

  return (
    <Screen padded={false}>
      <AppBar
        title={t('Trash')}
        onBack={navigation.goBack}
        right={
          items.length > 0 ? <IconButton icon={DeleteIcon} onPress={onDeleteAll} accessibilityLabel={t('Delete all')} /> : undefined
        }
      />
      <FlatList
        data={items}
        keyExtractor={project => project.id}
        className="flex-1"
        contentContainerClassName={items.length === 0 ? 'grow justify-center' : 'gap-3 p-4'}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text variant="caption" tone="muted">
              {t('Stories in the trash are deleted forever after {days} days.', { days: LIMITS.trashDays })}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            art={ART.emptyTrash}
            title={t('Trash is empty')}
            message={t('Stories you delete stay here for {days} days before they are gone for good.', { days: LIMITS.trashDays })}
          />
        }
        renderItem={({ item }) => {
          const left = trashDaysLeft(item, now);
          return (
            <Card className="flex-row gap-3 p-3">
              <Cover project={item} width={56} />
              <View className="flex-1">
                <Text variant="heading" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text variant="caption" tone={left <= 3 ? 'danger' : 'muted'} className="mt-0.5">
                  {trashCountdown(left)}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <Button
                    title={t('Restore')}
                    icon={RestoreIcon}
                    variant="secondary"
                    small
                    onPress={() => onRestore(item)}
                  />
                  <Button title={t('Delete forever')} variant="danger" small onPress={() => onDelete(item)} />
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
