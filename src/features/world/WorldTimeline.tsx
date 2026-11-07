import { useMemo } from 'react';
import { View } from 'react-native';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

import type { Chapter, ID, WorldEntry } from '../../core/model/types';
import { UNTITLED, firstLine, timelineGroups, timelineSwap } from '../../core/world/worldTools';
import { undoable, useStory } from '../../state/useStory';
import { IconButton, Pressable, Text } from '../../ui';

function move(items: WorldEntry[], index: number, delta: -1 | 1) {
  const changes = timelineSwap(items, index, delta);
  if (!changes.length) {
    return;
  }
  const { updateWorldEntry } = useStory.getState();
  undoable({ undoScope: `project:${items[index].projectId}` }, () => {
    changes.forEach(change => updateWorldEntry(change.id, { order: change.order }));
  });
}

export function WorldTimeline({
  events,
  chapters,
  onOpen,
  onLongPress,
}: {
  events: WorldEntry[];
  chapters: Chapter[];
  onOpen: (entryId: ID) => void;
  onLongPress: (entryId: ID) => void;
}) {
  const groups = useMemo(() => timelineGroups(events, chapters), [events, chapters]);
  return (
    <View>
      {groups.map(group => (
        <View key={group.key} className="mb-3">
          <Text variant="heading" tone={group.key === 'none' ? 'muted' : 'text'} className="mb-2">
            {group.label}
          </Text>
          {group.items.map((entry, index) => {
            const title = entry.title.trim() || UNTITLED;
            const line = firstLine(entry.body);
            return (
              <View key={entry.id} className="flex-row items-stretch">
                <View className="w-7 items-center">
                  <View className="absolute bottom-0 top-0 w-0.5 bg-divider" />
                  <View className="mt-4 h-3.5 w-3.5 rounded-full bg-accent" />
                </View>
                <View className="mb-2 flex-1 flex-row items-center overflow-hidden rounded-md bg-surface">
                  <Pressable
                    accessibilityLabel={line ? `${title}, ${line}` : title}
                    onPress={() => onOpen(entry.id)}
                    onLongPress={() => onLongPress(entry.id)}
                    className="min-h-14 flex-1 justify-center gap-0.5 py-2 pl-3"
                  >
                    <Text variant="label" tone={entry.title.trim() ? 'text' : 'muted'} numberOfLines={1}>
                      {title}
                    </Text>
                    {!!line && (
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {line}
                      </Text>
                    )}
                  </Pressable>
                  <IconButton
                    icon={ArrowUp}
                    size={18}
                    disabled={index === 0}
                    onPress={() => move(group.items, index, -1)}
                    accessibilityLabel="Move up"
                  />
                  <IconButton
                    icon={ArrowDown}
                    size={18}
                    disabled={index === group.items.length - 1}
                    onPress={() => move(group.items, index, 1)}
                    accessibilityLabel="Move down"
                  />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
