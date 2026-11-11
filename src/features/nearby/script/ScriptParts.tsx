/**
 * The pieces of writing a script together: choosing the chapter, a scene with its heading, and one line.
 * A line is plain text until someone taps it; then it is theirs to type in, and everyone else sees their
 * name on it while the words appear.
 */
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { msg, t } from '../../../core/i18n';
import { BLOCK_LABEL } from '../../../core/model/constants';
import { activeProjects, chapterLabel, chaptersOf } from '../../../core/model/selectors';
import type { BlockType, ID } from '../../../core/model/types';
import { BLOCK_TYPES, SCRIPT_TEXT_MAX, type SharedBlock, type SharedCharacter, type SharedScene } from '../../../core/nearby/scriptTogether';
import type { MemberId } from '../../../core/nearby/types';
import { useStoryData } from '../../../state/hooks';
import { Chip, ChipRow, EmptyState, ICON, IconButton, ListItem, Pressable, Section, Text, useColor } from '../../../ui';
import { ChapterIcon, DeleteIcon, PlusIcon, ScriptIcon } from '../../../ui/icons';

const PLACEHOLDER: Record<BlockType, string> = {
  setting: msg('Where and when?'),
  action: msg('What happens?'),
  dialogue: msg('Dialogue…'),
  narration: msg('Narration…'),
  sfx: msg('BOOM!'),
};

const INDENT: Record<BlockType, string> = { setting: '', action: '', dialogue: 'ml-6', narration: 'ml-3', sfx: 'ml-3' };

const INPUT: Record<BlockType, string> = {
  setting: 'text-body font-inter-semibold',
  action: 'text-body font-inter',
  dialogue: 'text-body font-inter',
  narration: 'text-body font-inter',
  sfx: 'text-title font-inter-bold',
};

/** Host: every chapter of every story, empty ones too, since a blank chapter is a fine place to start. */
export function ChapterChooser({ onPick }: { onPick: (chapterId: ID) => void }) {
  const story = useStoryData();
  const groups = useMemo(
    () => activeProjects(story).map(project => ({ project, chapters: chaptersOf(story, project.id) })).filter(group => group.chapters.length > 0),
    [story],
  );
  if (!groups.length) {
    return <EmptyState icon={ScriptIcon} title={t('No chapters yet')} message={t('Start a story first, then write its script here with friends.')} />;
  }
  return (
    <View className="gap-4">
      <Text tone="secondary">{t('Pick a chapter. Everyone in the room writes its script with you; it is saved in your story when you finish.')}</Text>
      {groups.map(({ project, chapters }) => (
        <Section key={project.id} title={project.title || t('Untitled')}>
          {chapters.map(chapter => (
            <ListItem key={chapter.id} icon={ChapterIcon} title={chapterLabel(story, chapter.id)} chevron onPress={() => onPick(chapter.id)} />
          ))}
        </Section>
      ))}
    </View>
  );
}

/** This phone's text while it holds the line; the room's copy otherwise. The session batches the sending. */
function useTypedText(source: string, mine: boolean, send: (text: string) => void) {
  const [text, setText] = useState(source);
  useEffect(() => {
    if (!mine) {
      setText(source);
    }
  }, [mine, source]);
  const change = (value: string) => {
    setText(value);
    send(value);
  };
  return { text, change };
}

function HolderTag({ name, color }: { name: string; color: string }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}26` }}>
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text variant="caption">{t('{name} is writing', { name })}</Text>
    </View>
  );
}

type LineProps = {
  block: SharedBlock;
  holder?: MemberId;
  me?: MemberId;
  cast: SharedCharacter[];
  nameOf: (id: MemberId) => string;
  inkOf: (id: MemberId) => string;
  onClaim: () => void;
  onRelease: () => void;
  onEdit: (text: string) => void;
  onType: (type: BlockType, characterId?: string) => void;
  onRemove: () => void;
};

export function LineRow({ block, holder, me, cast, nameOf, inkOf, onClaim, onRelease, onEdit, onType, onRemove }: LineProps) {
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const mine = !!me && holder === me;
  const other = !!holder && !mine;
  const { text, change } = useTypedText(block.text, mine, onEdit);
  const speaker = cast.find(item => item.id === block.characterId)?.name;

  const label = (
    <Text variant="caption" tone="muted">
      {block.type === 'dialogue' ? speaker || t(BLOCK_LABEL.dialogue) : t(BLOCK_LABEL[block.type])}
    </Text>
  );

  if (mine) {
    return (
      <View className={`gap-2 rounded-md bg-accent/10 p-2 ${INDENT[block.type]}`}>
        {label}
        <TextInput
          value={text}
          onChangeText={change}
          autoFocus
          multiline
          scrollEnabled={false}
          maxLength={SCRIPT_TEXT_MAX}
          placeholder={t(PLACEHOLDER[block.type])}
          placeholderTextColor={muted}
          cursorColor={accent}
          selectionColor={accent}
          accessibilityLabel={t(BLOCK_LABEL[block.type])}
          textAlignVertical="top"
          className={`px-0 py-1 text-text ${INPUT[block.type]}`}
        />
        <ChipRow>
          {BLOCK_TYPES.map(type => (
            <Chip key={type} label={t(BLOCK_LABEL[type])} selected={block.type === type} onPress={() => onType(type, type === 'dialogue' ? block.characterId : undefined)} />
          ))}
        </ChipRow>
        {block.type === 'dialogue' && cast.length ? (
          <ChipRow>
            {cast.map(character => (
              <Chip key={character.id} label={character.name} selected={block.characterId === character.id} onPress={() => onType('dialogue', character.id)} />
            ))}
          </ChipRow>
        ) : null}
        <View className="flex-row justify-end gap-1">
          <IconButton icon={DeleteIcon} onPress={onRemove} accessibilityLabel={t('Delete this line')} />
          <Pressable
            onPress={onRelease}
            accessibilityRole="button"
            className="h-12 items-center justify-center rounded-md px-4"
          >
            <Text variant="label" tone="accent">
              {t('Done')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const words = (
    <Text className={INPUT[block.type]} tone={text.trim() ? 'text' : 'muted'}>
      {text.trim() || t(PLACEHOLDER[block.type])}
    </Text>
  );
  // Someone else's line stays fully readable while their words come in: a plain view, not a disabled button.
  if (other) {
    return (
      <View className={`min-h-12 gap-1 rounded-md border-l-4 px-2 py-2 ${INDENT[block.type]}`} style={{ borderLeftColor: inkOf(holder!) }}>
        <HolderTag name={nameOf(holder!)} color={inkOf(holder!)} />
        {words}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onClaim}
      accessibilityRole="button"
      accessibilityHint={t('Tap to write this line')}
      className={`min-h-12 gap-1 rounded-md px-2 py-2 ${INDENT[block.type]}`}
    >
      {label}
      {words}
    </Pressable>
  );
}

type SceneProps = {
  scene: SharedScene;
  index: number;
  holder?: MemberId;
  me?: MemberId;
  nameOf: (id: MemberId) => string;
  inkOf: (id: MemberId) => string;
  onClaim: () => void;
  onRelease: () => void;
  onEdit: (text: string) => void;
  onAddLine: () => void;
  children: React.ReactNode;
};

export function SceneBlock({ scene, index, holder, me, nameOf, inkOf, onClaim, onRelease, onEdit, onAddLine, children }: SceneProps) {
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const mine = !!me && holder === me;
  const other = !!holder && !mine;
  const { text, change } = useTypedText(scene.description, mine, onEdit);

  return (
    <View className="gap-1 rounded-lg bg-surface p-3">
      <Text variant="caption" tone="secondary">
        {t('Scene {n}', { n: index + 1 })}
      </Text>
      {mine ? (
        <TextInput
          value={text}
          onChangeText={change}
          onBlur={onRelease}
          autoFocus
          maxLength={SCRIPT_TEXT_MAX}
          placeholder={t('What is this scene about?')}
          placeholderTextColor={muted}
          cursorColor={accent}
          selectionColor={accent}
          accessibilityLabel={t('Scene {n}', { n: index + 1 })}
          className="rounded-md bg-accent/10 px-2 py-2 text-heading font-inter-semibold text-text"
        />
      ) : (
        <Pressable onPress={other ? undefined : onClaim} accessibilityRole="button" accessibilityState={{ disabled: other }} className="min-h-12 justify-center gap-1">
          {other ? <HolderTag name={nameOf(holder!)} color={inkOf(holder!)} /> : null}
          <Text variant="heading" tone={text.trim() ? 'text' : 'muted'}>
            {text.trim() || t('What is this scene about?')}
          </Text>
        </Pressable>
      )}
      {children}
      <Pressable onPress={onAddLine} accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 px-2">
        <PlusIcon size={ICON.md} color={accent} />
        <Text variant="label" tone="accent">
          {t('Add a line')}
        </Text>
      </Pressable>
    </View>
  );
}
