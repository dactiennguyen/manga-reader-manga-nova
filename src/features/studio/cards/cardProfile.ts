import { msg } from '../../../core/i18n';
import { relationsOf } from '../../../core/model/selectors';
import type { Character, StoryData } from '../../../core/model/types';
import { profileCompleteness, rarityOf } from '../../../core/studio/cards';
import type { Rarity } from '../../../core/studio/types';

/** The twelve parts profileCompleteness counts, as the person would fill them in. */
const PARTS = 12;

/** What is still empty in a character's profile, in the order the Character screen shows it. msg() texts. */
export function missingProfileParts(state: StoryData, character: Character): string[] {
  const empty = (text: string) => !text.trim();
  const missing: [boolean, string][] = [
    [empty(character.name), msg('Name')],
    [empty(character.age), msg('Age')],
    [empty(character.gender), msg('Gender')],
    [empty(character.appearance), msg('Appearance')],
    [empty(character.goal), msg('Goal')],
    [empty(character.weakness), msg('Weakness')],
    [empty(character.voice), msg('Way of speaking')],
    [empty(character.bio), msg('Backstory')],
    [character.traits.filter(item => item.trim()).length < 2, msg('At least two traits')],
    [!character.sheet.face && !character.sheet.body, msg('A face or body drawing')],
    [Object.values(character.sheet.expressions).filter(Boolean).length < 3, msg('Three expressions')],
    [relationsOf(state, character.id).length === 0, msg('A relationship with another character')],
  ];
  return missing.filter(([isMissing]) => isMissing).map(([, label]) => label);
}

/** The next rarity up and how many more profile parts it takes, or null at the top. */
export function nextRarity(state: StoryData, character: Character): { rarity: Rarity; parts: number } | null {
  const completeness = profileCompleteness(state, character);
  const now = rarityOf(completeness, character.role);
  for (let parts = 1; parts <= PARTS; parts++) {
    const rarity = rarityOf(Math.min(1, completeness + parts / PARTS), character.role);
    if (rarity !== now) {
      return { rarity, parts };
    }
  }
  return null;
}
