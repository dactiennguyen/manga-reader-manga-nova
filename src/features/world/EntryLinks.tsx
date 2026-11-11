import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AddUserIcon, CheckIcon, DeleteIcon, PlusIcon, ReadIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import type { Chapter, ID, WorldEntry } from '../../core/model/types';
import { anchorLabel, entryMentions } from '../../core/world/worldTools';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Avatar, Button, FieldLabel, ListItem, Menu, Pressable, SectionHeader, Text } from '../../ui';
import { CharacterPicker } from '../characters/CharacterPicker';
import { AutoField, useSticky } from '../characters/fields';
import { WORLD_TYPE_ICON } from './worldShared';

/** Fields that only some entry types have: reading, time anchor, leader. */
export function EntryTypeFields({ entry, chapters }: { entry: WorldEntry; chapters: Chapter[] }) {
  const update = useStory(s => s.updateWorldEntry);
  const leader = useStory(s => (entry.leaderId ? s.characters[entry.leaderId] : undefined));
  const [anchorMenu, setAnchorMenu] = useState(false);
  const [picking, setPicking] = useState(false);

  const anchorOptions: { key: string; value: WorldEntry['anchor'] }[] = [
    { key: 'before', value: 'before' },
    ...chapters.map(chapter => ({ key: chapter.id, value: chapter.id })),
    { key: 'after', value: 'after' },
    { key: 'none', value: undefined },
  ];
  const anchorKnown =
    entry.anchor === 'before' || entry.anchor === 'after' || chapters.some(chapter => chapter.id === entry.anchor);
  const activeAnchor = anchorKnown ? entry.anchor : undefined;

  return (
    <>
      {entry.type === 'term' && (
        <AutoField
          label={t('Reading')}
          value={entry.reading ?? ''}
          onCommit={reading => update(entry.id, { reading: reading.trim() || undefined })}
          placeholder={t('Pronunciation or phonetic spelling')}
          maxLength={80}
        />
      )}
      {entry.type === 'event' && (
        <View className="mb-4 gap-1">
          <FieldLabel>{t('Time anchor')}</FieldLabel>
          <View className="overflow-hidden rounded-md bg-surface">
            <ListItem title={t(anchorLabel(activeAnchor, chapters))} icon={WORLD_TYPE_ICON.event} chevron onPress={() => setAnchorMenu(true)} />
          </View>
        </View>
      )}
      {entry.type === 'faction' && (
        <View className="mb-4 gap-1">
          <FieldLabel>{t('Leader')}</FieldLabel>
          <View className="overflow-hidden rounded-md bg-surface">
            <ListItem
              title={leader ? leader.name.trim() || t('Unnamed') : t('Choose a leader')}
              left={leader ? <Avatar character={leader} size={32} /> : undefined}
              icon={leader ? undefined : AddUserIcon}
              chevron
              onPress={() => setPicking(true)}
            />
          </View>
        </View>
      )}
      <Menu
        visible={anchorMenu}
        onClose={() => setAnchorMenu(false)}
        title={t('Time anchor')}
        items={anchorOptions.map(option => ({
          label: t(anchorLabel(option.value, chapters)),
          icon: activeAnchor === option.value ? CheckIcon : undefined,
          onPress: () => update(entry.id, { anchor: option.value }),
        }))}
      />
      <CharacterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        projectId={entry.projectId}
        selectedIds={entry.leaderId ? [entry.leaderId] : []}
        title={t('Choose a leader')}
        allowClear
        onPick={characterId => update(entry.id, { leaderId: characterId })}
      />
    </>
  );
}

export function EntryLinks({ entry, chapters }: { entry: WorldEntry; chapters: Chapter[] }) {
  const navigation = useAppNavigation();
  const update = useStory(s => s.updateWorldEntry);
  const characters = useStory(s => s.characters);
  const scenes = useStory(s => s.scenes);
  const [picking, setPicking] = useState(false);
  const [chipMenuId, setChipMenuId] = useState<ID | null>(null);

  const related = useMemo(
    () => entry.characterIds.map(id => characters[id]).filter(Boolean),
    [entry.characterIds, characters],
  );
  const chipCharacter = chipMenuId ? characters[chipMenuId] : undefined;
  const chipShown = useSticky(chipCharacter);
  const mentions = useMemo(() => entryMentions(entry.title, chapters, scenes), [entry.title, chapters, scenes]);

  return (
    <>
      <SectionHeader>{t('Related characters')}</SectionHeader>
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        {related.map(character => {
          const name = character.name.trim() || t('Unnamed');
          return (
            <Pressable
              key={character.id}
              accessibilityLabel={name}
              hitSlop={6}
              onPress={() => navigation.navigate('Character', { characterId: character.id })}
              onLongPress={() => setChipMenuId(character.id)}
              className="h-9 max-w-55 flex-row items-center gap-2 overflow-hidden rounded-full bg-surface pl-1 pr-3"
            >
              <Avatar character={character} size={26} />
              <Text variant="label" numberOfLines={1} className="shrink">
                {name}
              </Text>
            </Pressable>
          );
        })}
        <Button title={t('Add')} icon={PlusIcon} variant="secondary" small onPress={() => setPicking(true)} />
      </View>
      {related.length > 0 && (
        <Text variant="caption" tone="muted" className="mt-2">
          {t('Long-press a character to remove them from this entry.')}
        </Text>
      )}

      <View className="mt-6 gap-2">
        <SectionHeader>{t('Appears in')}</SectionHeader>
        {mentions.length === 0 ? (
          <Text variant="caption" tone="muted">
            {entry.title.trim().length < 2
              ? t('Give this entry a title of at least 2 characters to find the chapters that mention it.')
              : t('No chapter script mentions this title yet.')}
          </Text>
        ) : (
          <View className="overflow-hidden rounded-md bg-surface">
            {mentions.map(item => (
              <ListItem
                key={item.chapterId}
                title={item.label}
                subtitle={tn(item.count, '{count} mention', '{count} mentions')}
                icon={ReadIcon}
                chevron
                onPress={() => navigation.navigate('Script', { chapterId: item.chapterId, blockId: item.blockId })}
              />
            ))}
          </View>
        )}
      </View>

      <Menu
        visible={!!chipCharacter}
        onClose={() => setChipMenuId(null)}
        title={chipShown ? chipShown.name.trim() || t('Unnamed') : undefined}
        items={[
          {
            label: t('Remove from this entry'),
            icon: DeleteIcon,
            destructive: true,
            onPress: () => update(entry.id, { characterIds: entry.characterIds.filter(id => id !== chipMenuId) }),
          },
        ]}
      />
      <CharacterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        projectId={entry.projectId}
        excludeIds={entry.characterIds}
        title={t('Related characters')}
        onPick={characterId => {
          if (characterId && !entry.characterIds.includes(characterId)) {
            update(entry.id, { characterIds: [...entry.characterIds, characterId] });
          }
        }}
      />
    </>
  );
}
