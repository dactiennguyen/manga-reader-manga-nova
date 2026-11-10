import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import type { ID } from '../../core/model/types';
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
    <Sheet visible={visible} onClose={onClose} title={t('Version history')} subtitle={t('Saved each time you open or leave the script')}>
      <View className="px-4 pb-6">
        {versions.length === 0 && (
          <Text tone="muted" className="py-4">
            {t('No versions yet. One is saved each time you open or leave the script.')}
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
                    {tn(version.scenes.length, '{count} scene', '{count} scenes')} · {tn(blocks, '{count} block', '{count} blocks')}
                  </Text>
                  {first && (
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {first.text.trim()}
                    </Text>
                  )}
                </View>
                <Button title={t('Restore')} variant="secondary" small onPress={() => onRestore(version)} />
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
