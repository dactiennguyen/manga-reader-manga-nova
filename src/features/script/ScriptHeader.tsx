import { View } from 'react-native';
import { MinimizeIcon, MoreIcon, RedoIcon, UndoIcon } from '../../ui/icons';

import { AppBar, IconButton, Text } from '../../ui';

export function ScriptHeader({
  focusMode,
  title,
  stats,
  saving,
  canUndo,
  canRedo,
  onBack,
  onUndo,
  onRedo,
  onExitFocus,
  onMore,
}: {
  focusMode: boolean;
  title: string;
  stats: string;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExitFocus: () => void;
  onMore: () => void;
}) {
  if (focusMode) {
    return (
      <View className="flex-row justify-end px-2">
        <IconButton icon={UndoIcon} onPress={onUndo} disabled={!canUndo} accessibilityLabel="Undo" />
        <IconButton icon={MinimizeIcon} onPress={onExitFocus} accessibilityLabel="Exit focus mode" />
      </View>
    );
  }
  return (
    <>
      <AppBar
        title="Script"
        subtitle={title}
        onBack={onBack}
        right={
          <>
            <IconButton icon={UndoIcon} onPress={onUndo} disabled={!canUndo} accessibilityLabel="Undo" />
            <IconButton icon={RedoIcon} onPress={onRedo} disabled={!canRedo} accessibilityLabel="Redo" />
            <IconButton icon={MoreIcon} onPress={onMore} accessibilityLabel="More" />
          </>
        }
      />
      <View className="flex-row justify-between px-4 pb-2">
        <Text variant="caption" tone="muted">
          {stats}
        </Text>
        <Text variant="caption" tone={saving ? 'muted' : 'success'}>
          {saving ? 'Saving…' : 'Saved ✓'}
        </Text>
      </View>
    </>
  );
}
