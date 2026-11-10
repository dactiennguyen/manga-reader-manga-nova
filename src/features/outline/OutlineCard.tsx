import { View } from 'react-native';
import { PlusIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { chapterName } from '../../core/model/selectors';
import type { Chapter, ChapterStatus } from '../../core/model/types';
import { STATUS_TEXT } from '../../core/story/outlineTools';
import { Icon, Pressable, Text } from '../../ui';

const STATUS_DOT: Record<ChapterStatus, string> = {
  unwritten: 'bg-control-border',
  writing: 'bg-warning',
  drawing: 'bg-accent',
  done: 'bg-success',
};

export function OutlineCard({
  chapter,
  number,
  status,
  onPress,
  onLongPress,
  onMenu,
}: {
  chapter: Chapter;
  number: number;
  status: ChapterStatus;
  onPress: () => void;
  /** Left out while the card can be dragged, because holding it starts the drag. */
  onLongPress?: () => void;
  onMenu: () => void;
}) {
  const name = chapterName(chapter.title, number);
  return (
    <Pressable
      accessibilityLabel={t('Chapter {n}, {name}, {status}', { n: number, name, status: t(STATUS_TEXT[status]) })}
      accessibilityActions={[{ name: 'longpress', label: t('Chapter options') }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'longpress') {
          onMenu();
        }
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      className="gap-2 overflow-hidden rounded-lg bg-raised p-3"
    >
      <View className="flex-row items-center gap-2">
        <View className="h-7 min-w-7 items-center justify-center rounded-sm bg-overlay px-1">
          <Text variant="label" tone="secondary">
            {number}
          </Text>
        </View>
        <Text variant="heading" numberOfLines={2} className="flex-1">
          {name}
        </Text>
      </View>
      {chapter.summary ? (
        <Text variant="bodySmall" tone="secondary" numberOfLines={4}>
          {chapter.summary}
        </Text>
      ) : (
        <Text variant="bodySmall" tone="muted">
          {t('Tap to add a summary.')}
        </Text>
      )}
      {!!chapter.goal && (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {t('Goal: {goal}', { goal: chapter.goal })}
        </Text>
      )}
      <View className="flex-row items-center gap-1">
        <View className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
        <Text variant="caption" tone="muted">
          {t(STATUS_TEXT[status])}
        </Text>
      </View>
    </Pressable>
  );
}

export function AddActButton({ board, onPress }: { board: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={t('Add act')}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-1 overflow-hidden rounded-lg bg-surface py-4 ${
        board ? 'h-30 w-30 self-start' : ''
      }`}
    >
      <Icon icon={PlusIcon} color="text-secondary" />
      <Text variant="label" tone="secondary">
        {t('Act')}
      </Text>
    </Pressable>
  );
}
