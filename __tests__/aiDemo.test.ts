import { askAssistant } from '../src/core/ai/assistant';
import { createDemoClient } from '../src/core/ai/demo';
import { describeWorldEntry, findPlotHoles, suggestCharacter } from '../src/core/ai/people';
import { AiError, configureAi } from '../src/core/ai/port';
import { suggestPlots, suggestScenes, suggestStory } from '../src/core/ai/story';
import { translateLines } from '../src/core/ai/translate';
import { changeVoice, continueScript, rewriteBlocks, shortenLine, suggestSfx } from '../src/core/ai/writing';
import { GENRES } from '../src/core/model/constants';
import type { Block, Character } from '../src/core/model/types';

const hana = { id: 'c1', name: 'Hana', traits: ['fast'], voice: '', age: '17', bio: '' } as unknown as Character;
const ren = { id: 'c2', name: 'Ren', traits: [], voice: '', age: '', bio: '' } as unknown as Character;
const story = { title: 'Lantern Courier', genres: ['Action'], logline: 'A courier carries a box.' };

let answers = 0;

beforeEach(() => {
  answers = 0;
  configureAi(createDemoClient(() => answers++, 0));
});

afterAll(() => configureAi(null));

// Each task builds its own prompt. These fail when a prompt is reworded and the demo no longer recognises it.
describe('sample answers', () => {
  test('shape an idea into a pitch', async () => {
    const idea = await suggestStory('a ghost who haunts a school club and falls in love');
    expect(idea.title).toBe('Ghost Haunts School');
    expect(idea.genres).toEqual(['Romance', 'Horror', 'School']);
    idea.genres.forEach(genre => expect(GENRES).toContain(genre));
    expect(idea.logline).toBe('A ghost who haunts a school club and falls in love.');
  });

  test('plot directions cover every act', async () => {
    const directions = await suggestPlots(story, ['Setup', 'Rising', 'Crisis', 'Climax', 'Ending']);
    expect(directions).toHaveLength(3);
    directions.forEach(direction => {
      expect(direction.acts).toHaveLength(5);
      direction.acts.forEach(act => expect(act.length).toBeGreaterThan(0));
    });
  });

  test('scenes for a chapter', async () => {
    const scenes = await suggestScenes(story, { title: 'The Box', summary: '', goal: '' });
    expect(scenes.length).toBeGreaterThanOrEqual(3);
    expect(scenes[0].description).toContain('The Box');
  });

  test('continuing a script uses only known characters', async () => {
    const drafts = await continueScript('brief', 'Hana runs.', [hana, ren]);
    const speakers = drafts.filter(draft => draft.type === 'dialogue').map(draft => draft.characterId);
    expect(speakers).toEqual(['c1', 'c2']);
    const alone = await continueScript('brief', '', []);
    expect(alone.some(draft => draft.type === 'dialogue')).toBe(false);
  });

  test('rewriting keeps count, order and types', async () => {
    const blocks: Block[] = [
      { id: 'b1', type: 'action', text: 'she is  very tired' },
      { id: 'b2', type: 'dialogue', text: 'Just "go".', characterId: 'c1', kind: 'shout' },
    ];
    const drafts = await rewriteBlocks('brief', blocks, { c1: hana }, 'shorter');
    expect(drafts.map(draft => draft.type)).toEqual(['action', 'dialogue']);
    expect(drafts[0].text).toBe('She is tired');
    expect(drafts[1]).toMatchObject({ characterId: 'c1', kind: 'shout' });
  });

  test('line tools', async () => {
    expect(await changeVoice('brief', 'we should go now', hana)).toBe('We should go now');
    const long = 'I told you a hundred times that the bridge is out and we have to go around the harbor';
    const short = await shortenLine(long);
    expect(short.length).toBeLessThan(long.length);
    expect(short.endsWith('…')).toBe(true);
    expect(await suggestSfx('Hana rides through the rain')).toEqual(['SPLASH', 'DRIP', 'SPLOSH']);
  });

  test('characters, world entries and plot holes', async () => {
    const draft = await suggestCharacter('brief', 'quiet, rival, swordsman');
    expect(draft.name).toBeTruthy();
    expect(draft.role).toBe('villain');
    expect(draft.traits).toEqual(['quiet', 'rival', 'swordsman']);
    const body = await describeWorldEntry('brief', 'place', 'Lantern District', 'Half of it is flooded.');
    expect(body).toContain('Half of it is flooded.');
    expect(body).toContain('Lantern District');
    expect((await findPlotHoles('brief')).length).toBeGreaterThanOrEqual(2);
  });

  test('the assistant says its answer is a sample', async () => {
    const answer = await askAssistant({ brief: '', where: 'Home' }, [], 'How many panels fit on a manga page?');
    expect(answer).toContain('Four to six panels');
    expect(answer).toContain('sample answer');
    expect(answers).toBe(1);
  });

  test('translating is refused, since a sample cannot stand in for it', async () => {
    await expect(translateLines(['Hello'], 'Vietnamese', '')).rejects.toMatchObject({ code: 'not-configured' });
    expect(answers).toBe(0);
  });

  test('a cancelled request rejects as cancelled', async () => {
    const controller = new AbortController();
    const pending = createDemoClient(undefined, 50).complete({ messages: [] }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(AiError);
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });
});
