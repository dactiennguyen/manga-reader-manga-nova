import { buildProjectBundle, mapBundleImages, remapBundleIds } from '../../archive/bundle';
import { cleanLanguageName, dropTranslations, languageNameError, renameTranslations } from '../../lettering/translation';
import { DEFAULT_ACT_TITLES, LIMITS } from '../../model/constants';
import type { Act, Bubble, Chapter, ID, Page, PanelArt, Project, StoryData } from '../../model/types';
import { uid } from '../../util/id';
import { omit } from './helpers';
import type { ProjectActions, StoryArt, StoryGet, StorySet } from './types';

function mapProjectBubbles(state: StoryData, projectId: ID, change: (bubble: Bubble) => Bubble): Record<ID, Page> {
  const pages = { ...state.pages };
  for (const chapter of Object.values(state.chapters)) {
    if (chapter.projectId !== projectId) {
      continue;
    }
    for (const pageId of chapter.pageIds) {
      const page = pages[pageId];
      if (!page) {
        continue;
      }
      const bubbles = page.bubbles.map(change);
      if (bubbles.some((bubble, index) => bubble !== page.bubbles[index])) {
        pages[pageId] = { ...page, bubbles };
      }
    }
  }
  return pages;
}

function byId<T extends { id: ID }>(items: T[]): Record<ID, T> {
  const record: Record<ID, T> = {};
  for (const item of items) {
    record[item.id] = item;
  }
  return record;
}

export function createProjectActions(set: StorySet, get: StoryGet, art: StoryArt): ProjectActions {
  return {
    createProject: input => {
      const now = Date.now();
      const projectId = uid();
      const chapterId = uid();
      const acts: Act[] = DEFAULT_ACT_TITLES.map((title, index) => ({
        id: uid(),
        title,
        chapterIds: index === 0 ? [chapterId] : [],
      }));
      const project: Project = { ...input, id: projectId, done: false, acts, createdAt: now, updatedAt: now };
      const chapter: Chapter = {
        id: chapterId,
        projectId,
        title: 'Chapter 1',
        summary: '',
        goal: '',
        characterIds: [],
        sceneIds: [],
        pageIds: [],
        createdAt: now,
        updatedAt: now,
      };
      set(state => ({
        projects: { ...state.projects, [projectId]: project },
        chapters: { ...state.chapters, [chapterId]: chapter },
      }));
      return projectId;
    },

    updateProject: (projectId, patch) =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        return { projects: { ...state.projects, [projectId]: { ...project, ...patch, updatedAt: Date.now() } } };
      }),

    addLanguage: (projectId, name) => {
      const project = get().projects[projectId];
      const languages = project?.languages ?? [];
      if (!project || languageNameError(languages, name)) {
        return null;
      }
      const clean = cleanLanguageName(name);
      get().updateProject(projectId, { languages: [...languages, clean] });
      return clean;
    },

    renameLanguage: (projectId, from, to) => {
      const project = get().projects[projectId];
      const languages = project?.languages ?? [];
      if (!project || !languages.includes(from) || languageNameError(languages, to, from)) {
        return null;
      }
      const clean = cleanLanguageName(to);
      if (clean === from) {
        return clean;
      }
      set(state => ({
        projects: {
          ...state.projects,
          [projectId]: {
            ...project,
            languages: languages.map(item => (item === from ? clean : item)),
            updatedAt: Date.now(),
          },
        },
        pages: mapProjectBubbles(state, projectId, bubble => renameTranslations(bubble, from, clean)),
      }));
      return clean;
    },

    removeLanguage: (projectId, name) =>
      set(state => {
        const project = state.projects[projectId];
        if (!project || !project.languages?.includes(name)) {
          return state;
        }
        const languages = project.languages.filter(item => item !== name);
        return {
          projects: {
            ...state.projects,
            [projectId]: { ...project, languages: languages.length ? languages : undefined, updatedAt: Date.now() },
          },
          pages: mapProjectBubbles(state, projectId, bubble => dropTranslations(bubble, name)),
        };
      }),

    setLastOpened: (projectId, lastOpened) =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        return { projects: { ...state.projects, [projectId]: { ...project, lastOpened } } };
      }),

    trashProject: projectId =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        return { projects: { ...state.projects, [projectId]: { ...project, deletedAt: Date.now() } } };
      }),

    restoreProject: projectId =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        const rest = { ...project };
        delete rest.deletedAt;
        return { projects: { ...state.projects, [projectId]: rest } };
      }),

    deleteProjectForever: projectId =>
      set(state => {
        const project = state.projects[projectId];
        if (!project) {
          return state;
        }
        const chapterIds = project.acts.flatMap(act => act.chapterIds);
        const sceneIds = chapterIds.flatMap(id => state.chapters[id]?.sceneIds ?? []);
        const pageIds = chapterIds.flatMap(id => state.chapters[id]?.pageIds ?? []);
        const ofProject = <T extends { projectId: ID }>(record: Record<ID, T>) =>
          Object.values(record)
            .filter(item => item.projectId === projectId)
            .map(item => (item as T & { id: ID }).id);
        return {
          projects: omit(state.projects, [projectId]),
          chapters: omit(state.chapters, chapterIds),
          scenes: omit(state.scenes, sceneIds),
          pages: omit(state.pages, pageIds),
          characters: omit(state.characters, ofProject(state.characters)),
          relations: omit(state.relations, ofProject(state.relations)),
          world: omit(state.world, ofProject(state.world)),
        };
      }),

    duplicateProject: (projectId, mapImage = () => undefined) => {
      const bundle = buildProjectBundle(get(), projectId, art.exportArt);
      if (!bundle) {
        return null;
      }
      const copy = mapBundleImages(remapBundleIds(bundle), mapImage);
      const now = Date.now();
      const project: Project = {
        ...copy.project,
        title: `${bundle.project.title} (copy)`,
        createdAt: now,
        updatedAt: now,
      };
      delete project.deletedAt;
      get().mergeEntities({
        projects: { [project.id]: project },
        chapters: byId(copy.chapters),
        scenes: byId(copy.scenes),
        characters: byId(copy.characters),
        relations: byId(copy.relations),
        world: byId(copy.world),
        pages: byId(copy.pages),
      });
      for (const [panelId, panelArt] of Object.entries(copy.art)) {
        art.saveArt(panelId, JSON.parse(JSON.stringify(panelArt)) as PanelArt);
      }
      return project.id;
    },

    purgeTrash: (now = Date.now()) => {
      const limit = LIMITS.trashDays * 24 * 60 * 60 * 1000;
      Object.values(get().projects)
        .filter(project => project.deletedAt && now - project.deletedAt > limit)
        .forEach(project => get().deleteProjectForever(project.id));
    },
  };
}
