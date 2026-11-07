import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { DeleteIcon, RestoreIcon } from '../../ui/icons';

import { LIMITS } from '../../core/model/constants';
import { trashedProjects } from '../../core/model/selectors';
import type { Project } from '../../core/model/types';
import { trashCountdown, trashDaysLeft } from '../../core/story/stats';
import { plural } from '../../core/util/format';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { AppBar, Button, Card, Cover, EmptyState, IconButton, Screen, Text, confirm, snackbar, toast } from '../../ui';

export function TrashScreen() {
  const navigation = useAppNavigation();
  const state = useStoryData();
  const items = useMemo(() => trashedProjects(state), [state]);
  const now = Date.now();

  const onRestore = (project: Project) => {
    useStory.getState().restoreProject(project.id);
    snackbar({
      message: `Restored "${project.title || 'Untitled'}"`,
      actionLabel: 'Open',
      onAction: () => navigation.navigate('Project', { projectId: project.id }),
    });
  };

  const onDelete = async (project: Project) => {
    const ok = await confirm(
      `Delete "${project.title}" forever?`,
      'The story and all of its pages and images will be gone for good.',
      { confirmText: 'Delete forever', destructive: true },
    );
    if (ok) {
      useStory.getState().deleteProjectForever(project.id);
    }
  };

  const onDeleteAll = async () => {
    const ok = await confirm(
      `Delete ${plural(items.length, 'story', 'stories')} in the trash forever?`,
      'This cannot be undone.',
      { confirmText: 'Delete all', destructive: true },
    );
    if (ok) {
      const { deleteProjectForever } = useStory.getState();
      items.forEach(project => deleteProjectForever(project.id));
      toast('Trash emptied');
    }
  };

  return (
    <Screen padded={false}>
      <AppBar
        title="Trash"
        onBack={navigation.goBack}
        right={
          items.length > 0 ? <IconButton icon={DeleteIcon} onPress={onDeleteAll} accessibilityLabel="Delete all" /> : undefined
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
              Stories in the trash are deleted forever after {LIMITS.trashDays} days.
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon={DeleteIcon}
            title="Trash is empty"
            message={`Stories you delete stay here for ${LIMITS.trashDays} days before they are gone for good.`}
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
                    title="Restore"
                    icon={RestoreIcon}
                    variant="secondary"
                    small
                    onPress={() => onRestore(item)}
                  />
                  <Button title="Delete forever" variant="danger" small onPress={() => onDelete(item)} />
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
