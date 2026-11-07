import type { CharacterDraft } from '../ai/people';
import { ROLE_LABEL } from '../model/constants';
import type { Character } from '../model/types';

export type FillMode = 'empty' | 'all';

export type FillKey = keyof CharacterDraft;

const FILL_KEYS: readonly FillKey[] = [
  'name',
  'role',
  'age',
  'gender',
  'traits',
  'goal',
  'weakness',
  'voice',
  'bio',
  'appearance',
];

const FILL_LABEL: Record<FillKey, string> = {
  name: 'Name',
  role: 'Role',
  age: 'Age',
  gender: 'Gender',
  traits: 'Traits',
  goal: 'Goal',
  weakness: 'Weakness',
  voice: 'Way of speaking',
  bio: 'Backstory',
  appearance: 'Appearance',
};

export type FillRow = { key: FillKey; label: string; value: string; applied: boolean };

export function fillValueText(key: FillKey, draft: CharacterDraft): string {
  if (key === 'traits') {
    return draft.traits.join(', ');
  }
  if (key === 'role') {
    return ROLE_LABEL[draft.role];
  }
  return draft[key];
}

export function fillKeywords(character: Pick<Character, 'name' | 'traits'>): string {
  return [character.name.trim(), ...character.traits.map(item => item.trim())].filter(Boolean).join(', ');
}

export function characterIsBlank(character: Character): boolean {
  return (
    !character.name.trim() &&
    !character.age.trim() &&
    !character.gender.trim() &&
    character.traits.length === 0 &&
    !character.goal.trim() &&
    !character.weakness.trim() &&
    !character.voice.trim() &&
    !character.bio.trim() &&
    !character.appearance.trim()
  );
}

function fieldEmpty(character: Character, key: FillKey): boolean {
  if (key === 'traits') {
    return character.traits.length === 0;
  }
  if (key === 'role') {
    return characterIsBlank(character);
  }
  return !character[key].trim();
}

export function fillRows(character: Character, draft: CharacterDraft, mode: FillMode): FillRow[] {
  return FILL_KEYS.map(key => {
    const value = fillValueText(key, draft);
    const applied = !!value && (mode === 'all' || fieldEmpty(character, key));
    return { key, label: FILL_LABEL[key], value, applied };
  });
}

export function fillPatch(character: Character, draft: CharacterDraft, mode: FillMode): Partial<CharacterDraft> {
  const patch: Partial<CharacterDraft> = {};
  for (const row of fillRows(character, draft, mode)) {
    if (!row.applied) {
      continue;
    }
    if (row.key === 'traits') {
      patch.traits = draft.traits;
    } else if (row.key === 'role') {
      patch.role = draft.role;
    } else {
      patch[row.key] = draft[row.key];
    }
  }
  return patch;
}
