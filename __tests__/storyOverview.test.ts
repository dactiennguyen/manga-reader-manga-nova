import { assistantProject, latestProject, noteTitleFor, whereOf } from '../src/core/assistant/where';
import { DAILY_TIPS } from '../src/core/model/constants';
import type { Act, Project } from '../src/core/model/types';
import {
  actForNewChapter,
  canMoveChapterDown,
  canMoveChapterUp,
  chapterMove,
} from '../src/core/story/chapterOrder';
import { pickIdeas, tipOfDay } from '../src/core/story/ideas';
import { libraryCounts, libraryGrid, libraryRows, visibleRows } from '../src/core/story/library';
import { genresFavoritesFirst, knownGenres, titleTaken } from '../src/core/story/newProject';
import { nextStepOf } from '../src/core/story/nextStep';
import { resumeTarget } from '../src/core/story/resume';
import { storyStats, trashCountdown, trashDaysLeft } from '../src/core/story/stats';
import { DAY_MS } from '../src/core/util/time';
import { useStory } from '../src/state/useStory';

const story = () => useStory.getState();

function makeProject(title = 'T') {
  const projectId = story().createProject({
    title,
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
  });
  return { projectId, chapterId: story().projects[projectId].acts[0].chapterIds[0] };
}

const projectOf = (id: string): Project => story().projects[id];

beforeEach(() => {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
});

describe('resumeTarget', () => {
  it('falls back to the overview without a last screen', () => {
    const { projectId } = makeProject();
    expect(resumeTarget(story(), projectOf(projectId))).toEqual({
      where: 'Story overview',
      action: 'Open story',
      route: { name: 'Project', params: { projectId } },
    });
  });

  it('follows the last chapter screen', () => {
    const { projectId, chapterId } = makeProject();
    story().setLastOpened(projectId, { screen: 'Script', chapterId });
    const target = resumeTarget(story(), projectOf(projectId));
    expect(target.where).toBe('Chapter 1 script');
    expect(target.route).toEqual({ name: 'Script', params: { chapterId } });
  });

  it('falls back when the chapter is gone', () => {
    const { projectId } = makeProject();
    story().setLastOpened(projectId, { screen: 'Storyboard', chapterId: 'missing' });
    expect(resumeTarget(story(), projectOf(projectId)).route.name).toBe('Project');
  });

  it('opens the art view when the panel no longer exists', () => {
    const { projectId, chapterId } = makeProject();
    const pageId = story().addPage(chapterId, { templateId: 'g1' });
    story().setLastOpened(projectId, { screen: 'Canvas', pageId, panelId: 'missing' });
    const target = resumeTarget(story(), projectOf(projectId));
    expect(target.where).toBe('Chapter 1 · Page 1');
    expect(target.route).toEqual({ name: 'PanelLayout', params: { pageId, mode: 'art' } });
  });

  it('opens the canvas on a live panel', () => {
    const { projectId, chapterId } = makeProject();
    const pageId = story().addPage(chapterId, { templateId: 'g1' });
    const panelId = Object.keys(story().pages[pageId].panels)[0];
    story().setLastOpened(projectId, { screen: 'Canvas', pageId, panelId });
    expect(resumeTarget(story(), projectOf(projectId)).route).toEqual({
      name: 'Canvas',
      params: { pageId, panelId },
    });
  });
});

describe('nextStepOf', () => {
  it('suggests an outline for an unwritten story', () => {
    const { projectId, chapterId } = makeProject();
    const step = nextStepOf(story(), projectOf(projectId));
    expect(step.actions.map(action => action.route)).toEqual([
      { name: 'Outline', params: { projectId } },
      { name: 'Script', params: { chapterId } },
    ]);
  });

  it('puts flagged pages first', () => {
    const { projectId, chapterId } = makeProject();
    const pageId = story().addPage(chapterId);
    story().updatePage(pageId, { flag: 'fix' as never });
    expect(nextStepOf(story(), projectOf(projectId)).text).toBe('Chapter 1 has 1 flagged pages to fix.');
  });

  it('counts the pages left and offers export when all are done', () => {
    const { projectId, chapterId } = makeProject();
    const pageId = story().addPage(chapterId);
    expect(nextStepOf(story(), projectOf(projectId)).text).toBe('Chapter 1 has 1 page left.');
    story().updatePage(pageId, { done: true });
    expect(nextStepOf(story(), projectOf(projectId)).actions.map(action => action.label)).toEqual([
      'Preview',
      'Export',
    ]);
  });
});

describe('library', () => {
  it('filters by status and title, and sorts', () => {
    const a = makeProject('Beta');
    const b = makeProject('alpha');
    story().addPage(a.chapterId);
    const rows = libraryRows(story());
    expect(libraryCounts(rows)).toEqual({ all: 2, draft: 1, active: 1, done: 0 });
    expect(visibleRows(rows, 'active', '', 'updated').map(row => row.project.id)).toEqual([a.projectId]);
    expect(visibleRows(rows, 'all', ' ALPH ', 'updated').map(row => row.project.id)).toEqual([b.projectId]);
    expect(visibleRows(rows, 'all', '', 'title').map(row => row.project.title)).toEqual(['alpha', 'Beta']);
  });

  it('adds columns with width and keeps the list at one', () => {
    expect(libraryGrid(360, 'grid')).toEqual({ columns: 2, padding: 16, cardWidth: 158 });
    expect(libraryGrid(600, 'grid').columns).toBe(3);
    expect(libraryGrid(1000, 'grid').columns).toBe(5);
    expect(libraryGrid(1000, 'list').columns).toBe(1);
  });
});

describe('sample ideas and tips', () => {
  it('prefers favourite genres and never repeats', () => {
    const ideas = pickIdeas(['Sports', 'Sports', 'Unknown']);
    expect(ideas).toHaveLength(3);
    expect(ideas[0]).toContain('volleyball');
    expect(new Set(ideas).size).toBe(3);
  });

  it('gives one tip per day', () => {
    expect(DAILY_TIPS).toContain(tipOfDay('2026-11-07'));
    expect(tipOfDay('2026-11-07')).toBe(tipOfDay('2026-11-07'));
  });
});

describe('new project', () => {
  it('keeps known genres only, up to the limit', () => {
    expect(knownGenres(['Action', 'Nope', 'Action', 'Comedy', 'Horror', 'Sports'])).toEqual([
      'Action',
      'Comedy',
      'Horror',
    ]);
    expect(knownGenres(undefined)).toEqual([]);
  });

  it('lists favourites first', () => {
    expect(genresFavoritesFirst(['Mystery'])[0]).toBe('Mystery');
  });

  it('ignores trashed stories when checking titles', () => {
    const { projectId } = makeProject('Same');
    expect(titleTaken(story().projects, ' same ')).toBe(true);
    story().trashProject(projectId);
    expect(titleTaken(story().projects, 'same')).toBe(false);
  });
});

describe('stats and trash', () => {
  it('leaves trashed stories out of the totals', () => {
    const kept = makeProject();
    const gone = makeProject();
    story().updatePage(story().addPage(kept.chapterId), { done: true });
    story().updatePage(story().addPage(gone.chapterId), { done: true });
    story().addCharacter(gone.projectId);
    story().trashProject(gone.projectId);
    expect(storyStats(story())).toEqual({ projectCount: 1, trashed: 1, donePages: 1, characterCount: 0 });
  });

  it('counts down to the purge', () => {
    const now = 1000 * DAY_MS;
    expect(trashDaysLeft({ deletedAt: now }, now)).toBe(30);
    expect(trashDaysLeft({ deletedAt: now - 29.5 * DAY_MS }, now)).toBe(1);
    expect(trashDaysLeft({ deletedAt: now - 40 * DAY_MS }, now)).toBe(0);
    expect(trashCountdown(2)).toBe('2 days left');
    expect(trashCountdown(1)).toBe('1 day left');
    expect(trashCountdown(0)).toBe('Will be deleted today');
  });
});

describe('chapter order', () => {
  const acts: Act[] = [
    { id: 'a', title: 'Act 1', chapterIds: ['c1', 'c2'] },
    { id: 'b', title: 'Act 2', chapterIds: ['c3'] },
    { id: 'c', title: 'Act 3', chapterIds: [] },
  ];

  it('moves inside an act', () => {
    expect(chapterMove(acts, 'c1', 1)).toEqual({ toActId: 'a', toIndex: 1 });
  });

  it('crosses into the neighbouring act', () => {
    expect(chapterMove(acts, 'c3', -1)).toEqual({ toActId: 'a', toIndex: 2, crossedInto: 'Act 1' });
    expect(chapterMove(acts, 'c2', 1)).toEqual({ toActId: 'b', toIndex: 0, crossedInto: 'Act 2' });
  });

  it('stops at the ends', () => {
    expect(chapterMove(acts, 'c1', -1)).toBeNull();
    expect(canMoveChapterUp(acts, 'c1')).toBe(false);
    expect(canMoveChapterUp(acts, 'c2')).toBe(true);
    expect(canMoveChapterDown(acts, 'c3')).toBe(true);
    expect(canMoveChapterDown(acts.slice(0, 2), 'c3')).toBe(false);
  });

  it('adds to the last act in use', () => {
    expect(actForNewChapter(acts)?.id).toBe('b');
    expect(actForNewChapter([{ id: 'x', title: '', chapterIds: [] }])?.id).toBe('x');
  });
});

describe('assistant context', () => {
  it('picks the most recently edited live story', () => {
    const a = makeProject('A');
    const b = makeProject('B');
    useStory.setState({
      projects: {
        ...story().projects,
        [a.projectId]: { ...projectOf(a.projectId), updatedAt: 5 },
        [b.projectId]: { ...projectOf(b.projectId), updatedAt: 9, deletedAt: 10 },
      },
    });
    expect(latestProject(story().projects)?.id).toBe(a.projectId);
    expect(latestProject({})).toBeUndefined();
  });

  it('follows the story it was asked from, not the last one changed', () => {
    const a = makeProject('A');
    const b = makeProject('B');
    const projects = {
      [a.projectId]: { ...projectOf(a.projectId), updatedAt: 1 },
      [b.projectId]: { ...projectOf(b.projectId), updatedAt: 9 },
    };
    expect(assistantProject(projects, a.projectId)?.id).toBe(a.projectId);
    expect(assistantProject(projects, undefined)?.id).toBe(b.projectId);
  });

  it('falls back to the latest story when the one asked for is gone', () => {
    const a = makeProject('A');
    const b = makeProject('B');
    const projects = {
      [a.projectId]: { ...projectOf(a.projectId), updatedAt: 9, deletedAt: 10 },
      [b.projectId]: { ...projectOf(b.projectId), updatedAt: 1 },
    };
    expect(assistantProject(projects, a.projectId)?.id).toBe(b.projectId);
    expect(assistantProject(projects, 'missing')?.id).toBe(b.projectId);
  });

  it('describes the author position', () => {
    const { projectId, chapterId } = makeProject();
    expect(whereOf(undefined, undefined)).toBe('Home');
    expect(whereOf(projectOf(projectId), undefined)).toBe('Project overview');
    story().setLastOpened(projectId, { screen: 'PanelLayout', chapterId });
    expect(whereOf(projectOf(projectId), 'Rain')).toBe('Panel layout of chapter "Rain"');
  });

  it('titles a saved note after the question before it', () => {
    const messages = [
      { id: '1', role: 'user' as const, text: 'First?', at: 1 },
      { id: '2', role: 'assistant' as const, text: 'One', at: 2 },
      { id: '3', role: 'user' as const, text: 'Second?', at: 3 },
      { id: '4', role: 'assistant' as const, text: 'Two', at: 4 },
    ];
    expect(noteTitleFor(messages, '4')).toBe('Second?');
    expect(noteTitleFor(messages.slice(1), '2')).toBe('Assistant note');
  });
});

