import { ScrollView, View } from 'react-native';
import { AiIcon, ArrowDownIcon, ArrowUpIcon, DeleteIcon, MoreIcon, PlusIcon } from '../../ui/icons';

import { BLOCK_LABEL, BLOCK_TYPES } from '../../core/model/constants';
import type { BlockType } from '../../core/model/types';
import { Chip, Icon, IconButton, Pressable, Text } from '../../ui';

/** Height of the bar, so the editor can keep the caret clear of it. */
export const TOOLBAR_HEIGHT = 64;

export function ScriptToolbar({
  type,
  first,
  last,
  canDelete,
  onAi,
  onType,
  onAdd,
  onMove,
  onDelete,
  onMore,
}: {
  type: BlockType;
  first: boolean;
  last: boolean;
  canDelete: boolean;
  onAi: () => void;
  onType: (type: BlockType) => void;
  onAdd: () => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onMore: () => void;
}) {
  return (
    <View className="bg-raised" style={{ height: TOOLBAR_HEIGHT }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerClassName="items-center gap-2 px-3"
      >
        <Pressable
          accessibilityLabel="AI writing help"
          hitSlop={6}
          onPress={onAi}
          className="h-9 flex-row items-center gap-1.5 overflow-hidden rounded-sm bg-ai/15 px-3"
        >
          <Icon icon={AiIcon} size={16} color="ai" />
          <Text variant="label" tone="ai">
            AI
          </Text>
        </Pressable>
        {BLOCK_TYPES.map(item => (
          <Chip key={item} label={BLOCK_LABEL[item]} selected={type === item} onPress={() => onType(item)} />
        ))}
        <IconButton icon={PlusIcon} onPress={onAdd} accessibilityLabel="Add block below" />
        <IconButton icon={ArrowUpIcon} onPress={() => onMove(-1)} disabled={first} accessibilityLabel="Move block up" />
        <IconButton icon={ArrowDownIcon} onPress={() => onMove(1)} disabled={last} accessibilityLabel="Move block down" />
        <IconButton icon={DeleteIcon} onPress={onDelete} disabled={!canDelete} accessibilityLabel="Delete block" />
        <IconButton icon={MoreIcon} onPress={onMore} accessibilityLabel="Block options" />
      </ScrollView>
    </View>
  );
}
