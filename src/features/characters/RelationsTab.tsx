import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Pencil, Plus, StickyNote, Trash2 } from 'lucide-react-native';

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
  const pendingName = pendingOther ? characters[pendingOther]?.name.trim() || 'this character' : '';
  const selfName = character.name.trim() || 'This character';

  const remove = async (relationId: ID, otherName: string) => {
    const ok = await confirm('Delete relation?', `The relation with ${otherName || 'this character'} is removed for both.`, {
      confirmText: 'Delete',
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
          {selfName} has no relations yet. Add friends, enemies, family… to remember who is tied to whom.
        </Text>
      ) : (
        items.map(({ relation, other }) => (
          <Card
            key={relation.id}
            accessibilityLabel={`${other.name.trim() || 'Unnamed'}, ${relation.label || 'No label'}`}
            onPress={() => navigation.push('Character', { characterId: other.id })}
            onLongPress={() => setMenuId(relation.id)}
            className="flex-row items-center gap-3 p-3"
          >
            <Avatar character={other} size={48} />
            <View className="flex-1 gap-0.5">
              <Text variant="heading" numberOfLines={1}>
                {other.name.trim() || 'Unnamed'}
              </Text>
              <Text variant="label" tone="accent" numberOfLines={1}>
                {relation.label || 'No label'}
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
      <Button title="Relation" icon={Plus} variant="secondary" onPress={() => setPicking(true)} />
      {items.length > 0 && (
        <Text variant="caption" tone="muted" className="text-center">
          Relations go both ways. Long-press a row to edit its label or note, or to delete it.
        </Text>
      )}

      <CharacterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        projectId={character.projectId}
        excludeIds={excludeIds}
        title="Related to whom?"
        onPick={otherId => {
          if (otherId && otherId !== character.id) {
            setPendingOther(otherId);
          }
        }}
      />
      <PromptDialog
        visible={!!pendingOther}
        onClose={() => setPendingOther(null)}
        title="Relation label"
        message={`What are ${selfName} and ${pendingName} to each other?`}
        placeholder="Best friend, enemy, sibling…"
        confirmText="Add"
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
        title={editing?.field === 'note' ? 'Relation note' : 'Relation label'}
        initialValue={editing?.field === 'note' ? editingItem?.relation.note : editingItem?.relation.label}
        placeholder={editing?.field === 'note' ? 'A one-line note' : 'Best friend, enemy, sibling…'}
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
        title={menuShown ? menuShown.other.name.trim() || 'Unnamed' : undefined}
        subtitle={menuShown?.relation.label}
        items={[
          {
            label: 'Edit label',
            icon: Pencil,
            onPress: () => setEditing(menuId ? { id: menuId, field: 'label' } : null),
          },
          {
            label: 'Edit note',
            icon: StickyNote,
            onPress: () => setEditing(menuId ? { id: menuId, field: 'note' } : null),
          },
          {
            label: 'Delete relation',
            icon: Trash2,
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
