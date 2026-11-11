/**
 * A short message on Home from one of the person's own characters. The character is picked by day from the
 * story worked on last; the line comes from their role, traits, goal and weakness, and from how long the
 * chapter they appear in has been left alone.
 */
import { t } from '../i18n';
import { chapterNumber, characterUsage } from '../model/selectors';
import type { Character, ID, Project, StoryData } from '../model/types';
import type { StoryRoute } from '../story/resume';
import { GOAL_LINES, ROLE_LINES, STALE_LINES, TRAIT_LINES, WEAKNESS_LINES } from './chatLines';
import { canFill, chapterTouchedAt, clip, daysSince, latestProject, namedCast, seedOf, type Params } from './castUtil';
import { pick } from './seed';
import { traitKinds } from './traits';
import type { CharacterMessage } from './types';

const MAX_LENGTH = 140;
/** A chapter left alone this long makes its characters say so. */
const STALE_DAYS = 3;

/** The chapter with this character that was worked on last. */
function latestChapterOf(state: StoryData, character: Character): ID | null {
  let best: ID | null = null;
  let bestAt = -1;
  for (const chapterId of characterUsage(state, character.id).chapterIds) {
    const at = chapterTouchedAt(state, chapterId);
    if (at > bestAt) {
      best = chapterId;
      bestAt = at;
    }
  }
  return best;
}

function routeFor(state: StoryData, project: Project, chapterId: ID | null): StoryRoute {
  if (!chapterId) {
    return { name: 'Project', params: { projectId: project.id } };
  }
  const hasPages = (state.chapters[chapterId]?.pageIds.length ?? 0) > 0;
  return { name: hasPages ? 'Storyboard' : 'Script', params: { chapterId } };
}

/** Every line this character could say today; stale lines count twice so a forgotten chapter gets noticed. */
function linesFor(character: Character, stale: boolean): string[] {
  const lines = [...ROLE_LINES[character.role]];
  for (const kind of traitKinds(character.traits)) {
    lines.push(...TRAIT_LINES[kind]);
  }
  if (character.goal.trim()) {
    lines.push(...GOAL_LINES);
  }
  if (character.weakness.trim()) {
    lines.push(...WEAKNESS_LINES);
  }
  if (stale) {
    lines.push(...STALE_LINES, ...STALE_LINES);
  }
  return lines;
}

export function characterMessage(state: StoryData, today: string): CharacterMessage | null {
  const project = latestProject(state);
  const cast = project ? namedCast(state, project.id) : [];
  if (!project || !cast.length) {
    return null;
  }
  const seed = seedOf('chat', today, project.id);
  const character = pick(cast, seed);
  const others = cast.filter(item => item.id !== character.id);
  const chapterId = latestChapterOf(state, character);
  const days = chapterId ? daysSince(chapterTouchedAt(state, chapterId), today) : 0;
  const params: Params = {
    story: project.title.trim(),
    other: others.length ? pick(others, seed + 1).name.trim() : '',
    goal: clip(character.goal, 48),
    weakness: clip(character.weakness, 40),
    n: chapterId ? chapterNumber(project, chapterId) : '',
    days: days >= STALE_DAYS ? days : '',
  };
  const usable = linesFor(character, days >= STALE_DAYS).filter(
    line => canFill(line, params) && t(line, params).length <= MAX_LENGTH,
  );
  const fallback = ROLE_LINES[character.role].filter(line => canFill(line, params));
  const line = pick(usable.length ? usable : fallback, seed + 2);
  return {
    characterId: character.id,
    projectId: project.id,
    text: t(line, params),
    route: routeFor(state, project, chapterId),
  };
}
