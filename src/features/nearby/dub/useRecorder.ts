import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../../core/i18n';
import { MIN_CLIP_MS, type ClipEntry } from '../../../core/nearby/dubClips';
import type { ID } from '../../../core/model/types';
import { MicDenied, cancelRecording, ensureMic, playFile, startRecording, stopPlayback, stopRecording } from '../../../native/audio';
import { toast } from '../../../ui';
import { clipPath, discardTake, keepTake, newTakePath } from './clipFiles';

export type Recorder = {
  /** The bubble being recorded, or being started. */
  recording: ID | null;
  elapsed: number;
  playing: ID | null;
  micDenied: boolean;
  busy: boolean;
  start: (bubbleId: ID) => void;
  stop: () => void;
  play: (bubbleId: ID, entry: ClipEntry) => void;
};

/**
 * One take at a time: tap to start, tap to stop (it also stops by itself at 15 s). A take is kept only when
 * long enough, and then replaces the line's previous take; recording again is the re-take.
 */
export function useRecorder(
  chapterId: ID | null,
  speaker: string,
  textOf: (bubbleId: ID) => string,
  onKept: (bubbleId: ID) => void,
): Recorder {
  const [recording, setRecording] = useState<ID | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState<ID | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = useRef<{ bubbleId: ID; path: string } | null>(null);
  const stopping = useRef(false);

  const stop = useCallback(async () => {
    const current = take.current;
    if (!current || stopping.current || !chapterId) {
      return;
    }
    stopping.current = true;
    setBusy(true);
    try {
      const ms = await stopRecording();
      take.current = null;
      if (ms < MIN_CLIP_MS) {
        discardTake(current.path);
        toast(t('Too short. Tap record, say the line, then tap stop.'));
        return;
      }
      await keepTake(chapterId, current.bubbleId, current.path, { ms, by: speaker, text: textOf(current.bubbleId) });
      onKept(current.bubbleId);
    } catch {
      discardTake(current.path);
      toast(t("Couldn't save the recording"));
    } finally {
      take.current = null;
      stopping.current = false;
      setRecording(null);
      setElapsed(0);
      setBusy(false);
    }
  }, [chapterId, speaker, textOf, onKept]);

  const start = useCallback(
    async (bubbleId: ID) => {
      if (take.current || busy) {
        return;
      }
      stopPlayback();
      setPlaying(null);
      setBusy(true);
      setRecording(bubbleId);
      try {
        await ensureMic({
          title: t('Use the microphone?'),
          message: t('Manganova records your voice for the lines you say. Recordings stay on this phone unless you share them.'),
          ok: t('Continue'),
        });
        const path = await newTakePath();
        take.current = { bubbleId, path };
        await startRecording(path, setElapsed, () => {
          stop();
        });
        setMicDenied(false);
      } catch (error) {
        const failed = take.current;
        take.current = null;
        discardTake(failed?.path ?? null);
        setRecording(null);
        if (error instanceof MicDenied) {
          setMicDenied(true);
        } else {
          toast(t("Couldn't start recording"));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, stop],
  );

  const play = useCallback(
    (bubbleId: ID, entry: ClipEntry) => {
      if (take.current) {
        return;
      }
      if (playing === bubbleId) {
        stopPlayback();
        setPlaying(null);
        return;
      }
      setPlaying(bubbleId);
      playFile(clipPath(entry))
        .then(finished => {
          if (finished) {
            setPlaying(current => (current === bubbleId ? null : current));
          }
        })
        .catch(() => {
          setPlaying(null);
          toast(t("Couldn't play the recording"));
        });
    },
    [playing],
  );

  // Leaving the screen ends any take and any playback.
  useEffect(
    () => () => {
      if (take.current) {
        const path = take.current.path;
        take.current = null;
        cancelRecording().finally(() => discardTake(path));
      }
      stopPlayback();
    },
    [],
  );

  return { recording, elapsed, playing, micDenied, busy, start, stop, play };
}
