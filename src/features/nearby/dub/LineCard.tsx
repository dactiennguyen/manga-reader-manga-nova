import { View } from 'react-native';

import { t } from '../../../core/i18n';
import type { DubItem } from '../../../core/nearby/dub';
import { MAX_CLIP_MS, isStale, type ClipEntry } from '../../../core/nearby/dubClips';
import { Button, IconButton, ProgressBar, Text } from '../../../ui';
import { PauseIcon, PlayIcon, RecordIcon, StopIcon } from '../../../ui/icons';
import type { Recorder } from './useRecorder';

const seconds = (ms: number) => (ms / 1000).toFixed(1);

/**
 * One line to voice. `mine`: this phone records it; otherwise it only shows who voices it and whether
 * the take has arrived (the host's overview of everyone's lines).
 */
export function LineCard({
  line,
  speaker,
  clip,
  recorder,
  mine,
  voicedBy,
}: {
  line: DubItem;
  speaker: string;
  clip: ClipEntry | undefined;
  recorder: Recorder;
  mine: boolean;
  /** Who records this line, shown on lines that are not mine. */
  voicedBy?: string;
}) {
  const recordingThis = recorder.recording === line.bubbleId;
  const playingThis = recorder.playing === line.bubbleId;
  const stale = clip ? isStale(clip, line.text) : false;
  const status = clip
    ? stale
      ? t('The bubble changed since this take')
      : t('{seconds} s · {name}', { seconds: seconds(clip.ms), name: clip.by || speaker })
    : mine
    ? t('Not recorded yet')
    : t('Waiting for {name}', { name: voicedBy ?? t('a friend') });

  return (
    <View className={`gap-2 rounded-lg px-3 py-3 ${recordingThis ? 'bg-accent/15' : 'bg-surface'}`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="label" tone={recordingThis ? 'accent' : 'secondary'} numberOfLines={1} className="flex-1">
          {speaker}
        </Text>
        <Text variant="caption" tone="muted">
          {t('Page {n}', { n: line.pageIndex + 1 })}
        </Text>
      </View>
      <Text variant={line.type === 'narration' ? 'bodySmall' : 'body'}>{line.text}</Text>
      {recordingThis ? (
        <View className="gap-1">
          <ProgressBar value={recorder.elapsed / MAX_CLIP_MS} />
          <Text variant="caption" tone="accent">
            {t('Recording… {seconds} s of {max} s', { seconds: seconds(recorder.elapsed), max: MAX_CLIP_MS / 1000 })}
          </Text>
        </View>
      ) : (
        <Text variant="caption" tone={stale ? 'warning' : clip ? 'success' : 'muted'}>
          {status}
        </Text>
      )}
      <View className="flex-row items-center gap-2">
        {mine && (
          <Button
            title={recordingThis ? t('Stop') : clip ? t('Record again') : t('Record')}
            icon={recordingThis ? StopIcon : RecordIcon}
            variant={recordingThis || !clip ? 'primary' : 'secondary'}
            small
            loading={recordingThis && recorder.busy}
            disabled={!recordingThis && (recorder.recording !== null || recorder.busy)}
            onPress={() => (recordingThis ? recorder.stop() : recorder.start(line.bubbleId))}
            className="flex-1"
          />
        )}
        {clip && (
          <IconButton
            icon={playingThis ? PauseIcon : PlayIcon}
            active={playingThis}
            accessibilityLabel={playingThis ? t('Stop playing') : t('Play this take')}
            disabled={recorder.recording !== null}
            onPress={() => recorder.play(line.bubbleId, clip)}
          />
        )}
      </View>
    </View>
  );
}
