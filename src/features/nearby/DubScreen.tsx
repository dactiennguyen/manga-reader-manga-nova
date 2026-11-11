import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { castOf, voiceOf } from '../../core/nearby/dub';
import { progressOf } from '../../core/nearby/dubClips';
import { voicedLines } from '../../core/nearby/dubPlay';
import { openAppSettings } from '../../native/audio';
import { shareFile } from '../../native/files';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { useStory } from '../../state/useStory';
import { AppBar, Banner, Button, EmptyState, ProgressBar, Screen, SectionHeader, Text, toast } from '../../ui';
import { ChapterIcon, SendIcon, ShareIcon, TimeIcon } from '../../ui/icons';
import { ChapterPicker } from './dub/ChapterPicker';
import { DubPlayer } from './dub/DubPlayer';
import { LineCard } from './dub/LineCard';
import { RolesCard } from './dub/RolesCard';
import { exportDubAudio } from './dub/dubExport';
import { useDubSession } from './dub/useDubSession';
import { useRecorder } from './dub/useRecorder';

/**
 * Dub together: give every bubble of a chapter a real voice. In a room the host deals the roles and
 * everyone records their own lines, which come back to the host; alone, the author voices them all.
 */
export function DubScreen() {
  const navigation = useAppNavigation();
  const route = useAppRoute<'Dub'>();
  const session = useDubSession(route.params?.chapterId);
  const { mode, script, clips, roles, members, hostId, myName, myLines } = session;
  const characters = useStory(state => state.characters);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [changing, setChanging] = useState(false);

  const textOf = useCallback((bubbleId: string) => script?.lines.find(line => line.bubbleId === bubbleId)?.text ?? '', [script]);
  const recorder = useRecorder(script?.chapterId ?? null, myName, textOf, session.afterTake);

  const cast = useMemo(() => castOf(script?.lines ?? []), [script]);
  const voiced = useMemo(() => (script ? voicedLines(script.lines, characters, script.names, clips) : []), [script, characters, clips]);
  const progress = progressOf(script?.lines ?? [], clips);
  const present = members.map(member => member.id);
  const nameOf = (id: string) => members.find(member => member.id === id)?.name ?? t('A friend');
  const mine = new Set(myLines.map(line => line.bubbleId));
  const others = mode === 'host' && script ? script.lines.filter(line => !mine.has(line.bubbleId)) : [];

  const onExport = async () => {
    if (!script) {
      return;
    }
    setExporting(true);
    try {
      const audio = await exportDubAudio(script.title, script.lines, clips, script.names);
      if (audio.zipped) {
        toast(t('Shared as separate clips with a playlist'));
      } else if (audio.joined < audio.total) {
        toast(t('{n} clips were in another format and were left out', { n: audio.total - audio.joined }));
      }
      await shareFile(audio.path, audio.mime, script.title);
    } catch {
      toast(progress.done === 0 ? t('Record at least one line first') : t("Couldn't make the audio file"));
    } finally {
      setExporting(false);
    }
  };

  const onShareAll = async () => {
    setSharing(true);
    try {
      const sent = await session.shareAll();
      toast(sent > 0 ? t('Voices sent to everyone') : t('Record at least one line first'));
    } catch {
      toast(t("Couldn't send the voices. Check the Wi-Fi and try again."));
    } finally {
      setSharing(false);
    }
  };

  const picking = mode !== 'guest' && (!script || changing);
  const title = script && !picking ? script.title : undefined;

  return (
    <Screen scroll>
      <AppBar
        title={t('Dub together')}
        onBack={() => navigation.goBack()}
        subtitle={title}
        right={
          mode !== 'guest' && script && !picking ? (
            <Button title={t('Change chapter')} variant="ghost" small onPress={() => setChanging(true)} />
          ) : undefined
        }
      />

      {picking ? (
        <View className="gap-3">
          <Text tone="secondary">
            {mode === 'host'
              ? t('Pick a chapter. Everyone in the room gets the lines of the characters you give them.')
              : t('Pick a chapter and voice every bubble yourself. Play it back with your voices, or share the audio.')}
          </Text>
          <ChapterPicker
            onPick={id => {
              setChanging(false);
              session.pickChapter(id);
            }}
          />
        </View>
      ) : !script ? (
        <EmptyState icon={TimeIcon} title={t('Waiting for the host')} message={t('The host is picking a chapter to dub.')} />
      ) : (
        <View className="gap-4">
          {recorder.micDenied && (
            <Banner
              tone="danger"
              text={t('Manganova can’t use the microphone. Allow it in Settings to record your lines.')}
              action={{ label: t('Open Settings'), onPress: openAppSettings }}
            />
          )}

          <View className="gap-1">
            <Text variant="caption" tone="muted">
              {t('{done} of {total} lines voiced', { done: progress.done, total: progress.total })}
            </Text>
            <ProgressBar value={progress.total ? progress.done / progress.total : 0} tone="success" />
          </View>

          {mode === 'host' && (
            <RolesCard cast={cast} names={script.names} roles={roles} members={members} hostId={hostId} onAssign={session.assign} />
          )}

          <View className="gap-2">
            <SectionHeader>{mode === 'solo' ? t('Lines') : t('Your lines')}</SectionHeader>
            {myLines.length === 0 ? (
              <Text tone="muted">{t('No lines for you this time. Listen to the others when the host plays the dub.')}</Text>
            ) : (
              myLines.map(line => (
                <LineCard
                  key={line.bubbleId}
                  line={line}
                  speaker={script.names[line.role] ?? t('Someone')}
                  clip={clips[line.bubbleId]}
                  recorder={recorder}
                  mine
                />
              ))
            )}
          </View>

          {others.length > 0 && (
            <View className="gap-2">
              <SectionHeader>{t("Everyone else's lines")}</SectionHeader>
              {others.map(line => (
                <LineCard
                  key={line.bubbleId}
                  line={line}
                  speaker={script.names[line.role] ?? t('Someone')}
                  clip={clips[line.bubbleId]}
                  recorder={recorder}
                  mine={false}
                  voicedBy={nameOf(voiceOf(roles, line.role, hostId, present))}
                />
              ))}
            </View>
          )}

          <View className="gap-3">
            <DubPlayer lines={voiced} />
            <Button title={t('Share the audio')} icon={ShareIcon} variant="secondary" loading={exporting} onPress={onExport} />
            {mode === 'host' && (
              <>
                <Button title={t('Send the voices to everyone')} icon={SendIcon} loading={sharing} onPress={onShareAll} />
                <Button title={t('Back to the lobby')} icon={ChapterIcon} variant="ghost" onPress={() => useRoom.getState().setActivity('lobby')} />
              </>
            )}
            {mode === 'guest' && (
              <Text variant="caption" tone="muted">
                {t('Each line you record goes to {name}, who sends everyone all the voices at the end.', { name: nameOf(hostId) })}
              </Text>
            )}
            {mode === 'solo' && (
              <Text variant="caption" tone="muted">
                {t('Recordings stay on this phone. Listen with voices from Home too, in Listen to the chapter.')}
              </Text>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
