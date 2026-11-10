import { useRef, useState } from 'react';
import { View } from 'react-native';
import { AddUserIcon, LockIcon, PlusIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { ROLE_LABEL } from '../../core/model/constants';
import type { ID } from '../../core/model/types';
import { useCharacters } from '../../state/hooks';
import { useStory } from '../../state/useStory';
import { Avatar, Button, ICON, Icon, ListItem, SearchField, Sheet, Text, TextField } from '../../ui';

const NAME_MAX = 30;
const SEARCH_FROM = 5;

/** onPick runs after the sheet has closed, so it can open a dialog or move focus. */
export function CharacterPicker({
  visible,
  onClose,
  onClosed,
  projectId,
  onPick,
  selectedIds = [],
  excludeIds = [],
  title = t('Pick a character'),
  allowClear,
  allowCreate = true,
}: {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  projectId: ID;
  onPick: (characterId: ID | undefined) => void;
  selectedIds?: ID[];
  excludeIds?: ID[];
  title?: string;
  allowClear?: boolean;
  allowCreate?: boolean;
}) {
  const characters = useCharacters(projectId);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const chosen = useRef<{ id: ID | undefined } | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = characters.filter(
    character => !excludeIds.includes(character.id) && (!needle || character.name.toLowerCase().includes(needle)),
  );

  const close = () => {
    setQuery('');
    setCreating(false);
    setName('');
    onClose();
  };

  const choose = (id: ID | undefined) => {
    chosen.current = { id };
    close();
  };

  const create = () => {
    const trimmed = name.trim();
    if (trimmed) {
      choose(useStory.getState().addCharacter(projectId, { name: trimmed }));
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={title}
      onClosed={() => {
        const pick = chosen.current;
        chosen.current = null;
        if (pick) {
          onPick(pick.id);
        }
        onClosed?.();
      }}
    >
      <View className="gap-2 px-4">
        {characters.length > SEARCH_FROM && (
          <SearchField value={query} onChangeText={setQuery} placeholder={t('Search characters')} onClear={() => setQuery('')} />
        )}
        {!shown.length && !creating && (
          <Text tone="muted" className="py-3">
            {characters.length ? t('No characters match.') : t('This story has no characters yet.')}
          </Text>
        )}
      </View>
      {allowClear && <ListItem title={t('No character')} onPress={() => choose(undefined)} />}
      {shown.map(character => (
        <ListItem
          key={character.id}
          title={character.name || t('Unnamed')}
          subtitle={t(ROLE_LABEL[character.role])}
          left={<Avatar character={character} size={40} />}
          selected={selectedIds.includes(character.id)}
          right={character.locked ? <Icon icon={LockIcon} size={ICON.sm} color="text-muted" /> : undefined}
          onPress={() => choose(character.id)}
        />
      ))}
      {allowCreate &&
        (creating ? (
          <View className="flex-row items-center gap-2 px-4 py-2">
            <TextField
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder={t('New character name')}
              maxLength={NAME_MAX}
              onSubmitEditing={create}
              className="flex-1"
            />
            <Button title={t('Create')} icon={PlusIcon} small onPress={create} disabled={!name.trim()} />
          </View>
        ) : (
          <ListItem title={t('Quick-create a character')} icon={AddUserIcon} onPress={() => setCreating(true)} />
        ))}
    </Sheet>
  );
}
