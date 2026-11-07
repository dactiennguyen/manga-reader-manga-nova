import { buildProjectBundle, mapBundleImages, remapBundleIds } from '../archive/bundle';
import {
  DEFAULT_GUTTER_H,
  DEFAULT_GUTTER_V,
  TEMPLATES,
  WEBTOON_DEFAULT_H,
  buildTemplate,
  collectPanelIds,
  defaultTemplate,
  panelOrder,
} from '../layout/layout';
import { cleanLanguageName, dropTranslations, languageNameError, renameTranslations } from '../lettering/translation';
import { DEFAULT_ACT_TITLES, LIMITS } from '../model/constants';
import type { PagePlan } from '../model/paginate';
import type {
  Act,
  ArtStyle,
  Block,
  Bubble,
  Chapter,
  Character,
  ID,
  LastOpened,
  LayoutNode,
  Page,
  PageSize,
  Panel,
  PanelArt,
  Project,
  ProjectFormat,
  Relation,
  Scene,
  StoryData,
  WorldEntry,
  WorldType,
} from '../model/types';
import { uid } from '../util/id';

export type NewProjectInput = {
  title: string;
  genres: string[];
  logline: string;
  format: ProjectFormat;
  pageSize: PageSize;
  style: ArtStyle;
  color: boolean;
  coverUri?: string;
};

export type SceneInit = { description?: string; blocks?: Block[] };

export type StoryActions = {
  createProject: (input: NewProjectInput) => ID;
  updateProject: (projectId: ID, patch: Partial<Omit<Project, 'id' | 'acts'>>) => void;
  addLanguage: (projectId: ID, name: string) => string | null;
  renameLanguage: (projectId: ID, from: string, to: string) => string | null;
  removeLanguage: (projectId: ID, name: string) => void;
  setLastOpened: (projectId: ID, lastOpened: LastOpened) => void;
  trashProject: (projectId: ID) => void;
  restoreProject: (projectId: ID) => void;
  deleteProjectForever: (projectId: ID) => void;
  duplicateProject: (projectId: ID, mapImage?: (path: string) => string | undefined) => ID | null;
  purgeTrash: (now?: number) => void;

  addAct: (projectId: ID, title?: string) => ID;
  renameAct: (projectId: ID, actId: ID, title: string) => void;
  moveAct: (projectId: ID, actId: ID, delta: -1 | 1) => void;
  removeAct: (projectId: ID, actId: ID, moveChaptersToActId?: ID) => void;

  addChapter: (
    projectId: ID,
    init?: { actId?: ID; index?: number; title?: string; summary?: string; goal?: string },
  ) => ID;
  updateChapter: (chapterId: ID, patch: Partial<Pick<Chapter, 'title' | 'summary' | 'goal' | 'characterIds'>>) => void;
  moveChapter: (chapterId: ID, toActId: ID, toIndex: number) => void;
  duplicateChapter: (chapterId: ID) => ID | null;
  removeChapter: (chapterId: ID) => void;

  addScene: (chapterId: ID, init?: SceneInit & { index?: number }) => ID;
  updateScene: (sceneId: ID, patch: Partial<Pick<Scene, 'description' | 'blocks' | 'collapsed'>>) => void;
  moveScene: (chapterId: ID, from: number, to: number) => void;
  removeScene: (sceneId: ID) => void;
  replaceScript: (chapterId: ID, scenes: SceneInit[]) => void;

  addCharacter: (projectId: ID, init?: Partial<Omit<Character, 'id' | 'projectId'>>) => ID;
  updateCharacter: (characterId: ID, patch: Partial<Omit<Character, 'id' | 'projectId'>>) => void;
  duplicateCharacter: (characterId: ID) => ID | null;
  removeCharacter: (characterId: ID) => void;
  addRelation: (projectId: ID, a: ID, b: ID, label: string, note?: string) => ID;
  updateRelation: (relationId: ID, patch: Partial<Pick<Relation, 'label' | 'note'>>) => void;
  removeRelation: (relationId: ID) => void;

  addWorldEntry: (projectId: ID, type: WorldType, init?: Partial<Omit<WorldEntry, 'id' | 'projectId'>>) => ID;
  updateWorldEntry: (entryId: ID, patch: Partial<Omit<WorldEntry, 'id' | 'projectId'>>) => void;
  removeWorldEntry: (entryId: ID) => void;

  addPage: (chapterId: ID, init?: { index?: number; templateId?: string; plan?: PagePlan; height?: number }) => ID;
  updatePage: (pageId: ID, patch: Partial<Omit<Page, 'id' | 'chapterId'>>) => void;
  updatePanel: (pageId: ID, panelId: ID, patch: Partial<Omit<Panel, 'id'>>) => void;
  applyTemplate: (pageId: ID, templateId: string) => void;
  bumpArt: (pageId: ID) => void;
  movePage: (chapterId: ID, from: number, to: number) => void;
  duplicatePage: (pageId: ID) => ID | null;
  removePage: (pageId: ID) => void;
  applyPagination: (chapterId: ID, plans: PagePlan[], mode: 'append' | 'replace') => ID[];

  mergeEntities: (data: Partial<StoryData>) => void;
};


/** What the actions need from the art store. Panels keep their art when a page drops them, so undo gets it back. */
export type StoryArt = {
  copyArt: (fromPanelId: ID, toPanelId: ID) => void;
  saveArt: (panelId: ID, art: PanelArt) => void;
  exportArt: (panelIds: ID[]) => Record<ID, PanelArt>;
};

export type StorySet = (change: (state: StoryData) => Partial<StoryData> | StoryData) => void;

export const EMPTY_STORY: StoryData = {
  projects: {},
  chapters: {},
  scenes: {},
  characters: {},
  relations: {},
  world: {},
  pages: {},
};

function omit<T>(record: Record<ID, T>, ids: Iterable<ID>): Record<ID, T> {
  const next = { ...record };
  for (const id of ids) {
    delete next[id];
  }
  return next;
}

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(0, to), next.length), 0, item);
  return next;
}

function touchProject(projects: Record<ID, Project>, projectId: ID | undefined, now: number): Record<ID, Project> {
  const project = projectId ? projects[projectId] : undefined;
  return project ? { ...projects, [project.id]: { ...project, updatedAt: now } } : projects;
}

function newPanel(id: ID, init?: Partial<Panel>): Panel {
  return { id, bleed: false, borderless: false, description: '', blockIds: [], ...init };
}

function panelsFromPlan(
  format: ProjectFormat,
  plan: PagePlan | undefined,
  templateId: string | undefined,
): { layout: LayoutNode | null; panels: Record<ID, Panel> } {
  const template = templateId
    ? TEMPLATES.find(t => t.id === templateId)
    : plan?.panels.length
    ? defaultTemplate(format, plan.panels.length)
    : undefined;
  if (!template) {
    return { layout: null, panels: {} };
  }
  const built = buildTemplate(template, uid);
  const order = panelOrder({ layout: built.layout }, format === 'manga');
  const panels: Record<ID, Panel> = {};
  order.forEach((id, index) => {
    const planned = plan?.panels[index];
    panels[id] = newPanel(id, {
      bleed: built.bleedIds.includes(id),
      description: planned?.description ?? '',
      shot: planned?.shot,
      blockIds: planned?.blockIds ?? [],
    });
  });
  const overflow = plan?.panels.slice(order.length) ?? [];
  const last = panels[order[order.length - 1]];
  if (last && overflow.length) {
    // Webtoon strips stop at 6 panels while a plan can hold more, so the last panel takes the rest.
    last.blockIds = [...last.blockIds, ...overflow.flatMap(item => item.blockIds)];
    last.description = [last.description, ...overflow.map(item => item.description)].filter(Boolean).join(' ');
  }
  return { layout: built.layout, panels };
}

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

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map(block => ({ ...block, id: uid() }));
}

export function createStoryActions(
  set: StorySet,
  get: () => StoryData & StoryActions,
  art: StoryArt,
): StoryActions {
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

  addAct: (projectId, title) => {
    const actId = uid();
    set(state => {
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }
      const act: Act = { id: actId, title: title ?? `Act ${project.acts.length + 1}`, chapterIds: [] };
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
      title: `${source.title} (copy)`,
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
      name: `${source.name} (copy)`,
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

  addPage: (chapterId, init = {}) => {
    const pageId = uid();
    set(state => {
      const chapter = state.chapters[chapterId];
      const project = chapter ? state.projects[chapter.projectId] : undefined;
      if (!chapter || !project) {
        return state;
      }
      const now = Date.now();
      const { layout, panels } = panelsFromPlan(project.format, init.plan, init.templateId);
      const page: Page = {
        id: pageId,
        chapterId,
        layout,
        panels,
        gutterH: DEFAULT_GUTTER_H,
        gutterV: DEFAULT_GUTTER_V,
        height: project.format === 'webtoon' ? init.height ?? WEBTOON_DEFAULT_H : undefined,
        done: false,
        bubbles: [],
        effects: [],
        artRev: 0,
        updatedAt: now,
      };
      const pageIds = [...chapter.pageIds];
      pageIds.splice(init.index ?? pageIds.length, 0, pageId);
      return {
        pages: { ...state.pages, [pageId]: page },
        chapters: { ...state.chapters, [chapterId]: { ...chapter, pageIds, updatedAt: now } },
        projects: touchProject(state.projects, project.id, now),
      };
    });
    return pageId;
  },

  updatePage: (pageId, patch) =>
    set(state => {
      const page = state.pages[pageId];
      if (!page) {
        return state;
      }
      const now = Date.now();
      const next: Page = { ...page, ...patch, updatedAt: now };
      if (patch.layout !== undefined || patch.panels !== undefined) {
        const alive = new Set(collectPanelIds(next.layout));
        const panels: Record<ID, Panel> = {};
        for (const id of alive) {
          panels[id] = next.panels[id] ?? newPanel(id);
        }
        next.panels = panels;
        next.effects = next.effects.filter(effect => alive.has(effect.panelId));
        if (next.order && !(next.order.length === alive.size && next.order.every(id => alive.has(id)))) {
          next.order = undefined;
        }
      }
      const projectId = state.chapters[page.chapterId]?.projectId;
      return {
        pages: { ...state.pages, [pageId]: next },
        projects: touchProject(state.projects, projectId, now),
      };
    }),

  updatePanel: (pageId, panelId, patch) =>
    set(state => {
      const page = state.pages[pageId];
      const panel = page?.panels[panelId];
      if (!page || !panel) {
        return state;
      }
      return {
        pages: {
          ...state.pages,
          [pageId]: {
            ...page,
            panels: { ...page.panels, [panelId]: { ...panel, ...patch } },
            updatedAt: Date.now(),
          },
        },
      };
    }),

  applyTemplate: (pageId, templateId) => {
    const state = get();
    const page = state.pages[pageId];
    const project = page ? state.projects[state.chapters[page.chapterId]?.projectId] : undefined;
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!page || !project || !template) {
      return;
    }
    const rtl = project.format === 'manga';
    const existing = panelOrder(page, rtl);
    const built = buildTemplate(template, uid);
    const slots = panelOrder({ layout: built.layout }, rtl);
    const remap = new Map<ID, ID>();
    slots.forEach((slotId, index) => {
      if (existing[index]) {
        remap.set(slotId, existing[index]);
      }
    });
    const rename = (node: LayoutNode): LayoutNode =>
      node.kind === 'panel'
        ? { kind: 'panel', id: remap.get(node.id) ?? node.id }
        : { ...node, a: rename(node.a), b: rename(node.b) };
    const panels: Record<ID, Panel> = {};
    slots.forEach(slotId => {
      const id = remap.get(slotId) ?? slotId;
      panels[id] = page.panels[id] ?? newPanel(id, { bleed: built.bleedIds.includes(slotId) });
    });
    state.updatePage(pageId, { layout: rename(built.layout), panels, order: undefined });
  },

  bumpArt: pageId =>
    set(state => {
      const page = state.pages[pageId];
      if (!page) {
        return state;
      }
      const now = Date.now();
      const projectId = state.chapters[page.chapterId]?.projectId;
      return {
        pages: { ...state.pages, [pageId]: { ...page, artRev: page.artRev + 1, updatedAt: now } },
        projects: touchProject(state.projects, projectId, now),
      };
    }),

  movePage: (chapterId, from, to) =>
    set(state => {
      const chapter = state.chapters[chapterId];
      if (!chapter) {
        return state;
      }
      return {
        chapters: {
          ...state.chapters,
          [chapterId]: { ...chapter, pageIds: moveItem(chapter.pageIds, from, to), updatedAt: Date.now() },
        },
      };
    }),

  duplicatePage: pageId => {
    const state = get();
    const source = state.pages[pageId];
    const chapter = source ? state.chapters[source.chapterId] : undefined;
    if (!source || !chapter) {
      return null;
    }
    const idMap = new Map<ID, ID>();
    const mapId = (id: ID) => {
      if (!idMap.has(id)) {
        idMap.set(id, uid());
      }
      return idMap.get(id)!;
    };
    const cloneNode = (node: LayoutNode): LayoutNode =>
      node.kind === 'panel'
        ? { kind: 'panel', id: mapId(node.id) }
        : { ...node, id: uid(), a: cloneNode(node.a), b: cloneNode(node.b) };
    const layout = source.layout ? cloneNode(source.layout) : null;
    const panels: Record<ID, Panel> = {};
    for (const panel of Object.values(source.panels)) {
      const id = mapId(panel.id);
      panels[id] = { ...panel, id, blockIds: [] };
      art.copyArt(panel.id, id);
    }
    const newPageId = uid();
    const now = Date.now();
    const page: Page = {
      ...source,
      id: newPageId,
      layout,
      panels,
      order: source.order?.map(mapId),
      done: false,
      flag: undefined,
      bubbles: source.bubbles.map(bubble => ({ ...bubble, id: uid(), blockId: undefined })),
      effects: source.effects.map(effect => ({ ...effect, id: uid(), panelId: mapId(effect.panelId) })),
      artRev: 0,
      updatedAt: now,
    };
    const pageIds = [...chapter.pageIds];
    pageIds.splice(pageIds.indexOf(pageId) + 1, 0, newPageId);
    set(current => ({
      pages: { ...current.pages, [newPageId]: page },
      chapters: { ...current.chapters, [chapter.id]: { ...current.chapters[chapter.id], pageIds, updatedAt: now } },
    }));
    return newPageId;
  },

  removePage: pageId =>
    set(state => {
      const page = state.pages[pageId];
      if (!page) {
        return state;
      }
      const chapter = state.chapters[page.chapterId];
      return {
        pages: omit(state.pages, [pageId]),
        chapters: chapter
          ? {
              ...state.chapters,
              [chapter.id]: {
                ...chapter,
                pageIds: chapter.pageIds.filter(id => id !== pageId),
                updatedAt: Date.now(),
              },
            }
          : state.chapters,
      };
    }),

  applyPagination: (chapterId, plans, mode) => {
    const chapter = get().chapters[chapterId];
    if (!chapter) {
      return [];
    }
    if (mode === 'replace') {
      [...chapter.pageIds].forEach(id => get().removePage(id));
    }
    const ids = plans.map(plan => get().addPage(chapterId, { plan }));
    set(state => {
      const current = state.chapters[chapterId];
      return current
        ? { chapters: { ...state.chapters, [chapterId]: { ...current, paginatedAt: Date.now() } } }
        : state;
    });
    return ids;
  },

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
