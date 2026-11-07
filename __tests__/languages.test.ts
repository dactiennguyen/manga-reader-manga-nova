import { connectTestStorage } from './helpers/storage';
import {
  LANGUAGE_NAME_MAX,
  MAX_LANGUAGES,
  bubbleText,
  hasTranslation,
  languageFileTag,
  languageNameError,
  localizeBubble,
  setTranslation,
  translationProgress,
} from '../src/core/lettering/translation';
import type { Bubble } from '../src/core/model/types';
import type { NewProjectInput } from '../src/state/useStory';
import { useStory } from '../src/state/useStory';

beforeEach(() => {
  connectTestStorage();
});

const INPUT: NewProjectInput = {
  title: 'The Delivery Boy',
  genres: ['Adventure'],
  logline: '',
  format: 'manga',
  pageSize: 'B5',
  style: 'shounen',
  color: false,
};

const story = () => useStory.getState();

function bubble(id: string, text: string, translations?: Record<string, string>): Bubble {
  return {
    id,
    type: 'speak',
    text,
    x: 0,
    y: 0,
    w: 200,
    h: 120,
    rotation: 0,
    tail: null,
    fontSize: 28,
    font: 'hand',
    bold: false,
    translations,
  };
}

function seed() {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
  const projectId = story().createProject(INPUT);
  const otherId = story().createProject({ ...INPUT, title: 'Other' });
  const chapterOf = (id: string) => Object.values(story().chapters).find(chapter => chapter.projectId === id)!.id;
  const pageId = story().addPage(chapterOf(projectId));
  const otherPageId = story().addPage(chapterOf(otherId));
  const bubbles = [
    bubble('a', 'Hello', { Vietnamese: 'Hola', French: 'Salut' }),
    bubble('b', 'Run!', { French: 'Cours !' }),
    bubble('c', 'Wait'),
  ];
  story().updatePage(pageId, { bubbles });
  story().updatePage(otherPageId, { bubbles: [bubble('z', 'Hi', { Vietnamese: 'Hey' })] });
  return { projectId, pageId, otherPageId };
}

describe('translation helpers', () => {
  it('falls back to the original when a translation is missing or blank', () => {
    const source = bubble('a', 'Hello', { Vietnamese: 'Hola', French: '   ' });
    expect(bubbleText(source, 'Vietnamese')).toBe('Hola');
    expect(bubbleText(source, 'French')).toBe('Hello');
    expect(bubbleText(source, 'German')).toBe('Hello');
    expect(bubbleText(source)).toBe('Hello');
    expect(localizeBubble(source, 'French')).toBe(source);
    const shown = localizeBubble(source, 'Vietnamese');
    expect(shown.text).toBe('Hola');
    expect(source.text).toBe('Hello');
  });

  it('stores and clears a translation without touching the original', () => {
    const source = bubble('a', 'Hello');
    const translated = setTranslation(source, 'French', 'Salut');
    expect(translated.translations).toEqual({ French: 'Salut' });
    expect(translated.text).toBe('Hello');
    expect(source.translations).toBeUndefined();
    expect(setTranslation(translated, 'French', '').translations).toBeUndefined();
    expect(hasTranslation(setTranslation(translated, 'French', '  '), 'French')).toBe(false);
  });

  it('counts translated bubbles and ignores empty originals', () => {
    const bubbles = [bubble('a', 'Hello', { French: 'Salut' }), bubble('b', 'Run!'), bubble('c', '  ')];
    expect(translationProgress(bubbles, 'French')).toEqual({ done: 1, total: 2 });
  });

  it('validates language names', () => {
    expect(languageNameError([], '  ')).not.toBeNull();
    expect(languageNameError([], 'original')).not.toBeNull();
    expect(languageNameError(['French'], ' FRENCH ')).not.toBeNull();
    expect(languageNameError(['French'], 'french', 'French')).toBeNull();
    expect(languageNameError(['French'], 'German')).toBeNull();
    const full = Array.from({ length: MAX_LANGUAGES }, (_, index) => `Lang ${index}`);
    expect(languageNameError(full, 'One more')).not.toBeNull();
    expect(languageNameError(full, 'Renamed', 'Lang 0')).toBeNull();
  });

  it('rejects names that collide with built-in object keys', () => {
    expect(languageNameError([], '__proto__')).not.toBeNull();
    expect(languageNameError([], 'constructor')).not.toBeNull();
  });

  it('builds a file name tag from a language name', () => {
    expect(languageFileTag('Vietnamese')).toBe('Vietnamese');
    expect(languageFileTag('Français')).toBe('Francais');
    expect(languageFileTag('日本語')).toBe('translated');
    expect(languageFileTag('Brazilian / Portuguese')).toBe('Brazilian-Portuguese');
    expect(languageFileTag(undefined)).toBe('');
  });
});

describe('project languages', () => {
  it('adds languages with trimming, a length cap and no duplicates', () => {
    const { projectId } = seed();
    expect(story().addLanguage(projectId, '  Vietnamese  ')).toBe('Vietnamese');
    expect(story().addLanguage(projectId, 'vietnamese')).toBeNull();
    expect(story().addLanguage(projectId, '')).toBeNull();
    expect(story().addLanguage(projectId, 'x'.repeat(40))).toBe('x'.repeat(LANGUAGE_NAME_MAX));
    expect(story().projects[projectId].languages).toEqual(['Vietnamese', 'x'.repeat(LANGUAGE_NAME_MAX)]);
    for (let index = 0; index < MAX_LANGUAGES; index += 1) {
      story().addLanguage(projectId, `Lang ${index}`);
    }
    expect(story().projects[projectId].languages).toHaveLength(MAX_LANGUAGES);
  });

  it('renames a language and moves every translation key', () => {
    const { projectId, pageId, otherPageId } = seed();
    story().addLanguage(projectId, 'Vietnamese');
    story().addLanguage(projectId, 'French');
    expect(story().renameLanguage(projectId, 'Vietnamese', 'french')).toBeNull();
    expect(story().renameLanguage(projectId, 'Missing', 'German')).toBeNull();
    expect(story().renameLanguage(projectId, 'Vietnamese', ' Viet ')).toBe('Viet');
    expect(story().projects[projectId].languages).toEqual(['Viet', 'French']);
    const [a, b, c] = story().pages[pageId].bubbles;
    expect(a.translations).toEqual({ Viet: 'Hola', French: 'Salut' });
    expect(b.translations).toEqual({ French: 'Cours !' });
    expect(c.translations).toBeUndefined();
    expect(story().pages[otherPageId].bubbles[0].translations).toEqual({ Vietnamese: 'Hey' });
  });

  it('removes a language and drops its translations from this project only', () => {
    const { projectId, pageId, otherPageId } = seed();
    story().addLanguage(projectId, 'Vietnamese');
    story().addLanguage(projectId, 'French');
    story().removeLanguage(projectId, 'French');
    expect(story().projects[projectId].languages).toEqual(['Vietnamese']);
    const [a, b] = story().pages[pageId].bubbles;
    expect(a.translations).toEqual({ Vietnamese: 'Hola' });
    expect(b.translations).toBeUndefined();
    expect(a.text).toBe('Hello');
    story().removeLanguage(projectId, 'Vietnamese');
    expect(story().projects[projectId].languages).toBeUndefined();
    expect(story().pages[pageId].bubbles[0].translations).toBeUndefined();
    expect(story().pages[otherPageId].bubbles[0].translations).toEqual({ Vietnamese: 'Hey' });
  });
});
