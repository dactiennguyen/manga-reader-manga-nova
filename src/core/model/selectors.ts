import type {
  Chapter,
  ChapterStatus,
  Character,
  ID,
  Page,
  PageStatus,
  Project,
  ProjectStatus,
  Relation,
  StoryData,
  WorldEntry,
} from './types';

export function chapterIdsOf(project: Project | undefined): ID[] {
  return project ? project.acts.flatMap(act => act.chapterIds) : [];
}

export function chaptersOf(state: StoryData, projectId: ID): Chapter[] {
  return chapterIdsOf(state.projects[projectId])
    .map(id => state.chapters[id])
    .filter(Boolean);
}

export function chapterNumber(project: Project | undefined, chapterId: ID): number {
  return chapterIdsOf(project).indexOf(chapterId) + 1;
}

export function chapterLabel(state: StoryData, chapterId: ID): string {
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return '';
  }
  const number = chapterNumber(state.projects[chapter.projectId], chapterId);
  const title = chapter.title.trim();
  return isDefaultChapterTitle(title) ? `Chapter ${number}` : `Chapter ${number} · ${title}`;
}

export function isDefaultChapterTitle(title: string): boolean {
  return /^(chapter \d+)?$/i.test(title.trim());
}

export function chapterName(title: string, number: number): string {
  return isDefaultChapterTitle(title) ? `Chapter ${number}` : title.trim();
}

/** `hasArt` comes from the art store, so this file stays free of storage. */
export function pageStatus(page: Page, hasArt: (panelId: ID) => boolean = () => false): PageStatus {
  if (page.done) {
    return 'done';
  }
  if (!page.layout) {
    return 'empty';
  }
  const drawn = Object.keys(page.panels).some(hasArt);
  return drawn || page.bubbles.length > 0 ? 'drawing' : 'paneled';
}

export function chapterProgress(state: StoryData, chapterId: ID): { done: number; total: number } {
  const pages = (state.chapters[chapterId]?.pageIds ?? []).map(id => state.pages[id]).filter(Boolean);
  return { done: pages.filter(page => page.done).length, total: pages.length };
}

function chapterHasScript(state: StoryData, chapter: Chapter): boolean {
  return chapter.sceneIds.some(id => state.scenes[id]?.blocks.some(block => block.text.trim()));
}

export function chapterStatus(state: StoryData, chapterId: ID): ChapterStatus {
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return 'unwritten';
  }
  const { done, total } = chapterProgress(state, chapterId);
  if (total > 0) {
    return done === total ? 'done' : 'drawing';
  }
  return chapterHasScript(state, chapter) ? 'writing' : 'unwritten';
}

export function scriptOutdated(chapter: Chapter): boolean {
  return (
    chapter.pageIds.length > 0 &&
    chapter.paginatedAt !== undefined &&
    chapter.scriptChangedAt !== undefined &&
    chapter.scriptChangedAt > chapter.paginatedAt
  );
}

export function projectProgress(state: StoryData, projectId: ID): { done: number; total: number; ratio: number } {
  let done = 0;
  let total = 0;
  for (const chapterId of chapterIdsOf(state.projects[projectId])) {
    const progress = chapterProgress(state, chapterId);
    done += progress.done;
    total += progress.total;
  }
  return { done, total, ratio: total ? done / total : 0 };
}

export function projectStatus(state: StoryData, projectId: ID): ProjectStatus {
  const project = state.projects[projectId];
  if (project?.done) {
    return 'done';
  }
  return projectProgress(state, projectId).total > 0 ? 'active' : 'draft';
}

export function activeProjects(state: StoryData): Project[] {
  return Object.values(state.projects)
    .filter(project => !project.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function trashedProjects(state: StoryData): Project[] {
  return Object.values(state.projects)
    .filter(project => !!project.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export function charactersOf(state: StoryData, projectId: ID): Character[] {
  const rank = { main: 0, villain: 1, support: 2, extra: 3 } as const;
  return Object.values(state.characters)
    .filter(character => character.projectId === projectId)
    .sort((a, b) => rank[a.role] - rank[b.role] || a.createdAt - b.createdAt);
}

export function relationsOf(state: StoryData, characterId: ID): { relation: Relation; other: Character }[] {
  return Object.values(state.relations)
    .filter(relation => relation.a === characterId || relation.b === characterId)
    .map(relation => ({
      relation,
      other: state.characters[relation.a === characterId ? relation.b : relation.a],
    }))
    .filter(item => !!item.other);
}

export function worldOf(state: StoryData, projectId: ID): WorldEntry[] {
  return Object.values(state.world)
    .filter(entry => entry.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

export function pageNumber(state: StoryData, pageId: ID): { index: number; total: number } {
  const page = state.pages[pageId];
  const ids = page ? state.chapters[page.chapterId]?.pageIds ?? [] : [];
  return { index: ids.indexOf(pageId) + 1, total: ids.length };
}

export function characterUsage(
  state: StoryData,
  characterId: ID,
): { dialogues: number; bubbles: number; chapterIds: ID[] } {
  const character = state.characters[characterId];
  let dialogues = 0;
  let bubbles = 0;
  const chapterIds: ID[] = [];
  for (const chapter of character ? chaptersOf(state, character.projectId) : []) {
    let used = chapter.characterIds.includes(characterId);
    for (const sceneId of chapter.sceneIds) {
      const count = state.scenes[sceneId]?.blocks.filter(block => block.characterId === characterId).length ?? 0;
      dialogues += count;
      used = used || count > 0;
    }
    for (const pageId of chapter.pageIds) {
      bubbles += state.pages[pageId]?.bubbles.filter(bubble => bubble.characterId === characterId).length ?? 0;
    }
    if (used) {
      chapterIds.push(chapter.id);
    }
  }
  return { dialogues, bubbles, chapterIds };
}

export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}
