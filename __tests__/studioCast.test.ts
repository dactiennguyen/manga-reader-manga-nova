import { setLocale } from '../src/core/i18n';
import { CATALOG_PARTS } from '../src/core/i18n/catalog';
import { EDITOR, READERS, castMember } from '../src/core/studio/cast';
import { characterCard, profileCompleteness, rarityOf } from '../src/core/studio/cards';
import { ageYears } from '../src/core/studio/castUtil';
import { characterMessage } from '../src/core/studio/characterChat';
import { editorNote } from '../src/core/studio/editor';
import { GENERIC_PROMPTS, STORY_PROMPTS } from '../src/core/studio/promptLines';
import { dailyPrompt } from '../src/core/studio/prompts';
import { traitKinds } from '../src/core/studio/traits';
import { EMPTY_STUDIO, READER_IDS, type Rarity } from '../src/core/studio/types';
import { DAY_MS, dayKey, dayKeyToDate } from '../src/core/util/time';
import {
  TODAY,
  addChapter,
  addCharacter,
  addPage,
  addProject,
  addScene,
  daysAgo,
  emptyStory,
  sampleStory,
  zeroMetrics,
} from './helpers/studioStory';

/** The next `count` day keys from today. */
const days = (count: number) =>
  Array.from({ length: count }, (_, index) => dayKey(dayKeyToDate(TODAY).getTime() + (index * DAY_MS + DAY_MS / 2)));

afterEach(() => setLocale('en'));

describe('cast', () => {
  it('has the editor and twelve readers in order', () => {
    expect(EDITOR.id).toBe('mori');
    expect(READERS.map(reader => reader.id)).toEqual(READER_IDS);
    expect(castMember('tetsu').strictness).toBe(3);
    expect(castMember('mori')).toBe(EDITOR);
  });
});

describe('editorNote', () => {
  const m = zeroMetrics();

  it('welcomes someone with no story', () => {
    const note = editorNote(emptyStory(), m, TODAY);
    expect(note.situation).toBe('welcome');
    expect(note.text).toBeTruthy();
    expect(note.action).toBeUndefined();
  });

  it('asks for an outline when a story has no chapters', () => {
    const state = emptyStory();
    addProject(state, 'p', 'Night Train');
    const note = editorNote(state, m, TODAY);
    expect(note.situation).toBe('noChapters');
    expect(note.text).toContain('Night Train');
    expect(note.action?.route).toEqual({ name: 'Outline', params: { projectId: 'p' } });
  });

  it('asks for a script, then pages, then drawing', () => {
    const state = emptyStory();
    addProject(state, 'p', 'Night Train');
    addChapter(state, 'p', 'c');
    expect(editorNote(state, m, TODAY).situation).toBe('noScript');
    expect(editorNote(state, m, TODAY).action?.route).toEqual({ name: 'Script', params: { chapterId: 'c' } });
    addScene(state, 'c', 's', [{ type: 'dialogue', text: 'Hello' }]);
    expect(editorNote(state, m, TODAY).situation).toBe('scriptNoPages');
    expect(editorNote(state, m, TODAY).action?.route.name).toBe('Storyboard');
    addPage(state, 'c', 'pg1');
    addPage(state, 'c', 'pg2', { done: true });
    const note = editorNote(state, m, TODAY);
    expect(note.situation).toBe('pagesLeft');
    expect(note.text).toMatch(/1 page|chapter 1/i);
  });

  it('sends flagged pages to be fixed first', () => {
    const state = sampleStory();
    state.pages.c2p1.flag = { note: 'Hands', reasons: [] };
    const note = editorNote(state, m, TODAY);
    expect(note.situation).toBe('flagged');
    expect(note.action?.route).toEqual({ name: 'Storyboard', params: { chapterId: 'c2' } });
  });

  it('points at export when everything is done', () => {
    const state = emptyStory();
    addProject(state, 'p', 'Night Train');
    addChapter(state, 'p', 'c', { updatedAt: daysAgo(9) });
    addPage(state, 'c', 'pg', { done: true, updatedAt: daysAgo(9) });
    const note = editorNote(state, m, TODAY);
    expect(note.situation).toBe('allDone');
    expect(note.action?.route).toEqual({ name: 'Export', params: { projectId: 'p' } });
  });

  it('cheers a chapter finished today', () => {
    const state = sampleStory();
    state.chapters.c2.pageIds.forEach(id => Object.assign(state.pages[id], { done: true, updatedAt: daysAgo(0) }));
    const note = editorNote(state, m, TODAY);
    expect(note.situation).toBe('chapterDone');
    expect(note.text).toMatch(/2/);
    expect(note.action).toBeDefined();
  });

  it('celebrates streaks and new levels, and welcomes people back', () => {
    const state = sampleStory();
    expect(editorNote(state, zeroMetrics({ streak: 6 }), TODAY, { drewToday: false }).situation).toBe('streakRisk');
    expect(editorNote(state, zeroMetrics({ streak: 7 }), TODAY, { drewToday: true }).situation).toBe('streakKept');
    expect(editorNote(state, zeroMetrics({ streak: 8 }), TODAY, { drewToday: true }).situation).toBe('pagesLeft');
    const level = editorNote(state, m, TODAY, { levelIndex: 2, levelSeen: 1 });
    expect(level.situation).toBe('levelUp');
    // Worked on every one of these days, so only the streak decides.
    const onDay = (day: string, best: number) => {
      state.projects.p1.updatedAt = dayKeyToDate(day).getTime() + DAY_MS / 2;
      return editorNote(state, zeroMetrics({ bestStreak: best }), day).situation;
    };
    expect(days(30).map(day => onDay(day, 12))).toContain('streakBroken');
    expect(days(30).map(day => onDay(day, 2))).not.toContain('streakBroken');
    state.projects.p1.updatedAt = daysAgo(12);
    const away = editorNote(state, m, TODAY);
    expect(away.situation).toBe('absence');
    expect(away.action).toBeDefined();
  });

  it('is stable within a day, changes across days and uses real names', () => {
    const state = sampleStory();
    expect(editorNote(state, m, TODAY)).toEqual(editorNote(state, m, TODAY));
    const texts = days(20).map(day => editorNote(state, m, day).text);
    expect(new Set(texts).size).toBeGreaterThan(2);
    expect(texts.some(text => text.includes('Aki') || text.includes('2'))).toBe(true);
  });

  it('speaks Vietnamese and Japanese', () => {
    setLocale('vi');
    expect(editorNote(emptyStory(), m, TODAY).text).toMatch(/Mori|truyện/);
    setLocale('ja');
    expect(editorNote(emptyStory(), m, TODAY).text).toMatch(/[ぁ-んァ-ン一-龯]/);
  });
});

describe('characterMessage', () => {
  it('needs a named character', () => {
    expect(characterMessage(emptyStory(), TODAY)).toBeNull();
    const state = emptyStory();
    addProject(state, 'p', 'Night Train');
    addCharacter(state, 'p', 'x', { name: '  ' });
    expect(characterMessage(state, TODAY)).toBeNull();
  });

  it('is short, stable for the day and routes to the character', () => {
    const state = sampleStory();
    const message = characterMessage(state, TODAY)!;
    expect(message).toEqual(characterMessage(state, TODAY));
    expect(message.projectId).toBe('p1');
    for (const day of days(40)) {
      const item = characterMessage(state, day)!;
      expect(item.text.length).toBeLessThanOrEqual(140);
      expect(item.text).not.toMatch(/\{\w+\}/);
      expect(['Storyboard', 'Script', 'Project']).toContain(item.route.name);
    }
  });

  it('mentions a chapter left alone for days', () => {
    const state = emptyStory();
    addProject(state, 'p', 'Night Train');
    addCharacter(state, 'p', 'aki', { name: 'Aki', role: 'main' });
    addChapter(state, 'p', 'c', { characterIds: ['aki'], updatedAt: daysAgo(10) });
    const texts = days(20).map(day => characterMessage(state, day)!.text);
    expect(texts.some((text, index) => text.includes(String(10 + index)))).toBe(true);
    expect(characterMessage(state, TODAY)!.route).toEqual({ name: 'Script', params: { chapterId: 'c' } });
  });
});

describe('traitKinds', () => {
  it('reads traits loosely in three languages', () => {
    expect(traitKinds(['Brave', 'nhút nhát', '優しい', 'tall'])).toEqual(['brave', 'shy', 'kind']);
  });
});

describe('dailyPrompt', () => {
  it('has rich template sets', () => {
    expect(STORY_PROMPTS.length).toBeGreaterThanOrEqual(60);
    expect(GENERIC_PROMPTS.length).toBeGreaterThanOrEqual(30);
  });

  it('falls back to a generic prompt without a story', () => {
    const prompt = dailyPrompt(emptyStory(), TODAY);
    expect(prompt.projectId).toBeUndefined();
    expect(prompt.route).toBeUndefined();
    expect(prompt.text).not.toMatch(/\{\w+\}/);
  });

  it('builds prompts from the story, alternating draw and write', () => {
    const state = sampleStory();
    expect(dailyPrompt(state, TODAY)).toEqual(dailyPrompt(state, TODAY));
    const prompts = days(30).map(day => dailyPrompt(state, day));
    expect(new Set(prompts.map(item => item.kind))).toEqual(new Set(['draw', 'write']));
    expect(prompts[0].kind).not.toBe(prompts[1].kind);
    for (const prompt of prompts) {
      expect(prompt.projectId).toBe('p1');
      expect(prompt.route).toBeDefined();
      expect(prompt.text).not.toMatch(/\{\w+\}/);
    }
    const text = prompts.map(item => item.text).join(' ');
    expect(text).toMatch(/Aki|Kuro|Hina/);
    expect(new Set(prompts.map(item => item.id)).size).toBeGreaterThan(20);
    const write = prompts.find(item => item.kind === 'write')!;
    expect(write.route).toEqual({ name: 'Script', params: { chapterId: 'c2' } });
  });

  it('keeps the same id all day when the story is edited', () => {
    const state = sampleStory();
    const day = days(30).find(item => /Aki|Kuro|Hina/.test(dailyPrompt(state, item).text))!;
    const before = dailyPrompt(state, day);
    for (const character of Object.values(state.characters)) {
      character.name = `${character.name}x`;
    }
    const after = dailyPrompt(state, day);
    expect(after.text).not.toBe(before.text);
    expect(after.id).toBe(before.id);
    expect(before.id.startsWith(`prompt-${day}-`)).toBe(true);
  });
});

describe('characterCard', () => {
  const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legend: 3 };

  it('rises in rarity as the profile fills in', () => {
    const state = sampleStory();
    const steps: Partial<Record<string, unknown>>[] = [
      { age: '17' },
      { gender: 'girl' },
      { appearance: 'Flour on her cheeks' },
      { voice: 'Loud. Says "Let\'s bake!"' },
      { bio: 'Grew up on the moon.' },
      { sheet: { face: 'face.png', expressions: { happy: 'a', sad: 'b', angry: 'c' } } },
    ];
    let last = -1;
    let lastScore = -1;
    for (const step of steps) {
      Object.assign(state.characters.hina, step);
      const score = profileCompleteness(state, state.characters.hina);
      const rank = RANK[characterCard(state, 'hina', EMPTY_STUDIO).rarity];
      expect(score).toBeGreaterThan(lastScore);
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
      lastScore = score;
    }
    expect(last).toBeGreaterThan(0);
    expect(RANK[rarityOf(1, 'extra')]).toBe(3);
    expect(RANK[rarityOf(0.42, 'main')]).toBeGreaterThan(RANK[rarityOf(0.42, 'extra')]);
  });

  it('reads an age range by its first number', () => {
    const statsAt = (age: string) => {
      const state = sampleStory();
      state.characters.aki.age = age;
      return characterCard(state, 'aki', EMPTY_STUDIO).stats;
    };
    expect(statsAt('16-18')).toEqual(statsAt('16'));
    expect(statsAt('16-18')).not.toEqual(statsAt('70'));
    expect(ageYears('16-18')).toBe(16);
    expect(ageYears('about 30 tuổi')).toBe(30);
    expect(ageYears('old')).toBeNull();
  });

  it('gives stats from 1 to 99, a quote and a frame', () => {
    const state = sampleStory();
    const card = characterCard(state, 'aki', EMPTY_STUDIO);
    expect(card).toEqual(characterCard(state, 'aki', EMPTY_STUDIO));
    for (const value of Object.values(card.stats)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(99);
    }
    expect(card.quote).toContain('open the best bakery on the moon');
    expect(card.frame).toBe('plain');
    expect(characterCard(state, 'aki', { unlocked: ['frame:ink', 'palette:sea', 'frame:gold'] }).frame).toBe('gold');
    state.characters.kuro.voice = 'Cold. Always says "Bread is power."';
    expect(characterCard(state, 'kuro', EMPTY_STUDIO).quote).toBe('Bread is power.');
    expect(characterCard(state, 'kuro', EMPTY_STUDIO).stats.power).toBeGreaterThan(characterCard(state, 'hina', EMPTY_STUDIO).stats.power);
  });
});

describe('honesty', () => {
  const BANNED = /\b(users?|views|viewers?|downloads?|followers?|subscribers?|likes)\b|người dùng|lượt xem|lượt tải|người theo dõi|ユーザー|閲覧数|再生数|ダウンロード|フォロワー/i;
  const PARTS = ['club', 'clubChat', 'clubPrompts', 'clubReviews', 'clubVoices', 'clubLetters'];

  it('never talks about users, views or downloads in any language', () => {
    const wrong: string[] = [];
    for (const part of PARTS) {
      for (const [key, entry] of Object.entries(CATALOG_PARTS[part])) {
        for (const text of [key, entry.vi, entry.ja]) {
          if (BANNED.test(text)) {
            wrong.push(text);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('keeps generated text free of those words too', () => {
    const state = sampleStory();
    const out = days(14).flatMap(day => [
      editorNote(state, zeroMetrics({ streak: 3 }), day, { drewToday: false }).text,
      characterMessage(state, day)!.text,
      dailyPrompt(state, day).text,
    ]);
    expect(out.filter(text => BANNED.test(text))).toEqual([]);
  });
});
