import { CHAPTER_LETTERS } from '../src/core/studio/letterLines';
import { lettersOf } from '../src/core/studio/fanMail';
import { clubRanking, clubReviews } from '../src/core/studio/ranking';
import { COMMENTS } from '../src/core/studio/readerLines';
import { chapterFeatures, chapterReview } from '../src/core/studio/readers';
import { EMPTY_STUDIO, READER_IDS } from '../src/core/studio/types';
import { NOW, addChapter, addPage, addProject, addScene, daysAgo, emptyStory, sampleStory, zeroMetrics } from './helpers/studioStory';

describe('chapterReview', () => {
  it('is null for a chapter with nothing to read', () => {
    const state = sampleStory();
    expect(chapterFeatures(state, 'c3')).toBeNull();
    expect(chapterReview(state, 'c3')).toBeNull();
    expect(chapterReview(state, 'missing')).toBeNull();
  });

  it('gives twelve votes with comments, stable across calls', () => {
    const state = sampleStory();
    const review = chapterReview(state, 'c1')!;
    expect(review.votes.map(vote => vote.readerId)).toEqual(READER_IDS);
    for (const vote of review.votes) {
      expect(vote.score).toBeGreaterThanOrEqual(1);
      expect(vote.score).toBeLessThanOrEqual(5);
      expect(vote.comment).toBeTruthy();
      expect(vote.comment).not.toMatch(/\{\w+\}/);
    }
    expect(review.average).toBe(Math.round(review.average * 10) / 10);
    expect(review.headline).toBeTruthy();
    expect(chapterReview(sampleStory(), 'c1')).toEqual(review);
  });

  it('only changes when the chapter changes', () => {
    const state = sampleStory();
    const before = chapterReview(state, 'c2');
    state.projects.p1.updatedAt = daysAgo(3);
    expect(chapterReview(state, 'c2')).toEqual(before);
    state.pages.c2p1.done = true;
    state.pages.c2p1.artRev = 2;
    expect(chapterFeatures(state, 'c2')!.pagesDone).toBe(2);
  });

  it('likes a finished, drawn chapter more than a bare script', () => {
    const state = sampleStory();
    addChapter(state, 'p1', 'bare');
    addScene(state, 'bare', 'sb', [{ type: 'action', text: 'Someone walks in.' }]);
    expect(chapterReview(state, 'c1')!.average).toBeGreaterThan(chapterReview(state, 'bare')!.average);
    expect(chapterReview(state, 'bare')!.headline).toMatch(/script/);
  });

  it('gives every reader a voice of at least eight comments', () => {
    for (const id of READER_IDS) {
      expect(COMMENTS[id as keyof typeof COMMENTS].length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('clubRanking', () => {
  it('ranks readable chapters by average, best first', () => {
    const state = sampleStory();
    const ranking = clubRanking(state);
    expect(ranking.map(row => row.chapterId).sort()).toEqual(['c1', 'c2']);
    expect(ranking.map(row => row.rank)).toEqual([1, 2]);
    for (let index = 1; index < ranking.length; index++) {
      expect(ranking[index - 1].average).toBeGreaterThanOrEqual(ranking[index].average);
    }
    expect(clubRanking(state)).toEqual(ranking);
    expect(clubRanking(emptyStory())).toEqual([]);
  });

  it('shares one set of reviews between the ranking and the letters', () => {
    const state = sampleStory();
    state.projects.p1.done = true;
    const drawn = (panelId: string) => panelId.length > 0;
    const club = clubReviews(state, drawn);
    expect(club.ranking).toEqual(clubRanking(state, drawn));
    expect([...club.reviews.keys()].sort()).toEqual(club.ranking.map(row => row.chapterId).sort());
    const m = zeroMetrics({ bestStreak: 31 });
    // Letters read the same votes whether they get the art check or the reviews already worked out.
    expect(lettersOf(state, m, EMPTY_STUDIO, 2, { reviews: club.reviews })).toEqual(lettersOf(state, m, EMPTY_STUDIO, 2, { hasArt: drawn }));
  });
});

describe('lettersOf', () => {
  it('sends nothing before there is a story', () => {
    expect(lettersOf(emptyStory(), zeroMetrics({ bestStreak: 40 }), EMPTY_STUDIO, 3)).toEqual([]);
  });

  it('answers what the person really did, newest first', () => {
    const state = sampleStory();
    state.projects.p1.done = true;
    const letters = lettersOf(state, zeroMetrics({ bestStreak: 31 }), EMPTY_STUDIO, 2);
    const ids = letters.map(letter => letter.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'first-page',
        'chapter-c1',
        'streak-7',
        'streak-30',
        'level-assistant',
        'level-oneshot',
        'first-character',
        'done-p1',
      ]),
    );
    expect(ids).not.toContain('chapter-c2');
    expect(new Set(ids).size).toBe(ids.length);
    for (let index = 1; index < letters.length; index++) {
      expect(letters[index - 1].at).toBeGreaterThanOrEqual(letters[index].at);
    }
    for (const letter of letters) {
      expect(READER_IDS).toContain(letter.fromId);
      expect(letter.at).toBeLessThanOrEqual(NOW);
      expect(`${letter.subject} ${letter.body}`).not.toMatch(/\{\w+\}/);
    }
    expect(letters.find(letter => letter.id === 'first-character')!.body).toContain('Aki');
    expect(letters.find(letter => letter.id === 'chapter-c1')!.chapterId).toBe('c1');
    expect(lettersOf(state, zeroMetrics({ bestStreak: 31 }), EMPTY_STUDIO, 2)).toEqual(letters);
  });

  it('skips milestones not reached and finds the level itself when not given', () => {
    const state = emptyStory();
    addProject(state, 'p', 'Night Train', { createdAt: daysAgo(3) });
    addChapter(state, 'p', 'c');
    addPage(state, 'c', 'pg', { done: false });
    expect(lettersOf(state, zeroMetrics({ bestStreak: 6 }), EMPTY_STUDIO).map(letter => letter.id)).toEqual([]);
    state.pages.pg.done = true;
    const ids = lettersOf(state, zeroMetrics({ projects: 1, pagesDone: 1, bestStreak: 3 }), EMPTY_STUDIO).map(letter => letter.id);
    expect(ids).toEqual(expect.arrayContaining(['first-page', 'chapter-c', 'level-assistant']));
  });

  it('has a chapter letter in every member voice', () => {
    expect(new Set(CHAPTER_LETTERS.map(line => line.from))).toEqual(new Set(READER_IDS));
  });
});
