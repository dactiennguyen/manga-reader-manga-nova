import { matchChapter } from '../src/core/story/plotHoles';
import { appendBody, BODY_MAX } from '../src/core/story/plotHoles';

const CHAPTERS = [
  { id: 'a', title: 'The Gate' },
  { id: 'b', title: '' },
  { id: 'c', title: 'Chapter 3' },
  { id: 'd', title: 'Ashes' },
];

describe('matchChapter', () => {
  it('matches titles case-insensitively', () => {
    expect(matchChapter('the gate', CHAPTERS)).toBe('a');
    expect(matchChapter('  ASHES ', CHAPTERS)).toBe('d');
  });

  it('matches untitled chapters by their number', () => {
    expect(matchChapter('Chapter 2', CHAPTERS)).toBe('b');
    expect(matchChapter('chapter 3', CHAPTERS)).toBe('c');
  });

  it('returns nothing for unknown or empty titles', () => {
    expect(matchChapter('', CHAPTERS)).toBeUndefined();
    expect(matchChapter('Epilogue', CHAPTERS)).toBeUndefined();
  });
});

describe('appendBody', () => {
  it('adds a blank line between the old and new text', () => {
    expect(appendBody('Old.\n', ' New. ')).toBe('Old.\n\nNew.');
    expect(appendBody('', 'New.')).toBe('New.');
  });

  it('stays within the content limit', () => {
    expect(appendBody('x'.repeat(BODY_MAX), 'more').length).toBe(BODY_MAX);
  });
});
