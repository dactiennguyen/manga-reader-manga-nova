import type { ID, Scene } from '../../model/types';
import { uid } from '../../util/id';
import { moveItem, omit, touchProject } from './helpers';
import type { SceneActions, StorySet } from './types';

export function createSceneActions(set: StorySet): SceneActions {
  return {
    addScene: (chapterId, init = {}) => {
      const sceneId = uid();
      set(state => {
        const chapter = state.chapters[chapterId];
        if (!chapter) {
          return state;
        }
        const now = Date.now();
        const sceneIds = [...chapter.sceneIds];
        sceneIds.splice(init.index ?? sceneIds.length, 0, sceneId);
        const scene: Scene = {
          id: sceneId,
          chapterId,
          description: init.description ?? '',
          blocks: init.blocks ?? [],
        };
        return {
          scenes: { ...state.scenes, [sceneId]: scene },
          chapters: {
            ...state.chapters,
            [chapterId]: { ...chapter, sceneIds, scriptChangedAt: now, updatedAt: now },
          },
          projects: touchProject(state.projects, chapter.projectId, now),
        };
      });
      return sceneId;
    },

    updateScene: (sceneId, patch) =>
      set(state => {
        const scene = state.scenes[sceneId];
        if (!scene) {
          return state;
        }
        const scenes = { ...state.scenes, [sceneId]: { ...scene, ...patch } };
        const chapter = state.chapters[scene.chapterId];
        if (!chapter || (patch.blocks === undefined && patch.description === undefined)) {
          return { scenes };
        }
        const now = Date.now();
        return {
          scenes,
          chapters: { ...state.chapters, [chapter.id]: { ...chapter, scriptChangedAt: now, updatedAt: now } },
          projects: touchProject(state.projects, chapter.projectId, now),
        };
      }),

    moveScene: (chapterId, from, to) =>
      set(state => {
        const chapter = state.chapters[chapterId];
        if (!chapter) {
          return state;
        }
        const now = Date.now();
        return {
          chapters: {
            ...state.chapters,
            [chapterId]: {
              ...chapter,
              sceneIds: moveItem(chapter.sceneIds, from, to),
              scriptChangedAt: now,
              updatedAt: now,
            },
          },
        };
      }),

    removeScene: sceneId =>
      set(state => {
        const scene = state.scenes[sceneId];
        if (!scene) {
          return state;
        }
        const chapter = state.chapters[scene.chapterId];
        const now = Date.now();
        return {
          scenes: omit(state.scenes, [sceneId]),
          chapters: chapter
            ? {
                ...state.chapters,
                [chapter.id]: {
                  ...chapter,
                  sceneIds: chapter.sceneIds.filter(id => id !== sceneId),
                  scriptChangedAt: now,
                  updatedAt: now,
                },
              }
            : state.chapters,
        };
      }),

    replaceScript: (chapterId, sceneInits) =>
      set(state => {
        const chapter = state.chapters[chapterId];
        if (!chapter) {
          return state;
        }
        const now = Date.now();
        const scenes = omit(state.scenes, chapter.sceneIds);
        const sceneIds: ID[] = [];
        for (const init of sceneInits) {
          const id = uid();
          sceneIds.push(id);
          scenes[id] = { id, chapterId, description: init.description ?? '', blocks: init.blocks ?? [] };
        }
        return {
          scenes,
          chapters: {
            ...state.chapters,
            [chapterId]: { ...chapter, sceneIds, scriptChangedAt: now, updatedAt: now },
          },
          projects: touchProject(state.projects, chapter.projectId, now),
        };
      }),
  };
}
