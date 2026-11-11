import type { Block, Character, Chapter, Page, Project, Scene, StoryData } from '../../src/core/model/types';
import type { Metrics } from '../../src/core/studio/types';
import { DAY_MS, dayKeyToDate } from '../../src/core/util/time';

export const TODAY = '2026-11-11';
/** Noon today, so "days ago" never lands across midnight. */
export const NOW = dayKeyToDate(TODAY).getTime() + 12 * 60 * 60 * 1000;
export const daysAgo = (days: number) => NOW - days * DAY_MS;

export function emptyStory(): StoryData {
  return { projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} };
}

export function zeroMetrics(patch: Partial<Metrics> = {}): Metrics {
  return {
    projects: 0,
    projectsDone: 0,
    chapters: 0,
    chaptersWritten: 0,
    chaptersDone: 0,
    pages: 0,
    pagesDone: 0,
    panelsDrawn: 0,
    bubbles: 0,
    sfx: 0,
    effects: 0,
    characters: 0,
    charactersFull: 0,
    relations: 0,
    worldEntries: 0,
    scriptWords: 0,
    dialogueLines: 0,
    strokes: 0,
    streak: 0,
    bestStreak: 0,
    activeDays: 0,
    promptsDone: 0,
    giftsOpened: 0,
    ...patch,
  };
}

export function addProject(state: StoryData, id: string, title: string, patch: Partial<Project> = {}): Project {
  const project: Project = {
    id,
    title,
    genres: ['Action'],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
    done: false,
    acts: [{ id: `${id}-act`, title: '', chapterIds: [] }],
    createdAt: daysAgo(40),
    updatedAt: NOW,
    ...patch,
  };
  state.projects[id] = project;
  return project;
}

export function addChapter(state: StoryData, projectId: string, id: string, patch: Partial<Chapter> = {}): Chapter {
  const chapter: Chapter = {
    id,
    projectId,
    title: 'Chapter 1',
    summary: '',
    goal: '',
    characterIds: [],
    sceneIds: [],
    pageIds: [],
    createdAt: daysAgo(30),
    updatedAt: NOW,
    ...patch,
  };
  state.chapters[id] = chapter;
  state.projects[projectId].acts[0].chapterIds.push(id);
  return chapter;
}

export function addScene(state: StoryData, chapterId: string, id: string, blocks: Omit<Block, 'id'>[]): Scene {
  const scene: Scene = { id, chapterId, description: '', blocks: blocks.map((block, index) => ({ id: `${id}-b${index}`, ...block })) };
  state.scenes[id] = scene;
  state.chapters[chapterId].sceneIds.push(id);
  return scene;
}

export function addPage(state: StoryData, chapterId: string, id: string, patch: Partial<Page> = {}): Page {
  const page: Page = {
    id,
    chapterId,
    layout: { kind: 'panel', id: `${id}-p1` },
    panels: { [`${id}-p1`]: { id: `${id}-p1`, bleed: false, borderless: false, description: '', blockIds: [] } },
    gutterH: 0,
    gutterV: 0,
    done: false,
    bubbles: [],
    effects: [],
    artRev: 0,
    updatedAt: NOW,
    ...patch,
  };
  state.pages[id] = page;
  state.chapters[chapterId].pageIds.push(id);
  return page;
}

export function addCharacter(state: StoryData, projectId: string, id: string, patch: Partial<Character> = {}): Character {
  const character: Character = {
    id,
    projectId,
    name: id,
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
    createdAt: daysAgo(35),
    updatedAt: NOW,
    ...patch,
  };
  state.characters[id] = character;
  return character;
}

const LINES: Omit<Block, 'id'>[] = [
  { type: 'setting', text: 'A bakery on the moon, before dawn.' },
  { type: 'action', text: 'Aki kicks the oven door open.' },
  { type: 'dialogue', text: 'The bread is alive!', characterId: 'aki', kind: 'shout' },
  { type: 'dialogue', text: 'Of course it is. I made it.', characterId: 'kuro' },
  { type: 'sfx', text: 'FWOOSH' },
  { type: 'dialogue', text: 'Then we fight it together.', characterId: 'hina' },
  { type: 'narration', text: 'Nobody slept that night.' },
];

/**
 * A story with three chapters: chapter 1 finished and drawn, chapter 2 half drawn, chapter 3 still empty.
 * Aki (main), Kuro (villain) and Hina (support), and one place.
 */
export function sampleStory(): StoryData {
  const state = emptyStory();
  addProject(state, 'p1', 'Moon Bakery');
  addCharacter(state, 'p1', 'aki', {
    name: 'Aki',
    role: 'main',
    traits: ['brave', 'clumsy'],
    goal: 'open the best bakery on the moon',
    weakness: 'cannot say no',
    createdAt: daysAgo(39),
  });
  addCharacter(state, 'p1', 'kuro', { name: 'Kuro', role: 'villain', traits: ['cold'] });
  addCharacter(state, 'p1', 'hina', { name: 'Hina', role: 'support', traits: ['kind'] });
  state.world.pier = {
    id: 'pier',
    projectId: 'p1',
    type: 'place',
    title: 'Old Pier',
    body: '',
    images: [],
    characterIds: [],
    sendToAi: false,
    order: 0,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  };
  addChapter(state, 'p1', 'c1', { characterIds: ['aki', 'kuro', 'hina'], updatedAt: daysAgo(14) });
  addScene(state, 'c1', 's1', LINES);
  for (let index = 0; index < 6; index++) {
    addPage(state, 'c1', `c1p${index}`, {
      done: true,
      artRev: 3,
      updatedAt: daysAgo(20 - index),
      bubbles: [],
      effects: [{ id: `e${index}`, panelId: `c1p${index}-p1`, type: 'speed', density: 1, angle: 0, cx: 0, cy: 0, opacity: 1 }],
    });
  }
  addChapter(state, 'p1', 'c2', { title: 'Chapter 2', characterIds: ['aki'], updatedAt: daysAgo(2) });
  addScene(state, 'c2', 's2', LINES.slice(0, 4));
  addPage(state, 'c2', 'c2p0', { done: true, artRev: 1, updatedAt: daysAgo(2) });
  addPage(state, 'c2', 'c2p1', { updatedAt: daysAgo(2) });
  addPage(state, 'c2', 'c2p2', { updatedAt: daysAgo(2) });
  addChapter(state, 'p1', 'c3', { title: 'Chapter 3', updatedAt: daysAgo(25) });
  return state;
}
