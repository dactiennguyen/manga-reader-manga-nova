/**
 * The characters who appear most. Stories record a character in two places that can be counted: script
 * lines with the character as speaker, and bubbles on pages tied to the character. Neither has a date, so
 * this covers every story the person can see, not one period. Pins on the canvas are not saved and do not
 * count.
 */
import type { ID, StoryData } from '../model/types';
import { liveProjectIds } from '../studio/metrics';

export type CharacterCount = { characterId: ID; projectId: ID; lines: number; bubbles: number; total: number };

export function topCharacters(
  state: Pick<StoryData, 'projects' | 'chapters' | 'scenes' | 'pages' | 'characters'>,
  limit = 5,
): CharacterCount[] {
  const live = liveProjectIds(state);
  const counts = new Map<ID, CharacterCount>();
  const bump = (characterId: ID | undefined, field: 'lines' | 'bubbles') => {
    const character = characterId ? state.characters[characterId] : undefined;
    if (!character || !live.has(character.projectId)) {
      return;
    }
    const count = counts.get(character.id) ?? { characterId: character.id, projectId: character.projectId, lines: 0, bubbles: 0, total: 0 };
    count[field]++;
    count.total++;
    counts.set(character.id, count);
  };
  for (const chapter of Object.values(state.chapters)) {
    if (!live.has(chapter.projectId)) {
      continue;
    }
    for (const sceneId of chapter.sceneIds) {
      for (const block of state.scenes[sceneId]?.blocks ?? []) {
        if (block.text.trim()) {
          bump(block.characterId, 'lines');
        }
      }
    }
    for (const pageId of chapter.pageIds) {
      for (const bubble of state.pages[pageId]?.bubbles ?? []) {
        bump(bubble.characterId, 'bubbles');
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.total - a.total || b.bubbles - a.bubbles || a.characterId.localeCompare(b.characterId))
    .slice(0, limit);
}
