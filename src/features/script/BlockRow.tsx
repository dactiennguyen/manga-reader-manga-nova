import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';

import { BLOCK_LABEL, DIALOGUE_KIND_LABEL, LIMITS } from '../../core/model/constants';
import type { Block, BlockType, Character, ID } from '../../core/model/types';
import { Avatar, Pressable, Text, useColor } from '../../ui';
import type { BlockApi } from './useScriptController';

export type BlockMark = 'match' | 'current';

const DEBOUNCE_MS = 300;
const SUBMIT_GUARD_MS = 300;

const PLACEHOLDER: Record<BlockType, string> = {
  setting: 'Where and when?',
  action: 'What happens?',
  dialogue: 'Dialogue…',
  narration: 'Narration…',
  sfx: 'BOOM!',
};

/** Blocks are told apart by margin and a small label, never by a card. */
const INDENT: Record<BlockType, string> = {
  setting: '',
  action: '',
  dialogue: 'ml-8',
  narration: 'ml-4',
  sfx: 'ml-4',
};

const INPUT: Record<BlockType, string> = {
  setting: 'text-body font-inter-semibold',
  action: 'text-body font-inter',
  dialogue: 'text-body font-inter',
  narration: 'text-body font-inter',
  sfx: 'text-title font-inter-bold',
};

function BlockRowBase({
  block,
  character,
  panelLabel,
  panelPageId,
  placeholder,
  mark,
  api,
}: {
  block: Block;
  character: Character | undefined;
  panelLabel?: string;
  panelPageId?: ID;
  placeholder?: string;
  mark?: BlockMark;
  api: BlockApi;
}) {
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const [text, setText] = useState(block.text);
  const latest = useRef(block.text);
  const pushed = useRef(block.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caret = useRef<number | null>(null);
  const submittedAt = useRef(0);
  const id = block.id;
  const type = block.type;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (latest.current !== pushed.current) {
      pushed.current = latest.current;
      api.text(id, latest.current);
    }
  }, [api, id]);

  useEffect(() => {
    if (block.text !== pushed.current) {
      pushed.current = block.text;
      latest.current = block.text;
      setText(block.text);
    }
  }, [block.text]);

  // A row can unmount while focused, when the list recycles its scene, so nothing else would report the blur.
  useEffect(
    () => () => {
      flush();
      api.blur(id);
      if (api.flushRef.current === flush) {
        api.flushRef.current = null;
      }
    },
    [api, flush, id],
  );

  const register = useCallback((input: ComponentRef<typeof TextInput> | null) => api.register(id, input), [api, id]);

  const apply = (value: string) => {
    latest.current = value;
    setText(value);
  };

  const onChangeText = (value: string) => {
    const prev = latest.current;
    if (value.length === prev.length + 1) {
      const at = value.indexOf('\n');
      if (at >= 0 && value.slice(0, at) + value.slice(at + 1) === prev) {
        const before = prev.slice(0, at);
        const after = prev.slice(at);
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        apply(before);
        pushed.current = before;
        api.enter(id, before, after);
        return;
      }
    }
    if (type === 'dialogue' && value.startsWith('@') && !prev.startsWith('@')) {
      apply(value.slice(1));
      api.pickCharacter(id);
      return;
    }
    apply(value);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  };

  const onSubmit = () => {
    const now = Date.now();
    if (now - submittedAt.current < SUBMIT_GUARD_MS) {
      return;
    }
    submittedAt.current = now;
    const value = latest.current;
    const at = Math.min(caret.current ?? value.length, value.length);
    const before = value.slice(0, at);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    api.text(id, value);
    apply(before);
    pushed.current = before;
    api.enter(id, before, value.slice(at));
  };

  const long = type === 'dialogue' && text.length > LIMITS.longDialogue;

  const label =
    type === 'dialogue' ? (
      <View className="min-h-9 flex-row items-center justify-between gap-2">
        <Pressable
          accessibilityLabel={character ? `Speaker: ${character.name || 'Unnamed'}` : 'Pick character'}
          hitSlop={6}
          onPress={() => api.pickCharacter(id)}
          className="h-9 shrink flex-row items-center gap-2"
        >
          <Avatar character={character} size={24} />
          <Text variant="caption" tone={character ? 'secondary' : 'accent'} numberOfLines={1} className="shrink">
            {character ? character.name || 'Unnamed' : 'Pick character'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Change dialogue style"
          hitSlop={10}
          onPress={() => api.cycleKind(id)}
          className="h-7 justify-center rounded-full bg-overlay px-2"
        >
          <Text variant="caption" tone="secondary">
            {DIALOGUE_KIND_LABEL[block.kind ?? 'speak']}
          </Text>
        </Pressable>
      </View>
    ) : type === 'action' ? null : (
      <Text variant="caption" tone="muted">
        {BLOCK_LABEL[type]}
      </Text>
    );

  return (
    <View
      className={`flex-row items-start gap-1 ${mark === 'current' ? 'bg-accent/15' : ''}`}
      onLayout={event => api.layout(id, event.nativeEvent.layout.y)}
    >
      {mark !== undefined && (
        <View
          pointerEvents="none"
          className={`absolute -left-3 bottom-0 top-0 w-1 rounded-full ${mark === 'current' ? 'bg-accent' : 'bg-control-border'}`}
        />
      )}
      <View className={`flex-1 ${INDENT[type]}`}>
        {label}
        <TextInput
          ref={register}
          value={text}
          onChangeText={onChangeText}
          onKeyPress={event => {
            if (event.nativeEvent.key === 'Backspace' && latest.current === '') {
              api.backspaceEmpty(id);
            }
          }}
          onFocus={() => {
            api.flushRef.current = flush;
            api.focus(id);
          }}
          onBlur={() => {
            flush();
            api.blur(id);
          }}
          onSelectionChange={event => {
            caret.current = event.nativeEvent.selection.start;
          }}
          onSubmitEditing={onSubmit}
          submitBehavior="submit"
          multiline
          scrollEnabled={false}
          placeholder={placeholder ?? PLACEHOLDER[type]}
          placeholderTextColor={muted}
          cursorColor={accent}
          selectionColor={accent}
          accessibilityLabel={BLOCK_LABEL[type]}
          textAlignVertical="top"
          className={`px-0 py-1 text-text ${INPUT[type]} ${long ? 'border-b-2 border-warning' : ''}`}
        />
        {long ? (
          <View className="min-h-9 flex-row items-center gap-2">
            <Text variant="caption" tone="warning" className="flex-1">
              Too long to fit a bubble
            </Text>
            <Pressable accessibilityLabel="Shorten with AI" hitSlop={6} onPress={() => api.shorten(id)} className="h-9 justify-center">
              <Text variant="caption" tone="ai">
                Shorten with AI
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {panelLabel !== undefined && panelPageId !== undefined && (
        <Pressable
          accessibilityLabel={`Open panel ${panelLabel}`}
          hitSlop={12}
          onPress={() => api.openPanel(panelPageId)}
          className="mt-1 h-6 justify-center rounded-sm bg-surface px-1"
        >
          <Text variant="caption" tone="muted">
            {panelLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export const BlockRow = memo(BlockRowBase);
