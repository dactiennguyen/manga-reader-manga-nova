import { useState } from 'react';
import { View } from 'react-native';
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, DeleteIcon, EditIcon, PlusIcon, WarningIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { CHAPTER_STATUS_LABEL, LIMITS } from '../../core/model/constants';
import { chapterIdsOf, chapterName, chapterProgress, chapterStatus, scriptOutdated } from '../../core/model/selectors';
import type { ID, Project, StoryData } from '../../core/model/types';
import { actForNewChapter, canMoveChapterDown, canMoveChapterUp, chapterMove } from '../../core/story/chapterOrder';
import { useAppNavigation } from '../../state/navigation';
import { undoStory, useStory } from '../../state/useStory';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ICON,
  Icon,
  Menu,
  ProgressBar,
  PromptDialog,
  Tag,
  Text,
  snackbar,
  toast,
  type MenuItem,
} from '../../ui';

function ChapterRow({
  state,
  chapterId,
  number,
  onMenu,
}: {
  state: StoryData;
  chapterId: ID;
  number: number;
  onMenu: () => void;
}) {
  const navigation = useAppNavigation();
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return null;
  }
  const status = chapterStatus(state, chapterId);
  const progress = chapterProgress(state, chapterId);
  const hasPages = chapter.pageIds.length > 0;
  const name = chapterName(chapter.title, number);
  return (
    <Card
      accessibilityLabel={`${name}, ${t(CHAPTER_STATUS_LABEL[status])}`}
      onPress={() =>
        hasPages ? navigation.navigate('Storyboard', { chapterId }) : navigation.navigate('Script', { chapterId })
      }
      onLongPress={onMenu}
      className="gap-2 p-3"
    >
      <View className="flex-row items-center gap-2">
        <View className="h-7 min-w-7 items-center justify-center rounded-sm bg-overlay px-1">
          <Text variant="caption" tone="secondary">
            {number}
          </Text>
        </View>
        <Text variant="heading" numberOfLines={1} className="flex-1">
          {name}
        </Text>
        {status === 'done' ? (
          <Badge text={t(CHAPTER_STATUS_LABEL[status])} tone="success" />
        ) : (
          <Tag label={t(CHAPTER_STATUS_LABEL[status])} />
        )}
      </View>
      {scriptOutdated(chapter) && (
        <View className="flex-row items-center gap-1">
          <Icon icon={WarningIcon} size={ICON.xs} color="warning" />
          <Text variant="caption" tone="warning">
            {t('Script changed')}
          </Text>
        </View>
      )}
      {hasPages && (
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
          </View>
          <Text variant="caption" tone="muted">
            {t('{done}/{total} pages', { done: progress.done, total: progress.total })}
          </Text>
        </View>
      )}
      <View className="flex-row gap-2">
        <Button title={t('Script')} variant="ghost" small onPress={() => navigation.navigate('Script', { chapterId })} />
        <Button
          title={t('Storyboard')}
          variant="ghost"
          small
          onPress={() => navigation.navigate('Storyboard', { chapterId })}
        />
      </View>
    </Card>
  );
}

export function ChaptersTab({ state, project }: { state: StoryData; project: Project }) {
  const [target, setTarget] = useState<ID | null>(null);
  const [open, setOpen] = useState<'menu' | 'rename' | 'delete' | null>(null);

  const acts = project.acts;
  const flat = chapterIdsOf(project);
  const numberOf = (chapterId: ID) => flat.indexOf(chapterId) + 1;
  const nameOf = (chapterId: ID) => chapterName(state.chapters[chapterId]?.title ?? '', numberOf(chapterId));

  const move = (chapterId: ID, delta: -1 | 1) => {
    const step = chapterMove(acts, chapterId, delta);
    if (!step) {
      return;
    }
    useStory.getState().moveChapter(chapterId, step.toActId, step.toIndex);
    if (step.crossedInto) {
      toast(t('Moved to {act}', { act: step.crossedInto }));
    }
  };

  const addChapter = () => useStory.getState().addChapter(project.id, { actId: actForNewChapter(acts)?.id });

  const menuItems: MenuItem[] = target
    ? [
        { label: t('Rename'), icon: EditIcon, onPress: () => setOpen('rename') },
        { label: t('Move up'), icon: ArrowUpIcon, disabled: !canMoveChapterUp(acts, target), onPress: () => move(target, -1) },
        {
          label: t('Move down'),
          icon: ArrowDownIcon,
          disabled: !canMoveChapterDown(acts, target),
          onPress: () => move(target, 1),
        },
        {
          label: t('Duplicate'),
          icon: CopyIcon,
          onPress: () => {
            if (useStory.getState().duplicateChapter(target)) {
              toast(t('Chapter duplicated'));
            }
          },
        },
        { label: t('Delete'), icon: DeleteIcon, destructive: true, onPress: () => setOpen('delete') },
      ]
    : [];
  const targetName = target ? nameOf(target) : '';

  const confirmDelete = (value: string) => {
    setOpen(null);
    if (!target) {
      return;
    }
    if (value.trim().toLocaleLowerCase('vi') !== targetName.toLocaleLowerCase('vi')) {
      toast(t('Chapter title does not match. Nothing was deleted'));
      return;
    }
    useStory.getState().removeChapter(target);
    snackbar({
      message: t('Chapter deleted'),
      actionLabel: t('Undo'),
      onAction: () => undoStory(`project:${project.id}`),
    });
  };

  return (
    <View className="gap-3">
      <View className="flex-row justify-end">
        <Button title={t('Add chapter')} icon={PlusIcon} small onPress={addChapter} />
      </View>

      {flat.length === 0 && <EmptyState title={t('No chapters yet.')} message={t('Add the first one!')} />}

      {acts.map(act =>
        act.chapterIds.length === 0 ? null : (
          <View key={act.id} className="gap-2">
            <Text variant="caption" tone="muted">
              {t(act.title)}
            </Text>
            {act.chapterIds.map(chapterId => (
              <ChapterRow
                key={chapterId}
                state={state}
                chapterId={chapterId}
                number={numberOf(chapterId)}
                onMenu={() => {
                  setTarget(chapterId);
                  setOpen('menu');
                }}
              />
            ))}
          </View>
        ),
      )}

      <Menu visible={open === 'menu'} onClose={() => setOpen(null)} title={targetName} items={menuItems} />
      <PromptDialog
        visible={open === 'rename'}
        onClose={() => setOpen(null)}
        title={t('Rename chapter')}
        initialValue={target ? state.chapters[target]?.title ?? '' : ''}
        placeholder={t('Chapter title')}
        maxLength={LIMITS.chapterTitle}
        onSubmit={value => {
          setOpen(null);
          if (target && value) {
            useStory.getState().updateChapter(target, { title: value });
          }
        }}
      />
      <PromptDialog
        visible={open === 'delete'}
        onClose={() => setOpen(null)}
        title={t('Delete chapter?')}
        message={t('The script and all pages of this chapter will be deleted. You can undo this right after. Type "{name}" to confirm.', {
          name: targetName,
        })}
        placeholder={targetName}
        confirmText={t('Delete')}
        onSubmit={confirmDelete}
      />
    </View>
  );
}
