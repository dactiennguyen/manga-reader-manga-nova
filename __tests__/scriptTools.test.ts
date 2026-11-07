import {
  countWords,
  findInText,
  findMatches,
  formatDuration,
  formatScript,
  replaceAllInScenes,
  replaceInText,
  replaceRange,
  sceneSummary,
  scriptFileName,
  scriptStats,
} from '../src/core/script/scriptTools';
import type { Block, BlockType, Character, Scene } from '../src/core/model/types';

let counter = 0;
const block = (type: BlockType, text: string, extra: Partial<Block> = {}): Block => ({
  id: `b${counter++}`,
  type,
  text,
  ...extra,
});
const scene = (blocks: Block[], description = ''): Scene => ({
  id: `s${counter++}`,
  chapterId: 'c',
  description,
  blocks,
});
const characters = {
  aki: { id: 'aki', name: 'Aki' },
  ren: { id: 'ren', name: 'Ren' },
} as unknown as Record<string, Character>;

const sample = (): Scene[] => [
  scene([
    block('setting', 'Rooftop, night'),
    block('action', 'Aki looks at the city. The city looks back.'),
    block('dialogue', 'This city never sleeps.', { characterId: 'aki', kind: 'speak' }),
    block('dialogue', 'Neither do you.', { characterId: 'ren', kind: 'whisper' }),
    block('action', ''),
  ]),
  scene([
    block('narration', 'Morning came too fast.'),
    block('sfx', 'BOOM'),
    block('dialogue', 'What was that?!\nRun!', { characterId: 'aki', kind: 'shout' }),
    block('dialogue', 'Who is there', {}),
  ]),
];

describe('find', () => {
  it('matches case-insensitively by default and reports original offsets', () => {
    expect(findInText('The City and the city', 'city')).toEqual([
      { start: 4, end: 8 },
      { start: 17, end: 21 },
    ]);
    expect(findInText('The City and the city', 'city', true)).toEqual([{ start: 17, end: 21 }]);
  });

  it('treats the query literally', () => {
    expect(findInText('a.b a+b (x)', '.')).toEqual([{ start: 1, end: 2 }]);
    expect(findInText('what?! (x)', '(x)')).toHaveLength(1);
    expect(findInText('abc', '')).toEqual([]);
  });

  it('lists every occurrence in script order', () => {
    const scenes = sample();
    const matches = findMatches(scenes, 'city');
    expect(matches).toHaveLength(3);
    expect(matches[0].blockId).toBe(scenes[0].blocks[1].id);
    expect(matches[1].blockId).toBe(scenes[0].blocks[1].id);
    expect(matches[2]).toMatchObject({ sceneId: scenes[0].id, blockId: scenes[0].blocks[2].id, start: 5, end: 9 });
    expect(findMatches(scenes, 'City', true)).toHaveLength(0);
  });
});

describe('replace', () => {
  it('replaces one range', () => {
    expect(replaceRange('This city never sleeps.', 5, 9, 'town')).toBe('This town never sleeps.');
  });

  it('replaces all occurrences without interpreting the replacement', () => {
    expect(replaceInText('City, city, CITY', 'city', '$&x')).toEqual({ text: '$&x, $&x, $&x', count: 3 });
    expect(replaceInText('City, city', 'city', 'town', true)).toEqual({ text: 'City, town', count: 1 });
  });

  it('returns only the scenes that changed and keeps untouched blocks by reference', () => {
    const scenes = sample();
    const { changes, count } = replaceAllInScenes(scenes, 'city', 'town');
    expect(count).toBe(3);
    expect(changes).toHaveLength(1);
    expect(changes[0].sceneId).toBe(scenes[0].id);
    expect(changes[0].blocks[0]).toBe(scenes[0].blocks[0]);
    expect(changes[0].blocks[1].text).toBe('Aki looks at the town. The town looks back.');
    expect(changes[0].blocks[1].id).toBe(scenes[0].blocks[1].id);
    expect(replaceAllInScenes(scenes, 'zzz', 'x')).toEqual({ changes: [], count: 0 });
  });
});

describe('scriptStats', () => {
  it('counts words', () => {
    expect(countWords('  one  two\nthree ')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  it('summarises the script and ranks speakers', () => {
    const stats = scriptStats(sample(), characters);
    expect(stats.scenes).toBe(2);
    expect(stats.blocks).toBe(8);
    expect(stats.byType).toEqual({ setting: 1, action: 1, dialogue: 4, narration: 1, sfx: 1 });
    expect(stats.dialogueLines).toBe(4);
    expect(stats.words).toBe(2 + 9 + 4 + 3 + 4 + 1 + 4 + 3);
    expect(stats.pages).toBeGreaterThan(0);
    expect(stats.readingSeconds).toBe(Math.round((stats.words / 200) * 60 + stats.pages * 6));
    expect(stats.speakers.map(speaker => [speaker.name, speaker.lines, speaker.words])).toEqual([
      ['Aki', 2, 8],
      ['Ren', 1, 3],
      ['Unassigned', 1, 3],
    ]);
  });

  it('handles an empty script', () => {
    const stats = scriptStats([scene([block('setting', '')])], {});
    expect(stats).toMatchObject({ words: 0, blocks: 0, dialogueLines: 0, speakers: [] });
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(40)).toBe('under 1 min');
    expect(formatDuration(150)).toBe('3 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 5 min');
  });
});

describe('formatScript', () => {
  it('writes a readable screenplay', () => {
    expect(formatScript('Chapter 1: Dawn', sample(), characters)).toBe(
      [
        'CHAPTER 1: DAWN',
        '===============',
        '',
        'SCENE 1',
        '-------',
        '',
        '[Rooftop, night]',
        '',
        'Aki looks at the city. The city looks back.',
        '',
        '        AKI',
        '    This city never sleeps.',
        '',
        '        REN (whispers)',
        '    Neither do you.',
        '',
        'SCENE 2',
        '-------',
        '',
        'NARRATION: Morning came too fast.',
        '',
        'SFX: BOOM',
        '',
        '        AKI (shouts)',
        '    What was that?!',
        '    Run!',
        '',
        '        UNKNOWN',
        '    Who is there',
        '',
      ].join('\n'),
    );
  });

  it('builds a safe file name and scene summaries', () => {
    expect(scriptFileName('Chapter 1: Dawn / Dusk')).toBe('Chapter-1-Dawn-Dusk-script.txt');
    expect(scriptFileName('  ')).toBe('script-script.txt');
    expect(sceneSummary(sample()[0])).toBe('Rooftop, night');
    expect(sceneSummary(scene([block('action', '')], 'Outline note'))).toBe('Outline note');
  });
});
