import { View } from 'react-native';
import { CheckIcon } from '../../ui/icons';

import { PROJECT_STATUS_LABEL } from '../../core/model/constants';
import type { LibraryRow } from '../../core/story/library';
import { plural } from '../../core/util/format';
import { formatRelative } from '../../core/util/time';
import { Cover, Icon, Pressable, ProgressBar, Text } from '../../ui';

type CardProps = { row: LibraryRow; highlighted: boolean; onPress: () => void; onLongPress: () => void };

function DoneMark() {
  return (
    <View className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-sm bg-raised">
      <Icon icon={CheckIcon} size={16} color="success" />
    </View>
  );
}

function labelOf({ project, status, chapters, total }: LibraryRow): string {
  return `${project.title || 'Untitled'}, ${PROJECT_STATUS_LABEL[status]}, ${chapters} ch., ${plural(total, 'page')}`;
}

export function GridCard({ row, highlighted, onPress, onLongPress, width }: CardProps & { width: number }) {
  const { project } = row;
  return (
    <Pressable
      accessibilityLabel={labelOf(row)}
      onPress={onPress}
      onLongPress={onLongPress}
      className="gap-1"
      style={{ width }}
    >
      <Cover project={project} width={width} className={highlighted ? 'border-2 border-accent' : undefined}>
        {project.done && <DoneMark />}
        <View className="absolute inset-x-2 bottom-2">
          <ProgressBar value={row.ratio} />
        </View>
      </Cover>
      <Text variant="label" numberOfLines={2}>
        {project.title || 'Untitled'}
      </Text>
      <Text variant="caption" tone="muted">
        {row.chapters} ch.
      </Text>
    </Pressable>
  );
}

export function ListCard({ row, highlighted, onPress, onLongPress }: CardProps) {
  const { project } = row;
  return (
    <Pressable
      accessibilityLabel={labelOf(row)}
      onPress={onPress}
      onLongPress={onLongPress}
      className={`flex-row items-center gap-3 overflow-hidden rounded-lg bg-surface p-2 ${
        highlighted ? 'border-2 border-accent' : ''
      }`}
    >
      <Cover project={project} width={56}>
        {project.done && <DoneMark />}
      </Cover>
      <View className="flex-1 gap-1">
        <Text variant="heading" numberOfLines={1}>
          {project.title || 'Untitled'}
        </Text>
        {!!project.logline && (
          <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
            {project.logline}
          </Text>
        )}
        <Text variant="caption" tone="muted">
          {row.chapters} ch. · {plural(row.total, 'page')} · {formatRelative(project.updatedAt)}
        </Text>
        <ProgressBar value={row.ratio} />
      </View>
    </Pressable>
  );
}
