import { GENRES, LIMITS } from '../model/constants';
import { AiError, chat, extractJson, type AiMessage } from './port';

export type StoryIdea = { title: string; genres: string[]; logline: string };

type PlotChapter = { title: string; summary: string };

export type PlotDirection = { tone: string; title: string; summary: string; acts: PlotChapter[][] };

export type SceneIdea = { description: string; setting: string };

export type StoryContext = { title: string; genres: string[]; logline: string };

const EDITOR =
  'You are an experienced manga story editor helping an author. Answer with JSON only: no markdown fences, no commentary. Write in the same language as the author.';

const FORMAT_ERROR = 'The AI answer was not in the expected format. Try again.';

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

export function matchGenres(value: unknown): string[] {
  const picked: string[] = [];
  for (const item of list(value)) {
    const name = text(item, 40).toLowerCase();
    const match = GENRES.find(genre => genre.toLowerCase() === name);
    if (match && !picked.includes(match)) {
      picked.push(match);
    }
  }
  return picked.slice(0, LIMITS.genresPerProject);
}

export function parseStoryIdea(value: unknown): StoryIdea {
  const title = text(field(value, 'title'), LIMITS.projectTitle);
  const logline = text(field(value, 'logline'), LIMITS.logline);
  if (!title || !logline) {
    throw new AiError('format', FORMAT_ERROR);
  }
  return { title, logline, genres: matchGenres(field(value, 'genres')) };
}

export function parsePlotDirections(value: unknown, actCount: number): PlotDirection[] {
  const source = Array.isArray(value) ? value : list(field(value, 'directions'));
  const directions: PlotDirection[] = [];
  for (const item of source) {
    const acts = list(field(item, 'acts'))
      .slice(0, Math.max(1, actCount))
      .map(act =>
        list(Array.isArray(act) ? act : field(act, 'chapters'))
          .map(chapter => ({
            title: text(field(chapter, 'title'), LIMITS.chapterTitle),
            summary: text(field(chapter, 'summary'), LIMITS.chapterSummary),
          }))
          .filter(chapter => chapter.title || chapter.summary)
          .slice(0, 4),
      );
    if (!acts.some(act => act.length > 0)) {
      continue;
    }
    while (acts.length < actCount) {
      acts.push([]);
    }
    directions.push({
      tone: text(field(item, 'tone'), 24),
      title: text(field(item, 'title'), LIMITS.projectTitle) || 'Untitled direction',
      summary: text(field(item, 'summary'), 240),
      acts,
    });
  }
  if (!directions.length) {
    throw new AiError('format', FORMAT_ERROR);
  }
  return directions.slice(0, 3);
}

export function parseSceneIdeas(value: unknown): SceneIdea[] {
  const source = Array.isArray(value) ? value : list(field(value, 'scenes'));
  const scenes = source
    .map(item => ({ description: text(field(item, 'description'), 200), setting: text(field(item, 'setting'), 80) }))
    .filter(scene => scene.description);
  if (!scenes.length) {
    throw new AiError('format', FORMAT_ERROR);
  }
  return scenes.slice(0, 6);
}

function describe(story: StoryContext): string {
  return [
    `Title: ${story.title || 'Untitled'}`,
    story.genres.length ? `Genres: ${story.genres.join(', ')}` : '',
    `Logline: ${story.logline || '(none yet)'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function storyIdeaMessages(idea: string): AiMessage[] {
  return [
    { role: 'system', content: EDITOR },
    {
      role: 'user',
      content: `Turn this idea into a manga pitch.\nIdea: ${idea}\n\nReturn {"title": string (max ${
        LIMITS.projectTitle
      } characters), "genres": 1 to 3 items chosen only from [${GENRES.join(', ')}], "logline": one sentence, max ${
        LIMITS.logline
      } characters, saying who it is about, what they want and what stands in the way}.`,
    },
  ];
}

function plotMessages(story: StoryContext, actTitles: string[]): AiMessage[] {
  const acts = actTitles.map((title, index) => `${index + 1}. ${title}`).join('\n');
  return [
    { role: 'system', content: EDITOR },
    {
      role: 'user',
      content: `${describe(
        story,
      )}\n\nThe story is split into these acts:\n${acts}\n\nPropose 3 clearly different plot directions (for example adventure, tragedy, comedy). For each one give chapters for every act, 1 to 3 chapters per act.\n\nReturn {"directions": [{"tone": one or two words, "title": short name of the direction, "summary": one sentence, "acts": [{"chapters": [{"title": max ${
        LIMITS.chapterTitle
      } characters, "summary": max 200 characters}]}]}]} with exactly ${
        actTitles.length
      } items in "acts", in act order.`,
    },
  ];
}

function sceneMessages(
  story: StoryContext,
  chapter: { title: string; summary: string; goal: string },
): AiMessage[] {
  return [
    { role: 'system', content: EDITOR },
    {
      role: 'user',
      content: `${describe(story)}\n\nChapter: ${chapter.title || 'Untitled'}\nSummary: ${
        chapter.summary || '(none)'
      }\nGoal: ${
        chapter.goal || '(none)'
      }\n\nBreak this chapter into 3 to 6 scenes for a manga script.\n\nReturn {"scenes": [{"setting": place and time, max 60 characters, "description": what happens in the scene, max 160 characters}]}.`,
    },
  ];
}

export const AI_ATTEMPTS = 3;

export async function askJson<T>(
  messages: AiMessage[],
  parse: (value: unknown) => T,
  signal?: AbortSignal,
  ask: (messages: AiMessage[], signal?: AbortSignal) => Promise<string> = (input, abort) =>
    chat(input, { signal: abort }),
): Promise<T> {
  let last: unknown = null;
  for (let attempt = 0; attempt < AI_ATTEMPTS; attempt++) {
    try {
      return parse(extractJson(await ask(messages, signal)));
    } catch (error) {
      last = error;
      if (!(error instanceof AiError) || (error.code !== 'format' && error.code !== 'empty')) {
        throw error;
      }
    }
  }
  throw last;
}

export async function suggestStory(idea: string, signal?: AbortSignal): Promise<StoryIdea> {
  return askJson(storyIdeaMessages(idea), parseStoryIdea, signal);
}

export async function suggestPlots(
  story: StoryContext,
  actTitles: string[],
  signal?: AbortSignal,
): Promise<PlotDirection[]> {
  return askJson(plotMessages(story, actTitles), value => parsePlotDirections(value, actTitles.length), signal);
}

export async function suggestScenes(
  story: StoryContext,
  chapter: { title: string; summary: string; goal: string },
  signal?: AbortSignal,
): Promise<SceneIdea[]> {
  return askJson(sceneMessages(story, chapter), parseSceneIdeas, signal);
}
