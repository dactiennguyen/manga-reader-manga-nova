import { useEffect, useMemo, useRef, useState } from 'react';

import { getLocale, type Locale } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import {
  assignVoiceIds,
  lineAt,
  scriptLanguage,
  tableRead,
  type TableReadOptions,
  type Utterance,
} from '../../core/studio/tableRead';
import { speak, speechAvailable, speechVoices, stopSpeech, type SpeechVoice } from '../../native/speech';
import { useStory } from '../../state/useStory';

export type TableReadStatus = 'checking' | 'ready' | 'noVoice' | 'failed';

export const SPEEDS = [0.75, 1, 1.25] as const;

export type Speed = (typeof SPEEDS)[number];

export type TableRead = {
  lines: Utterance[];
  language: Locale;
  status: TableReadStatus;
  index: number;
  playing: boolean;
  speed: Speed;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  /** Jumps to a line and reads from there. */
  playFrom: (index: number) => void;
  setSpeed: (speed: Speed) => void;
};

/**
 * Reads a chapter aloud line after line while `active`. Each line resolves before the next starts, so
 * pausing, skipping and closing the sheet only have to stop the engine and move the index.
 */
export function useTableRead(chapterId: ID, active: boolean, options: TableReadOptions): TableRead {
  const chapter = useStory(s => s.chapters[chapterId]);
  const scenes = useStory(s => s.scenes);
  const characters = useStory(s => s.characters);
  const { directions, sfx } = options;
  const lines = useMemo(
    () =>
      active && chapter
        ? tableRead({ chapters: { [chapterId]: chapter }, scenes, characters }, chapterId, { directions, sfx })
        : [],
    [active, chapter, chapterId, scenes, characters, directions, sfx],
  );
  const language = useMemo(() => scriptLanguage(lines, getLocale()), [lines]);

  const [status, setStatus] = useState<TableReadStatus>('checking');
  const [voices, setVoices] = useState<SpeechVoice[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  /** The last line was read to the end: play starts again from the top. */
  const [ended, setEnded] = useState(false);
  const session = useRef(0);
  /** Set when a line ended by itself, so moving to the next one need not stop the engine first. */
  const advancing = useRef(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    let alive = true;
    setStatus('checking');
    (async () => {
      const ok = await speechAvailable(language);
      const found = ok ? await speechVoices(language) : [];
      if (alive) {
        setVoices(found);
        setStatus(ok ? 'ready' : 'noVoice');
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, language]);

  const voiceIds = useMemo(() => assignVoiceIds(lines, voices), [lines, voices]);

  // A new script or option starts from the top.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setEnded(false);
  }, [lines]);

  useEffect(() => {
    if (!active || !playing || status !== 'ready') {
      return;
    }
    const line = lines[index];
    if (!line) {
      setPlaying(false);
      return;
    }
    const mine = ++session.current;
    speak(line.text, {
      language,
      pitch: line.pitch,
      rate: line.rate * speed,
      voiceId: line.speakerId ? voiceIds.get(line.speakerId) ?? null : null,
    })
      .then(finished => {
        if (!finished || session.current !== mine) {
          return;
        }
        if (index + 1 < lines.length) {
          advancing.current = true;
          setIndex(index + 1);
        } else {
          setPlaying(false);
          setEnded(true);
        }
      })
      .catch(() => {
        if (session.current === mine) {
          setPlaying(false);
          setStatus('failed');
        }
      });
    return () => {
      // Whatever comes next (a skip, a pause, closing) starts from silence. On iOS stopping also hands the
      // audio back to other apps, which would make music swell between two lines.
      session.current += 1;
      if (!advancing.current) {
        stopSpeech();
      }
      advancing.current = false;
    };
  }, [active, playing, status, lines, index, language, speed, voiceIds]);

  return {
    lines,
    language,
    status,
    index,
    playing,
    speed,
    toggle: () => {
      if (!playing && ended) {
        setIndex(0);
        setEnded(false);
      }
      if (status === 'failed') {
        setStatus('ready');
      }
      setPlaying(value => !value);
    },
    next: () => {
      setEnded(false);
      setIndex(current => lineAt(lines, current + 1));
    },
    previous: () => {
      setEnded(false);
      setIndex(current => lineAt(lines, current - 1));
    },
    playFrom: target => {
      setEnded(false);
      setIndex(lineAt(lines, target));
      setPlaying(true);
    },
    setSpeed,
  };
}
