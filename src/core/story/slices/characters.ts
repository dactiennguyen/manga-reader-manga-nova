import { t } from '../../i18n';
import type { Character } from '../../model/types';
import { uid } from '../../util/id';
import { omit, touchProject } from './helpers';
import type { CharacterActions, StoryGet, StorySet } from './types';

export function createCharacterActions(set: StorySet, get: StoryGet): CharacterActions {
  return {
    addCharacter: (projectId, init = {}) => {
      const characterId = uid();
      const now = Date.now();
      const character: Character = {
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
        ...init,
        id: characterId,
        projectId,
        createdAt: now,
        updatedAt: now,
      };
      set(state => ({
        characters: { ...state.characters, [characterId]: character },
        projects: touchProject(state.projects, projectId, now),
      }));
      return characterId;
    },

    updateCharacter: (characterId, patch) =>
      set(state => {
        const character = state.characters[characterId];
        if (!character) {
          return state;
        }
        const now = Date.now();
        return {
          characters: { ...state.characters, [characterId]: { ...character, ...patch, updatedAt: now } },
          projects: touchProject(state.projects, character.projectId, now),
        };
      }),

    duplicateCharacter: characterId => {
      const source = get().characters[characterId];
      if (!source) {
        return null;
      }
      return get().addCharacter(source.projectId, {
        ...source,
        name: t('{title} (copy)', { title: source.name }),
        locked: false,
        sheet: { ...source.sheet, expressions: { ...source.sheet.expressions } },
      });
    },

    removeCharacter: characterId =>
      set(state => {
        const character = state.characters[characterId];
        if (!character) {
          return state;
        }
        const project = state.projects[character.projectId];
        const chapterIds = project ? project.acts.flatMap(act => act.chapterIds) : [];
        const chapters = { ...state.chapters };
        const scenes = { ...state.scenes };
        const pages = { ...state.pages };
        for (const chapterId of chapterIds) {
          const chapter = chapters[chapterId];
          if (!chapter) {
            continue;
          }
          if (chapter.characterIds.includes(characterId)) {
            chapters[chapterId] = {
              ...chapter,
              characterIds: chapter.characterIds.filter(id => id !== characterId),
            };
          }
          for (const sceneId of chapter.sceneIds) {
            const scene = scenes[sceneId];
            if (scene?.blocks.some(block => block.characterId === characterId)) {
              scenes[sceneId] = {
                ...scene,
                blocks: scene.blocks.map(block =>
                  block.characterId === characterId ? { ...block, characterId: undefined } : block,
                ),
              };
            }
          }
          for (const pageId of chapter.pageIds) {
            const page = pages[pageId];
            if (page?.bubbles.some(bubble => bubble.characterId === characterId)) {
              pages[pageId] = {
                ...page,
                bubbles: page.bubbles.map(bubble =>
                  bubble.characterId === characterId ? { ...bubble, characterId: undefined } : bubble,
                ),
              };
            }
          }
        }
        const world = { ...state.world };
        for (const entry of Object.values(world)) {
          if (entry.characterIds.includes(characterId) || entry.leaderId === characterId) {
            world[entry.id] = {
              ...entry,
              characterIds: entry.characterIds.filter(id => id !== characterId),
              leaderId: entry.leaderId === characterId ? undefined : entry.leaderId,
            };
          }
        }
        const relationIds = Object.values(state.relations)
          .filter(relation => relation.a === characterId || relation.b === characterId)
          .map(relation => relation.id);
        return {
          characters: omit(state.characters, [characterId]),
          relations: omit(state.relations, relationIds),
          chapters,
          scenes,
          pages,
          world,
        };
      }),

    addRelation: (projectId, a, b, label, note = '') => {
      const relationId = uid();
      set(state => ({
        relations: { ...state.relations, [relationId]: { id: relationId, projectId, a, b, label, note } },
      }));
      return relationId;
    },

    updateRelation: (relationId, patch) =>
      set(state => {
        const relation = state.relations[relationId];
        if (!relation) {
          return state;
        }
        return { relations: { ...state.relations, [relationId]: { ...relation, ...patch } } };
      }),

    removeRelation: relationId => set(state => ({ relations: omit(state.relations, [relationId]) })),
  };
}
