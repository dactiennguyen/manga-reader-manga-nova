/**
 * The Manganova reading club reads a chapter. Each of the 12 members scores it from what is really in it,
 * weighted by their tastes and how strict they are, plus a small seeded wobble so they don't all agree.
 * The seed is the chapter id and a signature of its content: the votes only change when the chapter does.
 */
import { t } from '../i18n';
import type { ID, StoryData } from '../model/types';
import { canFill, pagesText, panelsText, seedOf, type Params } from './castUtil';
import { READERS } from './cast';
import { COMMENTS, HEADLINES, type Comment, type Topic } from './readerLines';
import { hashString, pick, rand } from './seed';
import type { CastMember, ChapterReview, Taste, Vote } from './types';

export type ChapterFeatures = {
  pages: number;
  pagesDone: number;
  doneRatio: number;
  panels: number;
  panelsPerPage: number;
  drawnPages: number;
  artRatio: number;
  hasArt: boolean;
  bubbles: number;
  /** Bubbles placed per line of script that needs one, up to 1. */
  bubbleRatio: number;
  dialogueLines: number;
  narration: number;
  settings: number;
  actionLines: number;
  thinks: number;
  shouts: number;
  sfx: number;
  effects: number;
  speedEffects: number;
  moodEffects: number;
  words: number;
  wordsPerPage: number;
  wordsPerLine: number;
  /** Action lines out of action plus dialogue, 0 to 1. */
  actionRatio: number;
  speakers: number;
  topSpeakerId: ID | null;
  genres: string[];
};

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const cap = (value: number) => Math.max(0, Math.min(1, value));
const fit = (value: number, low: number, high: number) => (value < low ? value / low : value > high ? high / value : 1);

/** Null when the chapter has nothing to read: no script text and no laid out or lettered page. */
export function chapterFeatures(state: StoryData, chapterId: ID, hasArt?: (panelId: ID) => boolean): ChapterFeatures | null {
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return null;
  }
  const blocks = chapter.sceneIds.flatMap(id => state.scenes[id]?.blocks ?? []).filter(block => block.text.trim());
  const pages = chapter.pageIds.map(id => state.pages[id]).filter(Boolean);
  const readable = pages.filter(page => page.layout || page.bubbles.length);
  if (!blocks.length && !readable.length) {
    return null;
  }
  const lines = { dialogue: 0, narration: 0, setting: 0, action: 0, sfx: 0 };
  const spoken = new Map<ID, number>();
  let wordCount = 0;
  let thinks = 0;
  let shouts = 0;
  for (const block of blocks) {
    lines[block.type]++;
    wordCount += words(block.text);
    thinks += block.kind === 'think' ? 1 : 0;
    shouts += block.kind === 'shout' ? 1 : 0;
    if (block.type === 'dialogue' && block.characterId) {
      spoken.set(block.characterId, (spoken.get(block.characterId) ?? 0) + 1);
    }
  }
  let panels = 0;
  let drawnPages = 0;
  let bubbles = 0;
  let sfxBubbles = 0;
  const effects = { all: 0, speed: 0, mood: 0 };
  for (const page of pages) {
    const ids = Object.keys(page.panels);
    panels += ids.length;
    drawnPages += page.artRev > 0 || (hasArt && ids.some(hasArt)) ? 1 : 0;
    bubbles += page.bubbles.length;
    sfxBubbles += page.bubbles.filter(bubble => bubble.type === 'sfx').length;
    shouts += page.bubbles.filter(bubble => bubble.type === 'shout').length;
    for (const effect of page.effects) {
      effects.all++;
      effects.speed += effect.type === 'speed' || effect.type === 'focus' ? 1 : 0;
      effects.mood += effect.type === 'tone' || effect.type === 'gradient' ? 1 : 0;
    }
  }
  const pagesDone = pages.filter(page => page.done).length;
  const needBubbles = lines.dialogue + lines.narration + lines.sfx;
  const speakers = new Set([...spoken.keys(), ...chapter.characterIds].filter(id => state.characters[id]));
  const top = [...spoken.entries()].filter(([id]) => state.characters[id]).sort((a, b) => b[1] - a[1])[0];
  return {
    pages: pages.length,
    pagesDone,
    doneRatio: pages.length ? pagesDone / pages.length : 0,
    panels,
    panelsPerPage: pages.length ? panels / pages.length : 0,
    drawnPages,
    artRatio: pages.length ? drawnPages / pages.length : 0,
    hasArt: drawnPages > 0,
    bubbles,
    bubbleRatio: needBubbles ? cap(bubbles / needBubbles) : bubbles ? 1 : 0,
    dialogueLines: lines.dialogue,
    narration: lines.narration,
    settings: lines.setting,
    actionLines: lines.action,
    thinks,
    shouts,
    sfx: lines.sfx + sfxBubbles,
    effects: effects.all,
    speedEffects: effects.speed,
    moodEffects: effects.mood,
    words: wordCount,
    wordsPerPage: pages.length ? wordCount / pages.length : wordCount,
    wordsPerLine: lines.dialogue ? wordCount / Math.max(1, blocks.length) : 0,
    actionRatio: lines.action + lines.dialogue ? lines.action / (lines.action + lines.dialogue) : 0,
    speakers: speakers.size,
    topSpeakerId: top ? top[0] : null,
    genres: (state.projects[chapter.projectId]?.genres ?? []).map(genre => genre.toLowerCase()),
  };
}

/** How much of what a taste looks for is in the chapter, 0 to 1. */
function tasteSignal(f: ChapterFeatures, taste: Taste): number {
  const genre = (...names: string[]) => (names.some(name => f.genres.includes(name)) ? 0.35 : 0);
  const signals: Record<Taste, () => number> = {
    action: () =>
      0.4 * f.actionRatio + 0.3 * cap(f.sfx / 6) + 0.2 * cap(f.speedEffects / 3) + 0.1 * cap(f.shouts / 4) + genre('action', 'sports', 'adventure'),
    romance: () => 0.3 * cap(f.thinks / 4) + 0.25 * cap(f.moodEffects / 2) + 0.25 * f.artRatio + 0.2 * cap(f.dialogueLines / 15) + genre('romance'),
    mystery: () => 0.35 * cap(f.narration / 5) + 0.25 * cap(f.thinks / 4) + 0.4 * cap(f.dialogueLines / 18) + genre('mystery'),
    drama: () => 0.4 * cap(f.dialogueLines / 20) + 0.3 * cap(f.speakers / 4) + 0.3 * cap(f.words / 400) + genre('historical', 'school'),
    comedy: () =>
      0.35 * (f.wordsPerLine && f.wordsPerLine < 9 ? 1 : 0.3) + 0.25 * cap(f.shouts / 3) + 0.2 * cap(f.panelsPerPage / 6) + 0.2 * cap(f.dialogueLines / 10) + genre('comedy'),
    fantasy: () => 0.4 * cap(f.settings / 4) + 0.3 * f.artRatio + 0.3 * cap(f.effects / 4) + genre('fantasy', 'adventure', 'sci-fi'),
    horror: () => 0.35 * cap(f.moodEffects / 3) + 0.3 * cap(f.sfx / 4) + 0.2 * cap(f.narration / 4) + 0.15 * fit(f.wordsPerPage || 1, 1, 60) + genre('horror'),
    slice: () => 0.4 * (1 - f.actionRatio) + 0.3 * cap(f.dialogueLines / 12) + 0.3 * f.artRatio + genre('slice of life', 'school'),
    art: () => 0.5 * f.artRatio + 0.2 * cap(f.effects / 4) + 0.15 * f.bubbleRatio + 0.15 * f.doneRatio,
    dialogue: () => 0.4 * cap(f.dialogueLines / 15) + 0.3 * cap(f.speakers / 3) + 0.3 * (f.pages ? fit(f.wordsPerPage, 20, 80) : 0.5),
    pacing: () =>
      0.35 * (f.pages ? fit(f.panelsPerPage, 3, 7) : 0.3) + 0.25 * (1 - 2 * Math.abs(f.actionRatio - 0.5)) + 0.2 * cap(f.pages / 8) + 0.2 * f.doneRatio,
  };
  return cap(signals[taste]());
}

/** How finished and full the chapter is, whatever anyone's taste. */
function qualityOf(f: ChapterFeatures): number {
  return (
    0.3 * f.doneRatio +
    0.25 * f.artRatio +
    0.15 * f.bubbleRatio +
    0.15 * cap((f.dialogueLines + f.actionLines + f.narration) / 12) +
    0.15 * cap(f.pages / 6)
  );
}

function topicsOf(f: ChapterFeatures): Set<Topic> {
  const topics = new Set<Topic>();
  const add = (topic: Topic, when: boolean) => when && topics.add(topic);
  add('script', f.pages === 0);
  add('sketch', f.pages > 0 && f.artRatio < 0.3);
  add('finished', f.pages > 0 && f.doneRatio === 1);
  add('action', tasteSignal(f, 'action') >= 0.5);
  add('talk', f.dialogueLines >= 12 || f.wordsPerPage > 80);
  add('quiet', f.pages > 0 && f.dialogueLines <= 3);
  add('cast', f.speakers >= 3);
  add('short', f.pages > 0 && f.pages <= 4);
  add('long', f.pages >= 16);
  return topics;
}

function scoreOf(reader: CastMember, f: ChapterFeatures, quality: number, seed: number): Vote['score'] {
  const taste = reader.tastes.reduce((sum, item) => sum + tasteSignal(f, item), 0) / reader.tastes.length;
  const wobble = (rand(seed)() - 0.5) * 0.9;
  const raw = 1.5 + (0.5 * taste + 0.5 * quality) * 3.8 + (2 - reader.strictness) * 0.5 + wobble;
  return Math.max(1, Math.min(5, Math.round(raw))) as Vote['score'];
}

function commentOf(reader: CastMember, score: number, topics: Set<Topic>, params: Params, seed: number): string {
  const tone = score >= 4 ? 'high' : score === 3 ? 'mid' : 'low';
  const usable = COMMENTS[reader.id as keyof typeof COMMENTS].filter(
    (item: Comment) => (item.tone === tone || item.tone === 'any' || (item.tone === 'warm' && score >= 3)) && (!item.topic || topics.has(item.topic)) && canFill(item.text, params),
  );
  // Something that stood out is worth saying more often than a general remark.
  const weighted = usable.flatMap(item => (item.topic ? [item, item] : [item]));
  return weighted.length ? t(pick(weighted, seed).text, params) : '';
}

function headlineOf(votes: Vote[], f: ChapterFeatures, seed: number): string {
  const average = votes.reduce((sum, vote) => sum + vote.score, 0) / votes.length;
  const sorted = [...votes].sort((a, b) => b.score - a.score);
  const name = (id: Vote['readerId']) => READERS.find(reader => reader.id === id)?.name ?? '';
  const params: Params = {
    top: name(sorted[0].readerId),
    low: name(sorted[sorted.length - 1].readerId),
    count: votes.filter(vote => vote.score === 5).length,
  };
  const spread = sorted[0].score - sorted[sorted.length - 1].score;
  const bucket =
    f.pages === 0
      ? HEADLINES.script
      : spread >= 3
        ? HEADLINES.split
        : average >= 4.2 && Number(params.count) >= 3
          ? HEADLINES.rave
          : average >= 3.5
            ? HEADLINES.good
            : average >= 2.6
              ? HEADLINES.mixed
              : HEADLINES.tough;
  return t(pick(bucket, seed), params);
}

export function chapterReview(state: StoryData, chapterId: ID, hasArt?: (panelId: ID) => boolean): ChapterReview | null {
  const f = chapterFeatures(state, chapterId, hasArt);
  if (!f) {
    return null;
  }
  const signature = hashString(JSON.stringify(f));
  const quality = qualityOf(f);
  const topics = topicsOf(f);
  const params: Params = {
    name: f.topSpeakerId ? state.characters[f.topSpeakerId]?.name.trim() ?? '' : '',
    pages: f.pages ? pagesText(f.pages) : '',
    panels: f.panels ? panelsText(f.panels) : '',
  };
  const votes: Vote[] = READERS.map(reader => {
    const seed = seedOf(chapterId, signature, reader.id);
    const score = scoreOf(reader, f, quality, seed);
    return { readerId: reader.id, score, comment: commentOf(reader, score, topics, params, seed + 1) };
  });
  const average = Math.round((votes.reduce((sum, vote) => sum + vote.score, 0) / votes.length) * 10) / 10;
  return { chapterId, votes, average, headline: headlineOf(votes, f, seedOf(chapterId, signature, 'headline')) };
}
