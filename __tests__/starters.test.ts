import { connectTestStorage } from './helpers/storage';
import { setLocale } from '../src/core/i18n';
import { TEMPLATES, templatesFor } from '../src/core/layout/layout';
import { chapterIdsOf } from '../src/core/model/selectors';
import { FORMATS } from '../src/core/story/newProject';
import { STARTERS, applyStarter, starterFits, starterOf } from '../src/core/story/starters';
import { useStory } from '../src/state/useStory';

beforeEach(() => {
  connectTestStorage();
});

afterEach(() => setLocale('en'));

const story = () => useStory.getState();

function create(format: 'manga' | 'webtoon') {
  return story().createProject({
    title: 'Test',
    genres: [],
    logline: '',
    format,
    pageSize: 'B5',
    style: 'shounen',
    color: false,
  });
}

describe('story starters', () => {
  it('only uses page layouts that exist for the starter format', () => {
    for (const starter of STARTERS) {
      const format = FORMATS.find(item => item.key === starter.formatKey)?.format ?? 'manga';
      const allowed = templatesFor(format).map(item => item.id);
      starter.pages.forEach(id => {
        expect(TEMPLATES.some(item => item.id === id)).toBe(true);
        expect(allowed).toContain(id);
      });
    }
  });

  it('keeps a starter only with the format it was made for', () => {
    expect(starterFits(starterOf('blank'), 'webtoon')).toBe(true);
    expect(starterFits(starterOf('oneshot'), 'manga-A5')).toBe(true);
    expect(starterFits(starterOf('oneshot'), 'webtoon')).toBe(false);
    expect(starterFits(starterOf('episode'), 'manga-B5')).toBe(false);
  });

  it('fills the first chapter with an outline and laid-out pages', () => {
    const projectId = create('manga');
    const pageIds = applyStarter(story, projectId, starterOf('oneshot'));
    const chapter = story().chapters[chapterIdsOf(story().projects[projectId])[0]];
    expect(pageIds).toHaveLength(8);
    expect(chapter.pageIds).toEqual(pageIds);
    expect(chapter.summary).toBe('A complete short story in eight pages.');
    expect(chapter.sceneIds).toHaveLength(4);
    expect(story().scenes[chapter.sceneIds[0]].description).toMatch(/^Pages 1–2: opening\. A strong first image/);
    expect(Object.keys(story().pages[pageIds[1]].panels)).toHaveLength(4);
  });

  it('makes four-panel strips and webtoon strips', () => {
    const strip = applyStarter(story, create('manga'), starterOf('yonkoma'));
    expect(strip.map(id => Object.keys(story().pages[id].panels).length)).toEqual([4, 4]);
    const episode = applyStarter(story, create('webtoon'), starterOf('episode'));
    expect(episode.map(id => Object.keys(story().pages[id].panels).length)).toEqual([3, 4, 3, 5, 2]);
    expect(story().pages[episode[0]].height).toBeGreaterThan(0);
  });

  it('writes the outline in the interface language', () => {
    setLocale('vi');
    const projectId = create('manga');
    applyStarter(story, projectId, starterOf('yonkoma'));
    const chapter = story().chapters[chapterIdsOf(story().projects[projectId])[0]];
    expect(chapter.goal).not.toBe('Make the reader smile by the fourth panel.');
    expect(chapter.goal.length).toBeGreaterThan(0);
  });

  it('leaves a blank story alone', () => {
    const projectId = create('manga');
    expect(applyStarter(story, projectId, starterOf('blank'))).toEqual([]);
    expect(story().chapters[chapterIdsOf(story().projects[projectId])[0]].sceneIds).toEqual([]);
  });
});
