import { View } from 'react-native';
import { SaveIcon, ShareIcon } from '../../ui/icons';

import type { ExportRecord } from '../../core/export/history';
import { t } from '../../core/i18n';
import { formatBytes } from '../../core/util/format';
import { Button, ProgressBar, Text } from '../../ui';
import { FORMAT_LABEL } from './ExportParts';
import type { ExportPhase } from './useExportScreen';

export function ExportStatus({
  phase,
  onCancel,
  onRetry,
  onShare,
  onSave,
}: {
  phase: ExportPhase;
  onCancel: () => void;
  onRetry: () => void;
  onShare: (item: ExportRecord) => void;
  onSave: (item: ExportRecord) => void;
}) {
  if (phase.kind === 'running') {
    return (
      <View accessibilityLiveRegion="polite" className="gap-2 rounded-lg bg-surface p-3">
        <Text variant="label">
          {t('Exporting page {n}/{total}', { n: Math.min(phase.done + 1, phase.total), total: phase.total })}
        </Text>
        <ProgressBar value={phase.total ? phase.done / phase.total : 0} />
        <Button title={t('Cancel')} variant="secondary" small onPress={onCancel} />
      </View>
    );
  }
  if (phase.kind === 'done') {
    return (
      <View accessibilityLiveRegion="polite" className="gap-2 rounded-lg bg-surface p-3">
        <Text variant="caption" tone="success">
          {t('Export complete')}
        </Text>
        <Text variant="heading">{phase.result.fileName}</Text>
        <Text variant="caption" tone="secondary">
          {t(FORMAT_LABEL[phase.result.format])} · {formatBytes(phase.result.size)}
        </Text>
        <View className="mt-1 flex-row gap-2">
          <Button title={t('Share')} icon={ShareIcon} className="flex-1" onPress={() => onShare(phase.result)} />
          <Button
            title={t('Save to device')}
            icon={SaveIcon}
            variant="secondary"
            className="flex-1"
            onPress={() => onSave(phase.result)}
          />
        </View>
      </View>
    );
  }
  if (phase.kind === 'error') {
    return (
      <View accessibilityLiveRegion="assertive" className="gap-2 rounded-lg bg-danger/15 p-3">
        <Text variant="caption" tone="danger">
          {t('Export failed')}
        </Text>
        <Text>{phase.message}</Text>
        <Button title={t('Try again')} variant="secondary" small onPress={onRetry} />
      </View>
    );
  }
  return null;
}
