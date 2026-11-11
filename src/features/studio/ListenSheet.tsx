import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';

import { t } from '../../core/i18n';
import { chapterLabel } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import type { Utterance } from '../../core/studio/tableRead';
import { useStory } from '../../state/useStory';
import { Button, Chip, EmptyState, IconButton, LoadingView, Pressable, Segmented, Sheet, Text } from '../../ui';
import { ListenIcon, NextLineIcon, PauseIcon, PlayIcon, PreviousLineIcon, ScriptIcon } from '../../ui/icons';
import { SPEEDS, useTableRead, type Speed } from './useTableRead';

/** The script list takes what the sheet has left after its controls, about 400dp, within these bounds. */
const LIST_HEIGHT = { min: 120, max: 300, controls: 400 } as const;
/** The current line sits a little below the top, so the line before it stays in view. */
const SCROLL_LEAD = 48;

const SPEED_LABEL: Record<Speed, string> = { 0.75: '0.75×', 1: '1×', 1.25: '1.25×' };

function speakerOf(line: Utterance): string {
  if (line.narrator) {
    return t('Narrator');
  }
  return line.speaker ?? t('Someone');
}

function Line({ line, current, onPress }: { line: Utterance; current: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${speakerOf(line)}: ${line.text}`}
      accessibilityState={{ selected: current }}
      accessibilityHint={t('Reads from this line')}
      onPress={onPress}
      className={`min-h-12 gap-0.5 rounded-md px-3 py-2 ${current ? 'bg-accent/15' : ''}`}
    >
      <Text variant="caption" tone={current ? 'accent' : 'muted'} numberOfLines={1}>
        {speakerOf(line)}
      </Text>
      <Text variant={line.narrator ? 'bodySmall' : 'body'} tone={line.narrator ? 'secondary' : 'text'}>
        {line.text}
      </Text>
    </Pressable>
  );
}

function Player({ chapterId }: { chapterId: ID }) {
  const [directions, setDirections] = useState(true);
  const [sfx, setSfx] = useState(false);
  const read = useTableRead(chapterId, true, { directions, sfx });
  const scroll = useRef<ScrollViewInstance>(null);
  const offsets = useRef<number[]>([]);
  const window = useWindowDimensions();
  const listHeight = Math.min(LIST_HEIGHT.max, Math.max(LIST_HEIGHT.min, window.height * 0.85 - LIST_HEIGHT.controls));

  useEffect(() => {
    const y = offsets.current[read.index];
    if (y !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, y - SCROLL_LEAD), animated: true });
    }
  }, [read.index]);

  if (read.lines.length === 0) {
    return <EmptyState icon={ScriptIcon} title={t('Nothing to read yet')} message={t('Write a few lines of script for this chapter first.')} />;
  }
  if (read.status === 'checking') {
    return (
      <View className="h-48">
        <LoadingView label={t('Looking for a voice…')} />
      </View>
    );
  }
  if (read.status === 'noVoice') {
    return (
      <EmptyState
        icon={ListenIcon}
        title={t('No voice to read with')}
        message={t('Add a text-to-speech voice for this language in your device settings, then open this again.')}
      />
    );
  }

  const line = read.lines[read.index];
  return (
    <View className="gap-3 px-4 pb-2">
      <ScrollView ref={scroll} style={{ maxHeight: listHeight }} className="rounded-lg bg-surface">
        <View className="gap-1 p-1">
          {read.lines.map((item, index) => (
            <View
              key={item.blockId}
              onLayout={event => {
                offsets.current[index] = event.nativeEvent.layout.y;
              }}
            >
              <Line line={item} current={index === read.index} onPress={() => read.playFrom(index)} />
            </View>
          ))}
        </View>
      </ScrollView>

      {read.status === 'failed' && (
        <Text variant="bodySmall" tone="danger" className="text-center">
          {t('The voice stopped. Tap play to try again.')}
        </Text>
      )}

      <View className="items-center gap-1">
        <Text variant="caption" tone="muted">
          {t('Line {n} of {total}', { n: read.index + 1, total: read.lines.length })}
        </Text>
        <Text variant="label" tone="accent" numberOfLines={1}>
          {line ? speakerOf(line) : ''}
        </Text>
      </View>

      <View className="flex-row items-center justify-center gap-4">
        <IconButton
          icon={PreviousLineIcon}
          accessibilityLabel={t('Previous line')}
          onPress={read.previous}
          disabled={read.index === 0}
        />
        <Button
          title={read.playing ? t('Pause') : t('Play')}
          icon={read.playing ? PauseIcon : PlayIcon}
          onPress={read.toggle}
          className="min-w-36"
        />
        <IconButton
          icon={NextLineIcon}
          accessibilityLabel={t('Next line')}
          onPress={read.next}
          disabled={read.index >= read.lines.length - 1}
        />
      </View>

      <View className="gap-1">
        <Text variant="caption" tone="muted">
          {t('Speed')}
        </Text>
        <Segmented
          options={SPEEDS.map(value => ({ value, label: SPEED_LABEL[value] }))}
          value={read.speed}
          onChange={read.setSpeed}
        />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Chip label={t('Settings and actions')} selected={directions} onPress={() => setDirections(value => !value)} />
        <Chip label={t('Sound effects')} selected={sfx} onPress={() => setSfx(value => !value)} />
      </View>
    </View>
  );
}

/**
 * Reads a chapter's script aloud with the device's own voices, one voice per character. Home places it;
 * it keeps nothing once closed, and closing stops the voice.
 */
export function ListenSheet({ chapterId, visible, onClose }: { chapterId: ID; visible: boolean; onClose: () => void }) {
  const subtitle = useStory(s => (visible ? chapterLabel(s, chapterId) : ''));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Listen to the chapter')} subtitle={subtitle} scroll={false}>
      {visible && <Player chapterId={chapterId} />}
    </Sheet>
  );
}
