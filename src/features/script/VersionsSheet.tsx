import { useMemo } from 'react';
import { View } from 'react-native';

import type { ID } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { formatRelative } from '../../core/util/time';
import { listScriptVersions, type ScriptVersion } from '../../state/scriptHistory';
import { Button, Divider, Sheet, Text } from '../../ui';

export function VersionsSheet({
  visible,
  chapterId,
  onClose,
  onRestore,
}: {
  visible: boolean;
  chapterId: ID;
  onClose: () => void;
  onRestore: (version: ScriptVersion) => void;
}) {
  const versions = useMemo(() => (visible ? listScriptVersions(chapterId) : []), [visible, chapterId]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Version history" subtitle="Saved each time you open or leave the script">
      <View className="px-4 pb-6">
        {versions.length === 0 && (
          <Text tone="muted" className="py-4">
            No versions yet. One is saved each time you open or leave the script.
          </Text>
        )}
        {versions.map((version, index) => {
          const blocks = version.scenes.reduce((sum, scene) => sum + scene.blocks.length, 0);
          const first = version.scenes.flatMap(scene => scene.blocks).find(block => block.text.trim());
          return (
            <View key={version.at}>
              {index > 0 && <Divider />}
              <View className="flex-row items-center gap-3 py-3">
                <View className="flex-1 gap-0.5">
                  <Text variant="label">{formatRelative(version.at)}</Text>
                  <Text variant="caption" tone="muted">
                    {plural(version.scenes.length, 'scene')} · {plural(blocks, 'block')}
                  </Text>
                  {first && (
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {first.text.trim()}
                    </Text>
                  )}
                </View>
                <Button title="Restore" variant="secondary" small onPress={() => onRestore(version)} />
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
