import { View } from 'react-native';
import { EllipsisVertical, Minimize2, Redo2, Undo2 } from 'lucide-react-native';

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
        <IconButton icon={Undo2} onPress={onUndo} disabled={!canUndo} accessibilityLabel="Undo" />
        <IconButton icon={Minimize2} onPress={onExitFocus} accessibilityLabel="Exit focus mode" />
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
            <IconButton icon={Undo2} onPress={onUndo} disabled={!canUndo} accessibilityLabel="Undo" />
            <IconButton icon={Redo2} onPress={onRedo} disabled={!canRedo} accessibilityLabel="Redo" />
            <IconButton icon={EllipsisVertical} onPress={onMore} accessibilityLabel="More" />
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
