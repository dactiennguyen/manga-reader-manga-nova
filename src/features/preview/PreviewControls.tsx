import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretDownIcon, CloseIcon, FlagIcon, MoreIcon, PenLineIcon } from '../../ui/icons';

import { Button, Icon, IconButton, PANEL_SHADOW, Pressable, Slider, Text } from '../../ui';

export function PageCounter({ label }: { label: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      className="absolute right-2 rounded-sm bg-raised/80 px-2 py-0.5"
      style={{ bottom: insets.bottom + 8 }}
    >
      <Text variant="mono">{label}</Text>
    </View>
  );
}

export function ReaderTopBar({
  chapterTitle,
  flagged,
  canFlag,
  flagCount,
  onClose,
  onChapters,
  onFlag,
  onMore,
}: {
  chapterTitle: string;
  flagged: boolean;
  canFlag: boolean;
  flagCount: number;
  onClose: () => void;
  onChapters: () => void;
  onFlag: () => void;
  onMore: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute inset-x-2 flex-row items-center gap-1 rounded-xl bg-raised p-1"
      style={{ top: insets.top + 8, boxShadow: PANEL_SHADOW }}
    >
      <IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel="Close preview" />
      <Pressable
        accessibilityLabel={`${chapterTitle}, choose a chapter`}
        onPress={onChapters}
        className="h-12 flex-1 flex-row items-center gap-1 overflow-hidden rounded-md px-2"
      >
        <Text variant="label" numberOfLines={1} className="shrink">
          {chapterTitle}
        </Text>
        <Icon icon={CaretDownIcon} size={16} color="text-muted" />
      </Pressable>
      <IconButton
        icon={FlagIcon}
        active={flagged}
        disabled={!canFlag}
        onPress={onFlag}
        accessibilityLabel="Flag this page"
      />
      <IconButton
        icon={MoreIcon}
        badge={flagCount || undefined}
        onPress={onMore}
        accessibilityLabel="More options"
      />
    </View>
  );
}

export function ReaderBottomBar({
  label,
  sliderCount,
  sliderValue,
  canEdit,
  onSeek,
  onEdit,
}: {
  label: string;
  sliderCount: number;
  sliderValue: number;
  canEdit: boolean;
  onSeek: (value: number) => void;
  onEdit: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute inset-x-2 gap-2 rounded-xl bg-raised p-3"
      style={{ bottom: insets.bottom + 8, boxShadow: PANEL_SHADOW }}
    >
      <View className="flex-row items-center gap-3">
        {sliderCount > 1 && (
          <Slider
            className="flex-1"
            label="Page"
            min={1}
            max={sliderCount}
            step={1}
            value={sliderValue}
            onComplete={onSeek}
          />
        )}
        <Text variant="mono" className="min-w-14 text-right">
          {label}
        </Text>
      </View>
      <Button title="Edit this page" icon={PenLineIcon} variant="secondary" small disabled={!canEdit} onPress={onEdit} />
    </View>
  );
}
