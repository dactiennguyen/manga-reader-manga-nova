import type { StoryData } from '../model/types';
import { createChapterActions } from './slices/chapters';
import { createCharacterActions } from './slices/characters';
import { createPageActions } from './slices/pages';
import { createProjectActions } from './slices/projects';
import { createSceneActions } from './slices/scenes';
import type { StoryActions, StoryArt, StoryGet, StorySet } from './slices/types';
import { createWorldActions } from './slices/world';

export type { NewProjectInput, SceneInit, StoryActions, StoryArt, StorySet } from './slices/types';

export const EMPTY_STORY: StoryData = {
  projects: {},
  chapters: {},
  scenes: {},
  characters: {},
  relations: {},
  world: {},
  pages: {},
};

export function createStoryActions(set: StorySet, get: StoryGet, art: StoryArt): StoryActions {
  return {
    ...createProjectActions(set, get, art),
    ...createChapterActions(set, get),
    ...createSceneActions(set),
    ...createCharacterActions(set, get),
    ...createWorldActions(set),
    ...createPageActions(set, get, art),
    mergeEntities: data =>
      set(state => ({
        projects: { ...state.projects, ...data.projects },
        chapters: { ...state.chapters, ...data.chapters },
        scenes: { ...state.scenes, ...data.scenes },
        characters: { ...state.characters, ...data.characters },
        relations: { ...state.relations, ...data.relations },
        world: { ...state.world, ...data.world },
        pages: { ...state.pages, ...data.pages },
      })),
  };
}
