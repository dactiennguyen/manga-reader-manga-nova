import { t } from '../../i18n';
import type { Act, Block, Chapter } from '../../model/types';
import { uid } from '../../util/id';
import { moveItem, omit, touchProject } from './helpers';
import type { ChapterActions, StoryGet, StorySet } from './types';

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map(block => ({ ...block, id: uid() }));
}

export function createChapterActions(set: StorySet, get: StoryGet): ChapterActions {
  return {
    addAct: (projectId, title) => {
      const actId = uid();
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        const act: Act = { id: actId, title: title ?? t('Act {n}', { n: project.acts.length + 1 }), chapterIds: [] };
        return {
          projects: {
            ...state.projects,
            [projectId]: { ...project, acts: [...project.acts, act], updatedAt: Date.now() },
          },
        };
      });
      return actId;
    },

    renameAct: (projectId, actId, title) =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        const acts = project.acts.map(act => (act.id === actId ? { ...act, title } : act));
        return { projects: { ...state.projects, [projectId]: { ...project, acts, updatedAt: Date.now() } } };
      }),

    moveAct: (projectId, actId, delta) =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        const from = project.acts.findIndex(act => act.id === actId);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= project.acts.length) {
          return state;
        }
        const acts = moveItem(project.acts, from, to);
        return { projects: { ...state.projects, [projectId]: { ...project, acts, updatedAt: Date.now() } } };
      }),

    removeAct: (projectId, actId, moveChaptersToActId) =>
      set(state => {
        const project = state.projects[projectId];
        const act = project?.acts.find(a => a.id === actId);
        if (!project || !act || project.acts.length <= 1) {
          return state;
        }
        if (act.chapterIds.length && !moveChaptersToActId) {
          return state;
        }
        const acts = project.acts
          .filter(a => a.id !== actId)
          .map(a => (a.id === moveChaptersToActId ? { ...a, chapterIds: [...a.chapterIds, ...act.chapterIds] } : a));
        return { projects: { ...state.projects, [projectId]: { ...project, acts, updatedAt: Date.now() } } };
      }),

    addChapter: (projectId, init = {}) => {
      const chapterId = uid();
      set(state => {
        const project = state.projects[projectId];
        if (!project || !project.acts.length) {
          return state;
        }
        const now = Date.now();
        const total = project.acts.reduce((sum, act) => sum + act.chapterIds.length, 0);
        const actId = init.actId ?? project.acts[project.acts.length - 1].id;
        const acts = project.acts.map(act => {
          if (act.id !== actId) {
            return act;
          }
          const chapterIds = [...act.chapterIds];
          chapterIds.splice(init.index ?? chapterIds.length, 0, chapterId);
          return { ...act, chapterIds };
        });
        const chapter: Chapter = {
          id: chapterId,
          projectId,
          title: init.title ?? `Chapter ${total + 1}`,
          summary: init.summary ?? '',
          goal: init.goal ?? '',
          characterIds: [],
          sceneIds: [],
          pageIds: [],
          createdAt: now,
          updatedAt: now,
        };
        return {
          projects: { ...state.projects, [projectId]: { ...project, acts, updatedAt: now } },
          chapters: { ...state.chapters, [chapterId]: chapter },
        };
      });
      return chapterId;
    },

    updateChapter: (chapterId, patch) =>
      set(state => {
        const chapter = state.chapters[chapterId];
        if (!chapter) {
          return state;
        }
        const now = Date.now();
        return {
          chapters: { ...state.chapters, [chapterId]: { ...chapter, ...patch, updatedAt: now } },
          projects: touchProject(state.projects, chapter.projectId, now),
        };
      }),

    moveChapter: (chapterId, toActId, toIndex) =>
      set(state => {
        const chapter = state.chapters[chapterId];
        const project = chapter ? state.projects[chapter.projectId] : undefined;
        if (!chapter || !project || !project.acts.some(act => act.id === toActId)) {
          return state;
        }
        const acts = project.acts
          .map(act => ({ ...act, chapterIds: act.chapterIds.filter(id => id !== chapterId) }))
          .map(act => {
            if (act.id !== toActId) {
              return act;
            }
            const chapterIds = [...act.chapterIds];
            chapterIds.splice(Math.min(Math.max(0, toIndex), chapterIds.length), 0, chapterId);
            return { ...act, chapterIds };
          });
        return { projects: { ...state.projects, [project.id]: { ...project, acts, updatedAt: Date.now() } } };
      }),

    duplicateChapter: chapterId => {
      const source = get().chapters[chapterId];
      const project = source ? get().projects[source.projectId] : undefined;
      if (!source || !project) {
        return null;
      }
      const act = project.acts.find(a => a.chapterIds.includes(chapterId));
      const newId = get().addChapter(project.id, {
        actId: act?.id,
        index: act ? act.chapterIds.indexOf(chapterId) + 1 : undefined,
        title: t('{title} (copy)', { title: source.title }),
        summary: source.summary,
        goal: source.goal,
      });
      get().updateChapter(newId, { characterIds: [...source.characterIds] });
      get().replaceScript(
        newId,
        source.sceneIds
          .map(id => get().scenes[id])
          .filter(Boolean)
          .map(scene => ({ description: scene.description, blocks: cloneBlocks(scene.blocks) })),
      );
      return newId;
    },

    removeChapter: chapterId =>
      set(state => {
        const chapter = state.chapters[chapterId];
        if (!chapter) {
          return state;
        }
        const project = state.projects[chapter.projectId];
        const projects = project
          ? {
              ...state.projects,
              [project.id]: {
                ...project,
                acts: project.acts.map(act => ({
                  ...act,
                  chapterIds: act.chapterIds.filter(id => id !== chapterId),
                })),
                updatedAt: Date.now(),
              },
            }
          : state.projects;
        return {
          projects,
          chapters: omit(state.chapters, [chapterId]),
          scenes: omit(state.scenes, chapter.sceneIds),
          pages: omit(state.pages, chapter.pageIds),
        };
      }),
  };
}
