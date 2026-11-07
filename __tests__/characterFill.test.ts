import {
  characterIsBlank,
  fillKeywords,
  fillPatch,
  fillRows,
  fillValueText,
} from '../src/core/story/characterFill';
import type { CharacterDraft } from '../src/core/ai/people';
import type { Character } from '../src/core/model/types';

function character(extra: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    projectId: 'p',
    name: '',
    role: 'support',
    age: '',
    gender: '',
    traits: [],
    goal: '',
    weakness: '',
    voice: '',
    bio: '',
    notes: '',
    appearance: '',
    sheet: { expressions: {} },
    locked: false,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

const DRAFT: CharacterDraft = {
  name: 'Rin',
  role: 'main',
  age: '17',
  gender: 'Female',
  traits: ['shy', 'stubborn'],
  goal: 'Win the tournament.',
  weakness: 'Cannot lie.',
  voice: 'Short sentences.',
  bio: 'Grew up in the mountains.',
  appearance: 'Black hair, a scar on the left cheek.',
};

describe('characterFill', () => {
  it('builds keywords from the name and traits', () => {
    expect(fillKeywords({ name: ' Rin ', traits: ['shy', ' brave '] })).toBe('Rin, shy, brave');
    expect(fillKeywords({ name: '', traits: [] })).toBe('');
  });

  it('formats traits and role for the preview', () => {
    expect(fillValueText('traits', DRAFT)).toBe('shy, stubborn');
    expect(fillValueText('role', DRAFT)).toBe('Main character');
    expect(fillValueText('goal', DRAFT)).toBe('Win the tournament.');
  });

  it('fills every field of a blank character in empty mode, including the role', () => {
    const blank = character();
    expect(characterIsBlank(blank)).toBe(true);
    const patch = fillPatch(blank, DRAFT, 'empty');
    expect(patch).toEqual(DRAFT);
  });

  it('keeps the typed name and existing fields in empty mode', () => {
    const existing = character({ name: 'Kai', goal: 'Find his sister.', traits: ['calm'] });
    const patch = fillPatch(existing, DRAFT, 'empty');
    expect(patch.name).toBeUndefined();
    expect(patch.goal).toBeUndefined();
    expect(patch.traits).toBeUndefined();
    expect(patch.role).toBeUndefined();
    expect(patch.weakness).toBe('Cannot lie.');
    expect(patch.appearance).toBe(DRAFT.appearance);
    const rows = fillRows(existing, DRAFT, 'empty');
    expect(rows.find(row => row.key === 'name')?.applied).toBe(false);
    expect(rows.find(row => row.key === 'bio')?.applied).toBe(true);
  });

  it('replaces everything in all mode', () => {
    const existing = character({ name: 'Kai', goal: 'Find his sister.', traits: ['calm'] });
    expect(fillPatch(existing, DRAFT, 'all')).toEqual(DRAFT);
  });

  it('never applies empty suggestions', () => {
    const thin: CharacterDraft = { ...DRAFT, age: '', gender: '', traits: [] };
    const patch = fillPatch(character(), thin, 'all');
    expect(patch.age).toBeUndefined();
    expect(patch.gender).toBeUndefined();
    expect(patch.traits).toBeUndefined();
    expect(patch.name).toBe('Rin');
  });
});
