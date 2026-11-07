import { connectTestStorage } from './helpers/storage';
import { assistantMessages, quickPrompts } from '../src/core/ai/assistant';
import { AiError } from '../src/core/ai/port';
import { formatBlock, scriptText, storyBrief } from '../src/core/ai/context';
import { parseCharacterDraft, parsePlotHoles, parseWorldBody } from '../src/core/ai/people';
import { parseTranslations } from '../src/core/ai/translate';
import { matchCharacter, parseBlockDrafts, parseLine, parseSfx } from '../src/core/ai/writing';
import type { Character } from '../src/core/model/types';
import { useStory, type NewProjectInput } from '../src/state/useStory';

beforeEach(() => {
  connectTestStorage();
});

const INPUT: NewProjectInput = {
  title: 'Moon Island',
  genres: ['Adventure'],
  logline: 'Two sisters row out.',
  format: 'manga',
  pageSize: 'B5',
  style: 'shounen',
  color: false,
};

function character(name: string, extra: Partial<Character> = {}): Character {
  return {
    id: name.toLowerCase(),
    projectId: 'p',
    name,
    role: 'main',
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
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

describe('script drafts', () => {
  const cast = [character('Mai'), character('Old Sora')];

  it('matches character names loosely', () => {
    expect(matchCharacter('mai', cast)?.id).toBe('mai');
    expect(matchCharacter('OLD SORA (whispering)', cast)?.id).toBe('old sora');
    expect(matchCharacter('Nobody', cast)).toBeUndefined();
  });

  it('parses blocks and links dialogue to characters', () => {
    const drafts = parseBlockDrafts(
      {
        blocks: [
          { type: 'action', text: 'The boat rocks.' },
          { type: 'dialogue', text: 'Hold on!', character: 'Mai', kind: 'shout' },
          { type: 'dialogue', text: 'Who said that?', character: 'Ghost' },
          { type: 'sound', text: 'SPLASH' },
          { type: 'picture', text: 'ignored' },
          { type: 'action', text: '' },
        ],
      },
      cast,
    );
    expect(drafts).toHaveLength(4);
    expect(drafts[1]).toEqual({
      type: 'dialogue',
      text: 'Hold on!',
      character: undefined,
      characterName: 'Mai',
      characterId: 'mai',
      kind: 'shout',
    });
    expect(drafts[2].characterId).toBeUndefined();
    expect(drafts[2].characterName).toBe('Ghost');
    expect(drafts[2].kind).toBe('speak');
    expect(drafts[3].type).toBe('sfx');
    expect(() => parseBlockDrafts({ blocks: [] }, cast)).toThrow(AiError);

    const lines = Array.from({ length: 10 }, (_, index) => ({ type: 'action', text: `line ${index}` }));
    expect(parseBlockDrafts({ blocks: lines }, cast, 10)).toHaveLength(10);
    expect(() => parseBlockDrafts({ blocks: lines.slice(0, 9) }, cast, 10)).toThrow(AiError);
    const broken = lines.map((line, index) => (index === 2 ? { type: 'action', text: '' } : line));
    expect(() => parseBlockDrafts({ blocks: broken }, cast, 10)).toThrow(AiError);
  });

  it('parses single lines and sfx lists', () => {
    expect(parseLine({ text: '“Row faster!”' })).toBe('Row faster!');
    expect(() => parseLine({ text: '' })).toThrow(AiError);
    expect(parseSfx({ sfx: ['crash', 'Crash', 'thud!', 'x', 'bang bang'] })).toEqual(['CRASH', 'THUD!', 'BANGBANG']);
    expect(() => parseSfx([])).toThrow(AiError);
  });
});

describe('people and world', () => {
  it('parses a character draft with limits', () => {
    const draft = parseCharacterDraft({
      name: 'Mai',
      role: 'Villain',
      age: 17,
      traits: 'brave, stubborn , , kind',
      goal: 'Find the island',
      bio: 'Line one.\nLine two.',
    });
    expect(draft.role).toBe('villain');
    expect(draft.age).toBe('');
    expect(draft.traits).toEqual(['brave', 'stubborn', 'kind']);
    expect(draft.bio).toBe('Line one.\nLine two.');
    expect(() => parseCharacterDraft({ role: 'main' })).toThrow(AiError);
  });

  it('parses world bodies and plot holes', () => {
    expect(parseWorldBody({ body: '  A harbor.\n\nFog. ' })).toBe('A harbor.\n\nFog.');
    expect(() => parseWorldBody({})).toThrow(AiError);
    const holes = parsePlotHoles({
      issues: [{ issue: 'No stakes', suggestion: 'Add a deadline', chapter: 'Ch 2' }, { issue: '' }],
    });
    expect(holes).toEqual([{ issue: 'No stakes', suggestion: 'Add a deadline', chapter: 'Ch 2' }]);
    expect(() => parsePlotHoles({ issues: [] })).toThrow(AiError);
  });
});

describe('translations', () => {
  it('requires the same number of non-empty lines', () => {
    expect(parseTranslations({ lines: ['a', 'b'] }, 2)).toEqual(['a', 'b']);
    expect(() => parseTranslations({ lines: ['a'] }, 2)).toThrow(AiError);
    expect(() => parseTranslations(['a', ''], 2)).toThrow(AiError);
  });
});

describe('story context', () => {
  it('describes the story and the script for prompts', () => {
    useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
    const projectId = useStory.getState().createProject(INPUT);
    const chapterId = Object.values(useStory.getState().chapters)[0].id;
    const maiId = useStory.getState().addCharacter(projectId, { name: 'Mai', traits: ['brave'] });
    useStory.getState().addScene(chapterId, {
      description: 'At sea',
      blocks: [
        { id: 'b1', type: 'setting', text: 'Harbor' },
        { id: 'b2', type: 'dialogue', text: 'Go!', characterId: maiId, kind: 'shout' },
        { id: 'b3', type: 'action', text: 'They leave.' },
      ],
    });
    const brief = storyBrief(useStory.getState(), projectId, { chapterId });
    expect(brief.text).toContain('Title: Moon Island');
    expect(brief.text).toContain('- Mai · support · brave');
    expect(brief.text).toContain('(current)');
    const script = scriptText(useStory.getState(), chapterId, { untilBlockId: 'b3' });
    expect(script).toBe('SCENE 1: At sea\n[Harbor]\nMAI (shout): Go!');
    expect(formatBlock({ type: 'sfx', text: 'BOOM' }, {})).toBe('SFX: BOOM');
  });

  it('builds assistant messages with recent history only', () => {
    const history = Array.from(
      { length: 20 },
      (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `t${i}` } as const),
    );
    const messages = assistantMessages({ brief: 'Title: X', where: 'Script' }, [...history], 'Next?');
    expect(messages[0].role).toBe('system');
    expect(messages).toHaveLength(14);
    expect(messages[messages.length - 1].content).toBe('Next?');
    expect(quickPrompts('Script', true)).toHaveLength(3);
    expect(quickPrompts('Home', false)[0]).toContain('panels');
  });
});
