import type { ReactNode } from 'react';
import { FlatList, Image, View } from 'react-native';
import { CheckIcon, DeleteIcon } from '../../ui/icons';

import type { ExportRecord } from '../../core/export/history';
import type { ExportFormat } from '../../core/export/plan';
import type { ID } from '../../core/model/types';
import { formatBytes } from '../../core/util/format';
import { formatRelative } from '../../core/util/time';
import { useThumb } from '../../render/thumbs';
import { Divider, ICON, Icon, IconButton, ListItem, Pressable, Text, type IconGlyph } from '../../ui';

export const FORMAT_LABEL: Record<ExportFormat, string> = { png: 'PNG', pdf: 'PDF', cbz: 'CBZ', long: 'Long image' };

export function FormatCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: {
  icon: IconGlyph;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-12 grow basis-[47%] gap-1 overflow-hidden rounded-lg p-3 ${
        selected ? 'bg-accent/15' : 'bg-surface'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={icon} size={ICON.md} color={selected ? 'accent' : 'text'} />
        <Text variant="label" tone={selected ? 'accent' : 'text'} className="flex-1">
          {title}
        </Text>
        {selected && <Icon icon={CheckIcon} size={ICON.sm} color="accent" />}
      </View>
      <Text variant="caption" tone="secondary">
        {description}
      </Text>
    </Pressable>
  );
}

export function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-2">
      <Text variant="label" className="w-24">
        {label}
      </Text>
      <View className="flex-1">{children}</View>
    </View>
  );
}

function Thumb({ pageId, index }: { pageId: ID; index: number }) {
  const uri = useThumb(pageId);
  return (
    <View className="items-center gap-0.5">
      <View className="h-[90px] w-16 overflow-hidden rounded-sm bg-overlay">
        {uri && (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`Page ${index + 1}`}
            source={{ uri }}
            resizeMode="cover"
            className="h-full w-full"
          />
        )}
      </View>
      <Text variant="caption" tone="muted">
        {index + 1}
      </Text>
    </View>
  );
}

export function ThumbStrip({ pageIds }: { pageIds: ID[] }) {
  return (
    <FlatList
      horizontal
      data={pageIds}
      keyExtractor={id => id}
      renderItem={({ item, index }) => <Thumb pageId={item} index={index} />}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={6}
      windowSize={5}
      contentContainerClassName="gap-2 py-1"
    />
  );
}

export function HistoryList({
  items,
  missing,
  onPress,
  onDelete,
}: {
  items: ExportRecord[];
  missing: Record<string, boolean>;
  onPress: (item: ExportRecord) => void;
  onDelete: (item: ExportRecord) => void;
}) {
  return (
    <View className="overflow-hidden rounded-lg bg-surface">
      {items.map((item, index) => {
        const gone = !!missing[item.path];
        return (
          <View key={item.path + item.createdAt}>
            {index > 0 && <Divider inset={16} />}
            <View className="flex-row items-center pr-1">
              <View className="flex-1">
                <ListItem
                  title={item.fileName}
                  subtitle={
                    gone
                      ? 'File deleted'
                      : `${FORMAT_LABEL[item.format]} · ${formatBytes(item.size)} · ${formatRelative(item.createdAt)}`
                  }
                  disabled={gone}
                  onPress={() => onPress(item)}
                />
              </View>
              <IconButton
                icon={DeleteIcon}
                size={ICON.md}
                color="text-muted"
                onPress={() => onDelete(item)}
                accessibilityLabel={`Delete ${item.fileName}`}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
