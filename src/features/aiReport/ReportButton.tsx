import { FlagIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { ICON, IconButton } from '../../ui';
import { reportAiAnswer, type ReportRequest } from './ReportHost';

/** A small flag beside an AI answer. Opens the report sheet. */
export function ReportAiButton({ text, feature, answerId, className }: ReportRequest & { className?: string }) {
  return (
    <IconButton
      icon={FlagIcon}
      size={ICON.md}
      color="text-secondary"
      disabled={!text.trim()}
      onPress={() => reportAiAnswer({ text, feature, answerId })}
      accessibilityLabel={t('Report AI answer')}
      className={className}
    />
  );
}
