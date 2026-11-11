import { t } from '../../core/i18n';
import { ROLE_LABEL } from '../../core/model/constants';
import type { Character } from '../../core/model/types';
import { Avatar, EmptyState, ListItem, Sheet } from '../../ui';
import type { CanvasReference } from './CanvasOverlays';

/** The face first, then the body and each expression drawn on the character's sheet. */
export function characterReference(character: Character): CanvasReference {
  const { face, body, expressions } = character.sheet;
  const images = [face, body, ...Object.values(expressions)].filter((path): path is string => !!path);
  return { id: character.id, images, title: character.name || t('Unnamed'), note: character.appearance.trim() || undefined };
}

export function CharacterRefSheet({
  visible,
  characters,
  onClose,
  onPick,
}: {
  visible: boolean;
  characters: Character[];
  onClose: () => void;
  onPick: (character: Character) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Character reference')} subtitle={t('Keeps them on model while you draw')}>
      {characters.length === 0 ? (
        <EmptyState title={t('No characters yet.')} message={t('Add one in your story, then pin them here.')} />
      ) : (
        characters.map(character => (
          <ListItem
            key={character.id}
            title={character.name || t('Unnamed')}
            subtitle={t(ROLE_LABEL[character.role])}
            left={<Avatar character={character} />}
            onPress={() => onPick(character)}
          />
        ))
      )}
    </Sheet>
  );
}
