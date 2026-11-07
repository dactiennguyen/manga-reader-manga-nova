import { Image, View } from 'react-native';
import { ChapterIcon, EventIcon, FlagIcon, NoteIcon, PlaceIcon } from '../../ui/icons';

import type { WorldEntry, WorldType } from '../../core/model/types';
import { fileUri } from '../../core/util/paths';
import { UNTITLED, firstLine } from '../../core/world/worldTools';
import { Card, Icon, Text, type IconGlyph } from '../../ui';

export const WORLD_TYPE_ICON: Record<WorldType, IconGlyph> = {
  place: PlaceIcon,
  faction: FlagIcon,
  term: ChapterIcon,
  event: EventIcon,
  note: NoteIcon,
};

export function EntryThumb({ entry, size = 48 }: { entry: WorldEntry; size?: number }) {
  const image = entry.images[0];
  return (
    <View className="items-center justify-center overflow-hidden rounded-sm bg-overlay" style={{ width: size, height: size }}>
      {image ? (
        <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(image) }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <Icon icon={WORLD_TYPE_ICON[entry.type]} size={size * 0.45} color="text-secondary" />
      )}
    </View>
  );
}

export function EntryRow({ entry, onPress, onLongPress }: { entry: WorldEntry; onPress: () => void; onLongPress: () => void }) {
  const title = entry.title.trim() || UNTITLED;
  const line = firstLine(entry.body) || 'No description yet';
  return (
    <Card
      accessibilityLabel={`${title}, ${line}`}
      onPress={onPress}
      onLongPress={onLongPress}
      className="mb-3 flex-row items-center gap-3 p-3"
    >
      <EntryThumb entry={entry} />
      <View className="flex-1 gap-0.5">
        <Text variant="heading" tone={entry.title.trim() ? 'text' : 'muted'} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Card>
  );
}
