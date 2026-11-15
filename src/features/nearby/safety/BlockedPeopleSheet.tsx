import { useRef } from 'react';
import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { formatRelative } from '../../../core/util/time';
import { PERSON_REPORT_REASONS, useNearbySafety } from '../../../state/useNearbySafety';
import { Button, Sheet, Text, confirm } from '../../../ui';
import { DeleteIcon } from '../../../ui/icons';

const reasonLabel = (id: string) => t(PERSON_REPORT_REASONS.find(item => item.id === id)?.label ?? id);

/** From Profile: people blocked in Play together, to unblock, and the reports made about people. */
export function BlockedPeopleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const blocked = useNearbySafety(s => s.blocked);
  const reports = useNearbySafety(s => s.reports);
  // A confirm dialog cannot open over the sheet on iOS, so the sheet closes first.
  const afterClose = useRef<(() => void) | null>(null);

  const clearReports = async () => {
    const ok = await confirm(t('Clear all reports?'), t('This removes the list from this device. Blocked people stay blocked.'), {
      confirmText: t('Clear'),
      destructive: true,
    });
    if (ok) {
      useNearbySafety.getState().clearReports();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const run = afterClose.current;
        afterClose.current = null;
        run?.();
      }}
      title={t('Blocked and reported people')}
      subtitle={t('Saved on this device only')}
    >
      <View className="gap-3 px-4 pb-2">
        <Text variant="label">{t('Blocked')}</Text>
        {blocked.length === 0 && (
          <Text tone="secondary" className="py-2">
            {t('You have not blocked anyone.')}
          </Text>
        )}
        {blocked.map(person => (
          <View key={person.key} className="min-h-12 flex-row items-center gap-3 rounded-md bg-surface px-3 py-2">
            <View className="flex-1">
              <Text numberOfLines={1}>{person.name || t('Unnamed')}</Text>
              <Text variant="caption" tone="muted">
                {formatRelative(person.at)}
              </Text>
            </View>
            <Button title={t('Unblock')} variant="secondary" onPress={() => useNearbySafety.getState().unblock(person.key)} />
          </View>
        ))}
        <Text variant="label" className="pt-2">
          {t('Reports')}
        </Text>
        {reports.length === 0 && (
          <Text tone="secondary" className="py-2">
            {t('You have not reported anyone.')}
          </Text>
        )}
        {reports.map(report => (
          <View key={report.id} className="gap-1 rounded-md bg-surface p-3">
            <Text variant="label">{`${report.name || t('Unnamed')} · ${reasonLabel(report.reason)}`}</Text>
            <Text variant="caption" tone="muted">
              {formatRelative(report.createdAt)}
            </Text>
            {!!report.note && <Text variant="bodySmall">{report.note}</Text>}
          </View>
        ))}
        {reports.length > 0 && (
          <Button
            title={t('Clear all reports')}
            icon={DeleteIcon}
            variant="danger"
            onPress={() => {
              afterClose.current = clearReports;
              onClose();
            }}
          />
        )}
      </View>
    </Sheet>
  );
}
