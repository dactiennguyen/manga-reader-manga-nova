import { useState, useSyncExternalStore } from 'react';
import { Linking, Platform, View } from 'react-native';
import { DoneIcon, FlagIcon, MailIcon } from '../../ui/icons';

import { version } from '../../../package.json';
import { getLocale, t } from '../../core/i18n';
import { APP_NAME, SUPPORT_EMAIL } from '../../core/model/constants';
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  buildReportMail,
  useAiReports,
  type AiFeature,
  type AiReport,
  type ReportReason,
} from '../../state/useAiReports';
import { Button, Chip, ChipGroup, FieldLabel, Sheet, SwitchRow, Text, TextField } from '../../ui';

export type ReportRequest = {
  /** The AI answer as shown. */
  text: string;
  feature: AiFeature;
  /** A chat message id, so the chat can fold the answer away. */
  answerId?: string;
};

type Entry = ReportRequest & { key: number };

let entry: Entry | null = null;
let nextKey = 0;
const listeners = new Set<() => void>();

function setEntry(next: Entry | null): void {
  entry = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Opens the report sheet for one AI answer. Works from any screen or sheet. */
export function reportAiAnswer(request: ReportRequest): void {
  if (!request.text.trim()) {
    return;
  }
  setEntry({ ...request, key: ++nextKey });
}

/** Opens the mail app with the report; false when no mail app took it. */
function sendToDeveloper(report: AiReport): Promise<boolean> {
  const mail = buildReportMail(SUPPORT_EMAIL, report, {
    appName: APP_NAME,
    appVersion: version,
    platform: `${Platform.OS} ${Platform.Version}`,
    language: getLocale(),
  });
  return Linking.openURL(mail.url).then(
    () => true,
    () => false,
  );
}

/** Mounted once at the root, beside the toast and confirm hosts. */
export function ReportHost() {
  const current = useSyncExternalStore(subscribe, () => entry);
  const [closedKey, setClosedKey] = useState(0);
  const close = () => setClosedKey(current?.key ?? 0);

  return (
    <Sheet
      visible={!!current && current.key !== closedKey}
      onClose={close}
      onClosed={() => {
        if (entry?.key === closedKey) {
          setEntry(null);
        }
      }}
      title={t('Report AI answer')}
      subtitle={t('Tell us what is wrong with this answer')}
    >
      {!!current && (
        <ReportForm key={current.key} request={current} onDone={close} />
      )}
    </Sheet>
  );
}

function ReportForm({ request, onDone }: { request: ReportRequest; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [send, setSend] = useState(false);
  const [saved, setSaved] = useState<AiReport | null>(null);
  const [mailFailed, setMailFailed] = useState(false);
  const canMail = SUPPORT_EMAIL.trim() !== '';

  const submit = () => {
    if (!reason) {
      return;
    }
    const report = useAiReports.getState().add({
      feature: request.feature,
      reason,
      note,
      text: request.text,
      answerId: request.answerId,
    });
    setSaved(report);
  };

  // The thanks shows inside this sheet: a toast would sit under the AI sheet the report came from.
  if (saved) {
    const finish = async () => {
      if (canMail && send && !mailFailed && !(await sendToDeveloper(saved))) {
        setMailFailed(true);
        return;
      }
      onDone();
    };
    return (
      <View className="gap-4 px-4 pb-2" accessibilityLiveRegion="polite">
        <Text variant="body">{t('Thanks. Your report helps keep the AI safe.')}</Text>
        {mailFailed && (
          <Text variant="bodySmall" tone="danger">
            {t('Could not open your email app')}
          </Text>
        )}
        <Button title={t('Done')} icon={DoneIcon} onPress={finish} />
      </View>
    );
  }

  return (
    <View className="gap-4 px-4 pb-2">
      <View className="rounded-md bg-surface p-3">
        <Text variant="bodySmall" tone="secondary" numberOfLines={4}>
          {request.text.trim()}
        </Text>
      </View>
      <View className="gap-1">
        <FieldLabel>{t('What is wrong?')}</FieldLabel>
        <ChipGroup>
          {REPORT_REASONS.map(item => (
            <Chip key={item.id} label={t(item.label)} selected={reason === item.id} onPress={() => setReason(item.id)} />
          ))}
        </ChipGroup>
      </View>
      <View className="gap-1">
        <FieldLabel>{t('Note (optional)')}</FieldLabel>
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder={t('Anything that helps us understand')}
          accessibilityLabel={t('Note (optional)')}
          multiline
          maxLength={REPORT_NOTE_MAX}
          textAlignVertical="top"
          inputClassName="min-h-16"
        />
      </View>
      {canMail ? (
        <View className="overflow-hidden rounded-lg bg-surface">
          <SwitchRow
            icon={MailIcon}
            title={t('Also send to the developer')}
            subtitle={t('Opens your email app with the report filled in')}
            value={send}
            onValueChange={setSend}
          />
        </View>
      ) : (
        <Text variant="caption" tone="muted">
          {t('The report is saved on this device.')}
        </Text>
      )}
      <Button title={t('Report')} icon={FlagIcon} disabled={!reason} onPress={submit} />
    </View>
  );
}
