import { View } from 'react-native';
import { DeleteIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { formatRelative } from '../../core/util/time';
import { AI_FEATURE_LABEL, REPORT_REASONS, useAiReports } from '../../state/useAiReports';
import { Button, Sheet, Text, confirm } from '../../ui';

const reasonLabel = (id: string) => t(REPORT_REASONS.find(item => item.id === id)?.label ?? id);

/** The AI answers reported on this device, from Profile. */
export function ReportsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const reports = useAiReports(s => s.reports);

  const clearAll = async () => {
    const ok = await confirm(t('Clear all reports?'), t('This removes the list from this device. Hidden answers show again.'), {
      confirmText: t('Clear'),
      destructive: true,
    });
    if (ok) {
      useAiReports.getState().clear();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('Reported AI answers')} subtitle={t('Saved on this device only')}>
      <View className="gap-3 px-4 pb-2">
        {reports.length === 0 && (
          <Text tone="secondary" className="py-6 text-center">
            {t('You have not reported any AI answers.')}
          </Text>
        )}
        {reports.map(report => (
          <View key={report.id} className="gap-1 rounded-md bg-surface p-3">
            <Text variant="label">{reasonLabel(report.reason)}</Text>
            <Text variant="caption" tone="muted">
              {`${t(AI_FEATURE_LABEL[report.feature])} · ${formatRelative(report.createdAt)}`}
            </Text>
            {!!report.note && <Text variant="bodySmall">{report.note}</Text>}
            <Text variant="bodySmall" tone="secondary" numberOfLines={3}>
              {report.text}
            </Text>
          </View>
        ))}
        {reports.length > 0 && <Button title={t('Clear all reports')} icon={DeleteIcon} variant="danger" onPress={clearAll} />}
      </View>
    </Sheet>
  );
}
