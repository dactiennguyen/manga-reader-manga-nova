import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CharactersIcon, LockIcon, NotesIcon, PlusIcon, WorldIcon } from '../../ui/icons';

import { ROLE_LABEL, WORLD_TYPE_LABEL, WORLD_TYPES } from '../../core/model/constants';
import { charactersOf, worldOf } from '../../core/model/selectors';
import type { ID, StoryData, WorldType } from '../../core/model/types';
import { formatRelative } from '../../core/util/time';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Avatar, Button, EmptyState, ICON, Icon, ListItem, Menu, Pressable, Section, Text } from '../../ui';

type TabProps = { state: StoryData; projectId: ID };

const ENTRY_TYPES = WORLD_TYPES.filter(type => type !== 'note');

export function CharactersTab({ state, projectId }: TabProps) {
  const navigation = useAppNavigation();
  const characters = useMemo(() => charactersOf(state, projectId), [state, projectId]);

  const add = () => {
    const characterId = useStory.getState().addCharacter(projectId);
    navigation.navigate('Character', { characterId });
  };

  if (characters.length === 0) {
    return (
      <EmptyState
        icon={CharactersIcon}
        title="No one here yet."
        message="Create your main character first!"
        action={{ label: 'Create character', onPress: add }}
      />
    );
  }
  return (
    <View className="gap-3">
      <View className="flex-row justify-end">
        <Button title="Character" icon={PlusIcon} small onPress={add} />
      </View>
      <View className="flex-row flex-wrap">
        {characters.map(character => {
          const name = character.name || 'Untitled';
          const role = ROLE_LABEL[character.role];
          return (
            <Pressable
              key={character.id}
              accessibilityLabel={`${name}, ${role}${character.locked ? ', locked' : ''}`}
              onPress={() => navigation.navigate('Character', { characterId: character.id })}
              className="w-1/3 items-center gap-0.5 px-1 py-2"
            >
              <View>
                <Avatar character={character} size={72} />
                {character.locked && (
                  <View className="absolute -bottom-0.5 -right-0.5 h-[22px] w-[22px] items-center justify-center rounded-full bg-raised">
                    <Icon icon={LockIcon} size={ICON.xs} color="text-secondary" />
                  </View>
                )}
              </View>
              <Text variant="label" numberOfLines={1} className="text-center">
                {name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1} className="text-center">
                {role}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function WorldTab({ state, projectId }: TabProps) {
  const navigation = useAppNavigation();
  const [picking, setPicking] = useState(false);
  const entries = useMemo(() => worldOf(state, projectId).filter(entry => entry.type !== 'note'), [state, projectId]);

  const add = (type: WorldType) => {
    const entryId = useStory.getState().addWorldEntry(projectId, type);
    navigation.navigate('WorldEntry', { entryId });
  };

  return (
    <View className="gap-3">
      {entries.length === 0 ? (
        <EmptyState
          icon={WorldIcon}
          title="Where does the story take place?"
          message="Keep track of places, factions and terms here."
          action={{ label: 'New entry', onPress: () => setPicking(true) }}
        />
      ) : (
        <>
          <View className="flex-row justify-between gap-2">
            <Button
              title="See all"
              variant="secondary"
              small
              onPress={() => navigation.navigate('World', { projectId })}
            />
            <Button title="New entry" icon={PlusIcon} small onPress={() => setPicking(true)} />
          </View>
          {ENTRY_TYPES.map(type => {
            const group = entries.filter(entry => entry.type === type);
            if (group.length === 0) {
              return null;
            }
            return (
              <Section key={type} title={`${WORLD_TYPE_LABEL[type]} (${group.length})`}>
                {group.map(entry => (
                  <ListItem
                    key={entry.id}
                    title={entry.title || 'Untitled'}
                    subtitle={entry.body.trim().split('\n')[0] || undefined}
                    chevron
                    onPress={() => navigation.navigate('WorldEntry', { entryId: entry.id })}
                  />
                ))}
              </Section>
            );
          })}
        </>
      )}
      <Menu
        visible={picking}
        onClose={() => setPicking(false)}
        title="Add world entry"
        items={ENTRY_TYPES.map(type => ({ label: WORLD_TYPE_LABEL[type], onPress: () => add(type) }))}
      />
    </View>
  );
}

export function NotesTab({ state, projectId }: TabProps) {
  const navigation = useAppNavigation();
  const notes = useMemo(
    () =>
      worldOf(state, projectId)
        .filter(entry => entry.type === 'note')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state, projectId],
  );

  const add = () => {
    const entryId = useStory.getState().addWorldEntry(projectId, 'note');
    navigation.navigate('WorldEntry', { entryId });
  };

  if (notes.length === 0) {
    return (
      <EmptyState
        icon={NotesIcon}
        title="Had a sudden idea?"
        message="Jot it down here before it slips away."
        action={{ label: 'Note', onPress: add }}
      />
    );
  }
  return (
    <View className="gap-3">
      <View className="flex-row justify-end">
        <Button title="Note" icon={PlusIcon} small onPress={add} />
      </View>
      <Section>
        {notes.map(note => (
          <ListItem
            key={note.id}
            title={note.title || note.body.trim().split('\n')[0] || 'Empty note'}
            subtitle={formatRelative(note.updatedAt)}
            chevron
            onPress={() => navigation.navigate('WorldEntry', { entryId: note.id })}
          />
        ))}
      </Section>
    </View>
  );
}
