import { useState } from 'react';
import { View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { LIMITS } from '../../core/model/constants';
import type { Character } from '../../core/model/types';
import { useStory } from '../../state/useStory';
import { Chip, ChipRow, FieldLabel, IconButton, Text, TextField, toast } from '../../ui';
import { AutoField } from './fields';

const TRAIT_MAX_LENGTH = 24;

export function ProfileTab({ character }: { character: Character }) {
  const [trait, setTrait] = useState('');
  const update = useStory(s => s.updateCharacter);
  const full = character.traits.length >= LIMITS.characterTraits;

  const addTrait = () => {
    const value = trait.trim();
    if (!value) {
      return;
    }
    if (full) {
      toast(`Up to ${LIMITS.characterTraits} traits`);
      return;
    }
    if (character.traits.some(item => item.toLowerCase() === value.toLowerCase())) {
      toast('This trait is already added');
      setTrait('');
      return;
    }
    update(character.id, { traits: [...character.traits, value] });
    setTrait('');
  };

  const removeTrait = (value: string) => {
    update(character.id, { traits: character.traits.filter(item => item !== value) });
  };

  return (
    <View>
      <View className="mb-4 gap-1">
        <FieldLabel>{`Traits (${character.traits.length}/${LIMITS.characterTraits})`}</FieldLabel>
        {character.traits.length > 0 && (
          <ChipRow>
            {character.traits.map(item => (
              <Chip key={item} label={`${item}  ×`} onPress={() => removeTrait(item)} />
            ))}
          </ChipRow>
        )}
        <View className="flex-row items-center gap-2">
          <TextField
            value={trait}
            onChangeText={setTrait}
            onSubmitEditing={addTrait}
            placeholder={full ? 'Trait limit reached' : 'e.g. hot-headed, kind'}
            accessibilityLabel="New trait"
            maxLength={TRAIT_MAX_LENGTH}
            editable={!full}
            returnKeyType="done"
            submitBehavior="submit"
            className="flex-1"
          />
          <IconButton icon={Plus} onPress={addTrait} disabled={full || !trait.trim()} accessibilityLabel="Add trait" />
        </View>
        <Text variant="caption" tone="muted">
          Tap a trait to remove it.
        </Text>
      </View>

      <AutoField
        label="Goal"
        value={character.goal}
        onCommit={goal => update(character.id, { goal })}
        placeholder="What does this character want?"
        maxLength={200}
      />
      <AutoField
        label="Weakness"
        value={character.weakness}
        onCommit={weakness => update(character.id, { weakness })}
        placeholder="What holds this character back?"
        maxLength={200}
      />
      <AutoField
        label="Way of speaking"
        value={character.voice}
        onCommit={voice => update(character.id, { voice })}
        placeholder="Catchphrases, tone, fast or slow talker…"
        multiline
        maxLength={400}
        minHeight={80}
      />
      <AutoField
        label="Backstory"
        value={character.bio}
        onCommit={bio => update(character.id, { bio })}
        placeholder="Origins, past, key turning points…"
        multiline
        maxLength={LIMITS.bio}
        showCount
        minHeight={140}
      />
      <AutoField
        label="Gender"
        value={character.gender}
        onCommit={gender => update(character.id, { gender })}
        placeholder="Male, female or describe"
        maxLength={30}
      />
      <AutoField
        label="Notes"
        value={character.notes}
        onCommit={notes => update(character.id, { notes })}
        placeholder="Your private notes about this character"
        multiline
        maxLength={1000}
      />
    </View>
  );
}
