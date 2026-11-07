import type { WorldEntry } from '../../model/types';
import { uid } from '../../util/id';
import { omit, touchProject } from './helpers';
import type { StorySet, WorldActions } from './types';

export function createWorldActions(set: StorySet): WorldActions {
  return {
    addWorldEntry: (projectId, type, init = {}) => {
      const entryId = uid();
      const now = Date.now();
      set(state => {
        const order =
          Object.values(state.world)
            .filter(entry => entry.projectId === projectId)
            .reduce((max, entry) => Math.max(max, entry.order), 0) + 1;
        const entry: WorldEntry = {
          title: '',
          body: '',
          images: [],
          characterIds: [],
          sendToAi: type !== 'note',
          order,
          ...init,
          id: entryId,
          projectId,
          type,
          createdAt: now,
          updatedAt: now,
        };
        return {
          world: { ...state.world, [entryId]: entry },
          projects: touchProject(state.projects, projectId, now),
        };
      });
      return entryId;
    },

    updateWorldEntry: (entryId, patch) =>
      set(state => {
        const entry = state.world[entryId];
        if (!entry) {
          return state;
        }
        const now = Date.now();
        return {
          world: { ...state.world, [entryId]: { ...entry, ...patch, updatedAt: now } },
          projects: touchProject(state.projects, entry.projectId, now),
        };
      }),

    removeWorldEntry: entryId => set(state => ({ world: omit(state.world, [entryId]) })),
  };
}
