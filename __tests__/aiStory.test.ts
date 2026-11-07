import { AiError, extractJson, normalizeBaseUrl } from '../src/core/ai/port';
import {
  AI_ATTEMPTS,
  askJson,
  matchGenres,
  parsePlotDirections,
  parseSceneIdeas,
  parseStoryIdea,
} from '../src/core/ai/story';
import { LIMITS } from '../src/core/model/constants';

describe('AI client helpers', () => {
  it('normalizes the server address', () => {
    expect(normalizeBaseUrl('')).toBe('');
    expect(normalizeBaseUrl(' example.com ')).toBe('https://example.com/v1');
    expect(normalizeBaseUrl('http://localhost:8081/')).toBe('http://localhost:8081/v1');
    expect(normalizeBaseUrl('https://example.com/v1/')).toBe('https://example.com/v1');
    expect(normalizeBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai',
    );
  });

  it('pulls JSON out of fenced or chatty answers', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go:\n[1, 2]\nEnjoy!')).toEqual([1, 2]);
    expect(() => extractJson('no json here')).toThrow(AiError);
    expect(() => extractJson('{broken')).toThrow(AiError);
  });
});

describe('repairing sloppy JSON', () => {
  it('fixes a key that lost its opening quote', () => {
    expect(extractJson('{"summary": "A trip.",\n  acts": [1]}')).toEqual({ summary: 'A trip.', acts: [1] });
  });

  it('closes brackets the model forgot', () => {
    expect(extractJson('{"directions":[{"title":"A","acts":[{"chapters":[{"title":"B"}]}]}')).toEqual({
      directions: [{ title: 'A', acts: [{ chapters: [{ title: 'B' }] }] }],
    });
  });

  it('drops trailing commas and leaves text inside strings alone', () => {
    expect(extractJson('{"a": [1, 2,], "b": "x, y: {z}",}')).toEqual({ a: [1, 2], b: 'x, y: {z}' });
  });
});

describe('asking for JSON', () => {
  it('asks again when the answer cannot be read', async () => {
    const answers = ['not json', '{"title": "T", "logline": "L", "genres": []}'];
    const ask = jest.fn(async () => answers.shift() ?? '');
    await expect(askJson([], parseStoryIdea, undefined, ask)).resolves.toEqual({
      title: 'T',
      logline: 'L',
      genres: [],
    });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('gives up after a few tries and does not retry other errors', async () => {
    const bad = jest.fn(async () => 'nope');
    await expect(askJson([], parseStoryIdea, undefined, bad)).rejects.toBeInstanceOf(AiError);
    expect(bad).toHaveBeenCalledTimes(AI_ATTEMPTS);
    const offline = jest.fn(async () => {
      throw new AiError('network', 'offline');
    });
    await expect(askJson([], parseStoryIdea, undefined, offline)).rejects.toMatchObject({ code: 'network' });
    expect(offline).toHaveBeenCalledTimes(1);
  });
});

describe('story suggestions', () => {
  it('keeps only known genres, at most three', () => {
    expect(matchGenres(['adventure', 'Space opera', 'FANTASY', 'Mystery', 'Comedy'])).toEqual([
      'Adventure',
      'Fantasy',
      'Mystery',
    ]);
    expect(matchGenres('Adventure')).toEqual([]);
  });

  it('parses and trims a story idea', () => {
    const idea = parseStoryIdea({
      title: `  ${'T'.repeat(90)} `,
      genres: ['Horror'],
      logline: 'A girl\nfinds  a pen.',
    });
    expect(idea.title).toHaveLength(LIMITS.projectTitle);
    expect(idea.logline).toBe('A girl finds a pen.');
    expect(idea.genres).toEqual(['Horror']);
    expect(() => parseStoryIdea({ title: 'Only a title' })).toThrow(AiError);
    expect(() => parseStoryIdea(null)).toThrow(AiError);
  });

  it('parses plot directions and pads missing acts', () => {
    const directions = parsePlotDirections(
      {
        directions: [
          {
            tone: 'adventure',
            title: 'The Atoll',
            summary: 'They sail.',
            acts: [{ chapters: [{ title: 'Launch', summary: 'They leave.' }] }, { chapters: [{ title: 'Storm' }] }],
          },
          { title: 'Empty', acts: [] },
          { title: 'Flat', acts: [[{ title: 'One', summary: 'S' }], [], [{ summary: 'Only a summary' }]] },
        ],
      },
      3,
    );
    expect(directions).toHaveLength(2);
    expect(directions[0].acts).toHaveLength(3);
    expect(directions[0].acts[1][0]).toEqual({ title: 'Storm', summary: '' });
    expect(directions[0].acts[2]).toEqual([]);
    expect(directions[1].acts[2][0].summary).toBe('Only a summary');
    expect(() => parsePlotDirections({ directions: [] }, 3)).toThrow(AiError);
  });

  it('parses scene ideas', () => {
    const scenes = parseSceneIdeas({
      scenes: [{ setting: 'Harbor, night', description: 'They push off.' }, { setting: 'x' }],
    });
    expect(scenes).toEqual([{ setting: 'Harbor, night', description: 'They push off.' }]);
    expect(() => parseSceneIdeas([])).toThrow(AiError);
  });
});
