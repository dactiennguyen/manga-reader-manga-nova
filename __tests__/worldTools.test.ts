import type { Chapter, Character, Scene, WorldEntry } from '../src/core/model/types';
import {
  anchorLabel,
  entryMentions,
  firstLine,
  matchesQuery,
  timelineGroups,
  timelineSwap,
  wikiText,
} from '../src/core/world/worldTools';

const entry = (id: string, extra: Partial<WorldEntry> = {}): WorldEntry => ({
  id,
  projectId: 'p',
  type: 'event',
  title: id,
  body: '',
  images: [],
  characterIds: [],
  sendToAi: true,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const chapter = (id: string, title = '', sceneIds: string[] = []) => ({ id, title, sceneIds } as Chapter);

describe('world text', () => {
  it('takes the first non-empty line', () => {
    expect(firstLine('\n  \n  hello \nworld')).toBe('hello');
    expect(firstLine('')).toBe('');
  });

  it('labels anchors', () => {
    const chapters = [chapter('a'), chapter('b', 'Named')];
    expect(anchorLabel('before', chapters)).toBe('Before the story');
    expect(anchorLabel('after', chapters)).toBe('After the story');
    expect(anchorLabel('a', chapters)).toBe('Chapter 1');
    expect(anchorLabel('b', chapters)).toBe('Chapter 2 · Named');
    expect(anchorLabel('gone', chapters)).toBe('No time anchor');
    expect(anchorLabel(undefined, chapters)).toBe('No time anchor');
  });

  it('searches titles and bodies', () => {
    expect(matchesQuery({ title: 'Castle', body: '' }, ' cas ')).toBe(true);
    expect(matchesQuery({ title: 'x', body: 'A dragon' }, 'DRAGON')).toBe(true);
    expect(matchesQuery({ title: 'x', body: 'y' }, 'z')).toBe(false);
  });

  it('writes the wiki by type', () => {
    const characters = { k: { name: 'Kai' } as Character };
    const text = wikiText(
      'Story',
      [entry('Coup', { anchor: 'before', characterIds: ['k'], body: 'Body' }), entry('Guild', { type: 'faction', leaderId: 'k' })],
      [],
      characters,
    );
    expect(text).toContain('Story — World wiki');
    expect(text).toContain('== FACTION ==');
    expect(text).toContain('Leader: Kai');
    expect(text).toContain('Time anchor: Before the story');
    expect(text).toContain('Related characters: Kai');
  });
});

describe('timeline', () => {
  it('groups by anchor in story order and sends unknown anchors to none', () => {
    const chapters = [chapter('a')];
    const groups = timelineGroups(
      [entry('x', { anchor: 'a', order: 2 }), entry('y', { anchor: 'a', order: 1 }), entry('z', { anchor: 'gone' }), entry('w', { anchor: 'before' })],
      chapters,
    );
    expect(groups.map(group => group.key)).toEqual(['before', 'a', 'none']);
    expect(groups[1].items.map(item => item.id)).toEqual(['y', 'x']);
  });

  it('swaps neighbours and spreads out equal orders', () => {
    const items = [entry('a', { order: 1 }), entry('b', { order: 1 })];
    expect(timelineSwap(items, 0, 1)).toEqual([{ id: 'a', order: 1.001 }]);
    expect(timelineSwap(items, 0, -1)).toEqual([]);
  });
});

describe('entryMentions', () => {
  const scenes: Record<string, Scene> = {
    s1: { id: 's1', chapterId: 'a', description: '', blocks: [{ id: 'b1', type: 'action', text: 'The Castle fell' }, { id: 'b2', type: 'action', text: 'castle again' }] },
    s2: { id: 's2', chapterId: 'b', description: '', blocks: [{ id: 'b3', type: 'action', text: 'nothing' }] },
  };

  it('counts blocks per chapter and keeps the first block', () => {
    const chapters = [chapter('a', 'One', ['s1']), chapter('b', '', ['s2'])];
    expect(entryMentions('castle', chapters, scenes)).toEqual([
      { chapterId: 'a', label: 'Chapter 1 · One', blockId: 'b1', count: 2 },
    ]);
  });

  it('ignores titles shorter than two characters', () => {
    expect(entryMentions('c', [chapter('a', '', ['s1'])], scenes)).toEqual([]);
  });
});
