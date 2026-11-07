import type { Act, Chapter } from '../src/core/model/types';
import { chapterCount, chapterEdges, locateChapter, outlineText, shiftTarget } from '../src/core/story/outlineTools';

const acts: Act[] = [
  { id: 'a1', title: 'One', chapterIds: ['c1', 'c2'] },
  { id: 'a2', title: 'Two', chapterIds: [] },
  { id: 'a3', title: 'Three', chapterIds: ['c3'] },
];

describe('outline tools', () => {
  it('counts chapters', () => {
    expect(chapterCount(1)).toBe('1 chapter');
    expect(chapterCount(2)).toBe('2 chapters');
  });

  it('locates a chapter', () => {
    expect(locateChapter(acts, 'c2')).toMatchObject({ actIndex: 0, index: 1 });
    expect(locateChapter(acts, 'nope')).toMatchObject({ actIndex: -1, index: -1 });
  });

  it('shifts inside an act, then across', () => {
    expect(shiftTarget(acts, 'c1', 1)).toEqual({ actId: 'a1', index: 1 });
    expect(shiftTarget(acts, 'c2', 1)).toEqual({ actId: 'a2', index: 0, crossed: 'Two' });
    expect(shiftTarget(acts, 'c3', -1)).toEqual({ actId: 'a2', index: 0, crossed: 'Two' });
    expect(shiftTarget(acts, 'c1', -1)).toBeNull();
    expect(shiftTarget(acts, 'c3', 1)).toBeNull();
  });

  it('finds the ends of the outline', () => {
    expect(chapterEdges(acts, 'c1')).toEqual({ first: true, last: false });
    expect(chapterEdges(acts, 'c3')).toEqual({ first: false, last: true });
  });

  it('writes the outline as text', () => {
    const chapter = { title: 'Start', summary: 'It begins', goal: 'Hook' } as Chapter;
    const text = outlineText(
      { title: 'Story', logline: 'A line', acts: [{ id: 'a', title: 'Act', chapterIds: ['c', 'gone'] }] },
      { c: chapter },
      { c: 1 },
    );
    expect(text).toBe('STORY\nA line\n\nACT\nChapter 1. Start\n  It begins\n  Goal: Hook');
  });
});
