import { useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { version } from '../../../../package.json';
import { getLocale, t } from '../../../core/i18n';
import { APP_NAME, SUPPORT_EMAIL } from '../../../core/model/constants';
import type { Activity, Member } from '../../../core/nearby/types';
import {
  PERSON_NOTE_MAX,
  PERSON_REPORT_REASONS,
  buildPersonReportMail,
  useNearbySafety,
  type PersonReport,
  type PersonReportReason,
} from '../../../state/useNearbySafety';
import { useRoom } from '../../../state/useRoom';
import { Button, Chip, ChipGroup, FieldLabel, ListItem, Sheet, SwitchRow, Text, TextField, confirm, toast } from '../../../ui';
import { BlockPersonIcon, DoneIcon, FlagIcon, MailIcon, RemovePersonIcon } from '../../../ui/icons';

type Step = 'actions' | 'report' | 'done';

/** Opens the mail app with the report; false when no mail app took it. */
function mailDeveloper(report: PersonReport): Promise<boolean> {
  const mail = buildPersonReportMail(SUPPORT_EMAIL, report, {
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

/**
 * What can be done about someone in the room: the host can take them out, anyone can block or report them.
 * Opened from their name in the room list.
 */
export function MemberSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [step, setStep] = useState<Step>('actions');
  // A confirm dialog cannot open over the sheet on iOS: the sheet closes first, then the step runs.
  const afterClose = useRef<(() => void) | null>(null);
  const thenClose = (run: () => void) => {
    afterClose.current = run;
    onClose();
  };
  return (
    <Sheet
      visible={!!member}
      onClose={onClose}
      onClosed={() => {
        setStep('actions');
        const run = afterClose.current;
        afterClose.current = null;
        run?.();
      }}
      title={member?.name}
      subtitle={step === 'report' ? t('Tell us what happened') : undefined}
    >
      {!!member &&
        (step === 'actions' ? (
          <Actions member={member} onReport={() => setStep('report')} thenClose={thenClose} />
        ) : (
          <ReportForm member={member} onDone={onClose} thenClose={thenClose} done={step === 'done'} onSaved={() => setStep('done')} />
        ))}
    </Sheet>
  );
}

function Actions({ member, onReport, thenClose }: { member: Member; onReport: () => void; thenClose: (run: () => void) => void }) {
  const me = useRoom(s => s.me);
  const removeMember = useRoom(s => s.removeMember);
  const leaveRoom = useRoom(s => s.leaveRoom);
  const blocked = useNearbySafety(s => s.isBlocked(member.key));
  const isHost = !!me?.host;

  const remove = async () => {
    const ok = await confirm(t('Remove {name} from the room?', { name: member.name }), t('They are disconnected and cannot join this room again.'), {
      confirmText: t('Remove'),
      destructive: true,
    });
    if (ok && removeMember(member.id)) {
      toast(t('{name} was removed from the room', { name: member.name }));
    }
  };

  const block = async () => {
    if (!member.key) {
      return;
    }
    const message = isHost
      ? t('They are removed from this room and cannot join rooms you host.')
      : member.host
        ? t('They host this room, so you will leave it. You will not be able to join rooms they host.')
        : t('They cannot join rooms you host. When they are in a room with you, you will be told so you can leave.');
    const ok = await confirm(t('Block {name}?', { name: member.name }), message, { confirmText: t('Block|person'), destructive: true });
    if (!ok) {
      return;
    }
    useNearbySafety.getState().block(member.key, member.name);
    toast(t('{name} is blocked', { name: member.name }));
    if (isHost) {
      removeMember(member.id);
    } else if (member.host) {
      leaveRoom();
    }
  };

  const unblock = () => {
    if (member.key) {
      useNearbySafety.getState().unblock(member.key);
      toast(t('{name} is unblocked', { name: member.name }));
    }
  };

  return (
    <View className="pb-2">
      {isHost && !member.host && (
        <ListItem icon={RemovePersonIcon} title={t('Remove from room')} subtitle={t('They cannot join this room again')} destructive onPress={() => thenClose(remove)} />
      )}
      {!!member.key &&
        (blocked ? (
          <ListItem icon={BlockPersonIcon} title={t('Unblock')} subtitle={t('Blocked on this phone')} onPress={unblock} />
        ) : (
          <ListItem
            icon={BlockPersonIcon}
            title={t('Block|person')}
            subtitle={!isHost && member.host ? t('You will leave this room') : t('Keep them out of rooms you host')}
            destructive
            onPress={() => thenClose(block)}
          />
        ))}
      <ListItem icon={FlagIcon} title={t('Report')} subtitle={t('Something they drew, wrote or said')} chevron onPress={onReport} />
    </View>
  );
}

function ReportForm({
  member,
  done,
  onSaved,
  onDone,
  thenClose,
}: {
  member: Member;
  done: boolean;
  onSaved: () => void;
  onDone: () => void;
  thenClose: (run: () => void) => void;
}) {
  const activity: Activity = useRoom(s => s.room?.activity ?? 'lobby');
  const isHost = useRoom(s => !!s.me?.host);
  const removeMember = useRoom(s => s.removeMember);
  const leaveRoom = useRoom(s => s.leaveRoom);
  const [reason, setReason] = useState<PersonReportReason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [send, setSend] = useState(false);
  const [saved, setSaved] = useState<PersonReport | null>(null);
  const [mailFailed, setMailFailed] = useState(false);
  const [blockedHost, setBlockedHost] = useState(false);
  const canMail = SUPPORT_EMAIL.trim() !== '';
  const canBlock = !!member.key && !useNearbySafety.getState().isBlocked(member.key);

  const submit = () => {
    if (!reason) {
      return;
    }
    const safety = useNearbySafety.getState();
    setSaved(safety.report({ name: member.name, key: member.key, reason, note, activity }));
    if (alsoBlock && canBlock && member.key) {
      safety.block(member.key, member.name);
      if (isHost) {
        removeMember(member.id);
      } else if (member.host) {
        // Blocking the host means leaving their room, once the thanks has been read.
        setBlockedHost(true);
      }
    }
    onSaved();
  };

  if (done && saved) {
    const finish = async () => {
      if (canMail && send && !mailFailed && !(await mailDeveloper(saved))) {
        setMailFailed(true);
        return;
      }
      if (blockedHost) {
        thenClose(leaveRoom);
      } else {
        onDone();
      }
    };
    return (
      <View className="gap-4 px-4 pb-2" accessibilityLiveRegion="polite">
        <Text variant="body">{t('Thanks for telling us. The report is saved on this phone.')}</Text>
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
      <View className="gap-1">
        <FieldLabel>{t('What is wrong?')}</FieldLabel>
        <ChipGroup>
          {PERSON_REPORT_REASONS.map(item => (
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
          maxLength={PERSON_NOTE_MAX}
          textAlignVertical="top"
          inputClassName="min-h-16"
        />
      </View>
      <View className="overflow-hidden rounded-lg bg-surface">
        {canBlock && (
          <SwitchRow
            icon={BlockPersonIcon}
            title={t('Also block {name}', { name: member.name })}
            subtitle={isHost ? t('They are removed from this room') : member.host ? t('You will leave this room') : t('Keep them out of rooms you host')}
            value={alsoBlock}
            onValueChange={setAlsoBlock}
          />
        )}
        {canMail && (
          <SwitchRow
            icon={MailIcon}
            title={t('Also send to the developer')}
            subtitle={t('Opens your email app with the report filled in')}
            value={send}
            onValueChange={setSend}
          />
        )}
      </View>
      <Button title={t('Report')} icon={FlagIcon} disabled={!reason} onPress={submit} />
    </View>
  );
}
