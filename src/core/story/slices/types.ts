import type { PagePlan } from '../../model/paginate';
import type {
  ArtStyle,
  Block,
  Chapter,
  Character,
  ID,
  LastOpened,
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
} from '../../model/types';

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

export type ProjectActions = {
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
};

export type ChapterActions = {
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
};

export type SceneActions = {
  addScene: (chapterId: ID, init?: SceneInit & { index?: number }) => ID;
  updateScene: (sceneId: ID, patch: Partial<Pick<Scene, 'description' | 'blocks' | 'collapsed'>>) => void;
  moveScene: (chapterId: ID, from: number, to: number) => void;
  removeScene: (sceneId: ID) => void;
  replaceScript: (chapterId: ID, scenes: SceneInit[]) => void;
};

export type CharacterActions = {
  addCharacter: (projectId: ID, init?: Partial<Omit<Character, 'id' | 'projectId'>>) => ID;
  updateCharacter: (characterId: ID, patch: Partial<Omit<Character, 'id' | 'projectId'>>) => void;
  duplicateCharacter: (characterId: ID) => ID | null;
  removeCharacter: (characterId: ID) => void;
  addRelation: (projectId: ID, a: ID, b: ID, label: string, note?: string) => ID;
  updateRelation: (relationId: ID, patch: Partial<Pick<Relation, 'label' | 'note'>>) => void;
  removeRelation: (relationId: ID) => void;
};

export type WorldActions = {
  addWorldEntry: (projectId: ID, type: WorldType, init?: Partial<Omit<WorldEntry, 'id' | 'projectId'>>) => ID;
  updateWorldEntry: (entryId: ID, patch: Partial<Omit<WorldEntry, 'id' | 'projectId'>>) => void;
  removeWorldEntry: (entryId: ID) => void;
};

export type PageActions = {
  addPage: (chapterId: ID, init?: { index?: number; templateId?: string; plan?: PagePlan; height?: number }) => ID;
  updatePage: (pageId: ID, patch: Partial<Omit<Page, 'id' | 'chapterId'>>) => void;
  updatePanel: (pageId: ID, panelId: ID, patch: Partial<Omit<Panel, 'id'>>) => void;
  applyTemplate: (pageId: ID, templateId: string) => void;
  bumpArt: (pageId: ID) => void;
  movePage: (chapterId: ID, from: number, to: number) => void;
  duplicatePage: (pageId: ID) => ID | null;
  removePage: (pageId: ID) => void;
  applyPagination: (chapterId: ID, plans: PagePlan[], mode: 'append' | 'replace') => ID[];
};

export type StoryActions = ProjectActions &
  ChapterActions &
  SceneActions &
  CharacterActions &
  WorldActions &
  PageActions & {
    mergeEntities: (data: Partial<StoryData>) => void;
  };

/** What the actions need from the art store. Panels keep their art when a page drops them, so undo gets it back. */
export type StoryArt = {
  copyArt: (fromPanelId: ID, toPanelId: ID) => void;
  saveArt: (panelId: ID, art: PanelArt) => void;
  exportArt: (panelIds: ID[]) => Record<ID, PanelArt>;
};

export type StorySet = (change: (state: StoryData) => Partial<StoryData> | StoryData) => void;

export type StoryGet = () => StoryData & StoryActions;
