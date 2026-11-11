import { CheckIcon, LayersIcon, MoreIcon, RedoIcon, UndoIcon } from '../../ui/icons';
import { memo, useEffect } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ID } from '../../core/model/types';
import { t } from '../../core/i18n';
import { canRedoArt, canUndoArt, redoArt, undoArt, useArtRev } from '../../state/artStore';
import { IconButton, Text } from '../../ui';

/** Renders nothing and stays mounted, so the screen hears about art changes without re-rendering for them. */
export const ArtRevWatcher = memo(function ArtRevWatcherInner({ panelId, onRev }: { panelId: ID; onRev: () => void }) {
  const rev = useArtRev(panelId);
  useEffect(onRev, [onRev, rev]);
  return null;
});

/** Subscribes on its own, so a new stroke re-renders these two buttons and nothing else. */
const HistoryButtons = memo(function HistoryButtonsInner({ panelId }: { panelId: ID }) {
  useArtRev(panelId);
  return (
    <>
      <IconButton
        icon={UndoIcon}
        onPress={() => undoArt(panelId)}
        disabled={!canUndoArt(panelId)}
        accessibilityLabel={t('Undo')}
      />
      <IconButton
        icon={RedoIcon}
        onPress={() => redoArt(panelId)}
        disabled={!canRedoArt(panelId)}
        accessibilityLabel={t('Redo')}
      />
    </>
  );
});

export function CanvasTopBar({
  title,
  panelId,
  layersOpen,
  fade,
  onDone,
  onLayers,
  onMore,
  onLayout,
}: {
  title: string;
  panelId: ID;
  layersOpen: boolean;
  fade: StyleProp<AnimatedStyle<ViewStyle>>;
  onDone: () => void;
  onLayers: () => void;
  onMore: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      className="absolute left-2 right-2 flex-row items-center rounded-lg bg-raised px-1"
      style={[{ top: insets.top }, fade]}
    >
      <IconButton icon={CheckIcon} onPress={onDone} accessibilityLabel={t('Done')} />
      <View pointerEvents="none" className="flex-1 px-2">
        <Text variant="title" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
      </View>
      <HistoryButtons panelId={panelId} />
      <IconButton icon={LayersIcon} onPress={onLayers} active={layersOpen} accessibilityLabel={t('Layers')} />
      <IconButton icon={MoreIcon} onPress={onMore} accessibilityLabel={t('More')} />
    </Animated.View>
  );
}
