/**
 * Today's prompt: a small drawing or writing task built from the person's own characters and places. Days
 * alternate between drawing and writing, and the same day always gives the same prompt.
 */
import { t } from '../i18n';
import { worldOf } from '../model/selectors';
import type { Expression, Project, StoryData } from '../model/types';
import type { StoryRoute } from '../story/resume';
import { canFill, clip, currentChapter, dayNumber, latestProject, namedCast, seedOf, type Params } from './castUtil';
import { EXPRESSION_WORDS, GENERIC_PROMPTS, SITUATIONS, STORY_PROMPTS, type PromptLine } from './promptLines';
import { pick } from './seed';
import type { DailyPrompt } from './types';

const EXPRESSIONS = Object.keys(EXPRESSION_WORDS) as Expression[];

/** Writing goes to the script of the chapter in progress; drawing to its storyboard once it has pages. */
function routeFor(state: StoryData, project: Project, kind: PromptLine['kind']): StoryRoute {
  const chapter = currentChapter(state, project);
  if (!chapter) {
    return { name: kind === 'write' ? 'Outline' : 'Project', params: { projectId: project.id } };
  }
  if (kind === 'write') {
    return { name: 'Script', params: { chapterId: chapter.chapterId } };
  }
  const hasPages = (state.chapters[chapter.chapterId]?.pageIds.length ?? 0) > 0;
  return hasPages
    ? { name: 'Storyboard', params: { chapterId: chapter.chapterId } }
    : { name: 'Project', params: { projectId: project.id } };
}

function choose(lines: PromptLine[], params: Params, today: string, salt: string): PromptLine {
  const kind: PromptLine['kind'] = dayNumber(today) % 2 === 0 ? 'draw' : 'write';
  const usable = lines.filter(line => canFill(line.text, params));
  const ofKind = usable.filter(line => line.kind === kind);
  return pick(ofKind.length ? ofKind : usable, seedOf('prompt', today, salt));
}

/**
 * The day and the template's place in its list, nothing filled in from the story, so editing a name or a
 * place later that day keeps the same id and a prompt marked done stays done.
 */
function idOf(today: string, lines: PromptLine[], line: PromptLine): string {
  return `prompt-${today}-${lines === GENERIC_PROMPTS ? 'g' : 's'}${lines.indexOf(line)}`;
}

export function dailyPrompt(state: StoryData, today: string): DailyPrompt {
  const seed = seedOf('prompt-parts', today);
  const fragments: Params = {
    expression: t(EXPRESSION_WORDS[pick(EXPRESSIONS, seed)]),
    situation: t(pick(SITUATIONS, seed + 1)),
  };
  const project = latestProject(state);
  const cast = project ? namedCast(state, project.id) : [];
  if (!project || (!cast.length && !project.title.trim())) {
    const line = choose(GENERIC_PROMPTS, fragments, today, 'any');
    return { id: idOf(today, GENERIC_PROMPTS, line), kind: line.kind, text: t(line.text, fragments) };
  }
  const character = cast.length ? pick(cast, seed + 2) : undefined;
  const others = cast.filter(item => item !== character);
  const places = worldOf(state, project.id).filter(entry => entry.type === 'place' && entry.title.trim());
  const params: Params = {
    ...fragments,
    story: project.title.trim(),
    name: character?.name.trim() ?? '',
    other: others.length ? pick(others, seed + 3).name.trim() : '',
    place: places.length ? clip(pick(places, seed + 4).title, 40) : '',
    goal: character ? clip(character.goal, 60) : '',
    weakness: character ? clip(character.weakness, 50) : '',
  };
  const line = choose(STORY_PROMPTS, params, today, project.id);
  return {
    id: idOf(today, STORY_PROMPTS, line),
    kind: line.kind,
    text: t(line.text, params),
    projectId: project.id,
    characterId: character && line.text.includes('{name}') ? character.id : undefined,
    route: routeFor(state, project, line.kind),
  };
}
