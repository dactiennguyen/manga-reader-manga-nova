import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { getLocale, t } from '../../../core/i18n';
import type { VoicedLine } from '../../../core/nearby/dubPlay';
import { scriptLanguage } from '../../../core/studio/tableRead';
import { toAbsolute } from '../../../core/util/paths';
import { playFile, stopPlayback } from '../../../native/audio';
import { speak, stopSpeech } from '../../../native/speech';
import { Button, Text } from '../../../ui';
import { ListenIcon, StopIcon } from '../../../ui/icons';

/**
 * Plays the whole dub in reading order: each recorded clip, and the device's voice for lines nobody has
 * recorded yet. A line the device cannot read is skipped rather than stopping the dub.
 */
export function DubPlayer({ lines, onLine }: { lines: VoicedLine[]; onLine?: (bubbleId: string | null) => void }) {
  const [index, setIndex] = useState<number | null>(null);
  const language = useMemo(() => scriptLanguage(lines, getLocale()), [lines]);
  const session = useRef(0);

  useEffect(() => {
    onLine?.(index === null ? null : lines[index]?.bubbleId ?? null);
  }, [index, lines, onLine]);

  useEffect(() => {
    if (index === null) {
      return;
    }
    const line = lines[index];
    if (!line) {
      setIndex(null);
      return;
    }
    const mine = ++session.current;
    const next = () => {
      if (session.current === mine) {
        setIndex(index + 1 < lines.length ? index + 1 : null);
      }
    };
    const run =
      line.source.kind === 'clip'
        ? playFile(toAbsolute(line.source.file))
        : speak(line.text, { language, pitch: line.pitch, rate: line.rate });
    run.then(finished => finished && next()).catch(next);
    return () => {
      session.current += 1;
      stopPlayback();
      stopSpeech();
    };
  }, [index, lines, language]);

  const playing = index !== null;
  const current = playing ? lines[index] : null;
  return (
    <View className="gap-2">
      <Button
        title={playing ? t('Stop') : t('Play the dub')}
        icon={playing ? StopIcon : ListenIcon}
        variant="secondary"
        disabled={lines.length === 0}
        onPress={() => setIndex(playing ? null : 0)}
      />
      {current && (
        <Text variant="caption" tone="muted" className="text-center" numberOfLines={2}>
          {t('Line {n} of {total}', { n: (index ?? 0) + 1, total: lines.length })}
          {current.speaker ? ` · ${current.speaker}` : ''}
        </Text>
      )}
    </View>
  );
}
