import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { DeleteIcon, EditIcon, NoteIcon, PlusIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { relationsOf } from '../../core/model/selectors';
import type { Character, ID } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Avatar, Button, Card, Menu, PromptDialog, Text, confirm } from '../../ui';
import { CharacterPicker } from './CharacterPicker';
import { useSticky } from './fields';

const LABEL_MAX = 30;
const NOTE_MAX = 120;

export function RelationsTab({ character }: { character: Character }) {
  const navigation = useAppNavigation();
  const relations = useStory(s => s.relations);
  const characters = useStory(s => s.characters);
  const [picking, setPicking] = useState(false);
  const [pendingOther, setPendingOther] = useState<ID | null>(null);
  const [menuId, setMenuId] = useState<ID | null>(null);
  const [editing, setEditing] = useState<{ id: ID; field: 'label' | 'note' } | null>(null);

  const items = useMemo(
    () => relationsOf(useStory.getState(), character.id),
    // relationsOf reads the store, so these two are what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relations, characters, character.id],
  );
  const excludeIds = useMemo(() => [character.id, ...items.map(item => item.other.id)], [character.id, items]);
  const menuItem = items.find(item => item.relation.id === menuId);
  const menuShown = useSticky(menuItem);
  const editingItem = items.find(item => item.relation.id === editing?.id);
  const pendingName = pendingOther ? characters[pendingOther]?.name.trim() || t('this character') : '';
  const selfName = character.name.trim() || t('This character');

  const remove = async (relationId: ID, otherName: string) => {
    const ok = await confirm(t('Delete relation?'), t('The relation with {name} is removed for both.', { name: otherName || t('this character') }), {
      confirmText: t('Delete'),
      destructive: true,
    });
    if (ok) {
      useStory.getState().removeRelation(relationId);
    }
  };

  return (
    <View className="gap-3">
      {items.length === 0 ? (
        <Text tone="secondary" className="py-4">
          {t('{name} has no relations yet. Add friends, enemies, family… to remember who is tied to whom.', { name: selfName })}
        </Text>
      ) : (
        items.map(({ relation, other }) => (
          <Card
            key={relation.id}
            accessibilityLabel={`${other.name.trim() || t('Unnamed')}, ${relation.label || t('No label')}`}
            onPress={() => navigation.push('Character', { characterId: other.id })}
            onLongPress={() => setMenuId(relation.id)}
            className="flex-row items-center gap-3 p-3"
          >
            <Avatar character={other} size={48} />
            <View className="flex-1 gap-0.5">
              <Text variant="heading" numberOfLines={1}>
                {other.name.trim() || t('Unnamed')}
              </Text>
              <Text variant="label" tone="accent" numberOfLines={1}>
                {relation.label || t('No label')}
              </Text>
              {!!relation.note && (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {relation.note}
                </Text>
              )}
            </View>
          </Card>
        ))
      )}
      <Button title={t('Relation')} icon={PlusIcon} variant="secondary" onPress={() => setPicking(true)} />
      {items.length > 0 && (
        <Text variant="caption" tone="muted" className="text-center">
          {t('Relations go both ways. Long-press a row to edit its label or note, or to delete it.')}
        </Text>
      )}

      <CharacterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        projectId={character.projectId}
        excludeIds={excludeIds}
        title={t('Related to whom?')}
        onPick={otherId => {
          if (otherId && otherId !== character.id) {
            setPendingOther(otherId);
          }
        }}
      />
      <PromptDialog
        visible={!!pendingOther}
        onClose={() => setPendingOther(null)}
        title={t('Relation label')}
        message={t('What are {a} and {b} to each other?', { a: selfName, b: pendingName })}
        placeholder={t('Best friend, enemy, sibling…')}
        confirmText={t('Add')}
        maxLength={LABEL_MAX}
        onSubmit={label => {
          if (pendingOther) {
            useStory.getState().addRelation(character.projectId, character.id, pendingOther, label.trim());
          }
          setPendingOther(null);
        }}
      />
      <PromptDialog
        key={editing ? `${editing.id}-${editing.field}` : 'none'}
        visible={!!editing && !!editingItem}
        onClose={() => setEditing(null)}
        title={editing?.field === 'note' ? t('Relation note') : t('Relation label')}
        initialValue={editing?.field === 'note' ? editingItem?.relation.note : editingItem?.relation.label}
        placeholder={editing?.field === 'note' ? t('A one-line note') : t('Best friend, enemy, sibling…')}
        maxLength={editing?.field === 'note' ? NOTE_MAX : LABEL_MAX}
        allowEmpty={editing?.field === 'note'}
        onSubmit={value => {
          if (editing) {
            useStory.getState().updateRelation(editing.id, { [editing.field]: value.trim() });
          }
          setEditing(null);
        }}
      />
      <Menu
        visible={!!menuItem}
        onClose={() => setMenuId(null)}
        title={menuShown ? menuShown.other.name.trim() || t('Unnamed') : undefined}
        subtitle={menuShown?.relation.label}
        items={[
          {
            label: t('Edit label'),
            icon: EditIcon,
            onPress: () => setEditing(menuId ? { id: menuId, field: 'label' } : null),
          },
          {
            label: t('Edit note'),
            icon: NoteIcon,
            onPress: () => setEditing(menuId ? { id: menuId, field: 'note' } : null),
          },
          {
            label: t('Delete relation'),
            icon: DeleteIcon,
            destructive: true,
            onPress: () => {
              if (menuItem) {
                remove(menuItem.relation.id, menuItem.other.name.trim());
              }
            },
          },
        ]}
      />
    </View>
  );
}
