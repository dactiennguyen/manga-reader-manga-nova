/**
 * Mori's note on Home. One situation is chosen from the person's stories and streak, then one line for it,
 * picked by day: the note changes every morning and stays the same all day.
 */
import { t } from '../i18n';
import { chapterIdsOf, chapterProgress, chapterStatus } from '../model/selectors';
import type { Project, StoryData } from '../model/types';
import { nextStepOf } from '../story/nextStep';
import { canFill, chapterTouchedAt, daysSince, latestProject, namedCast, pagesText, seedOf, type Params } from './castUtil';
import { EDITOR_LINES } from './editorLines';
import { LEVELS } from './journey';
import { pick } from './seed';
import type { EditorNote, EditorSituation, Metrics } from './types';

/** What Home knows beyond the metrics. Every field is optional; a missing one just skips that situation. */
export type EditorContext = {
  /** Whether anything was drawn today, which tells a streak at risk from one already kept. */
  drewToday?: boolean;
  /** Current journey level and the highest one already celebrated. */
  levelIndex?: number;
  levelSeen?: number;
  /** msg() title of the current level; taken from the journey when missing. */
  levelTitle?: string;
};

const ABSENCE_DAYS = 5;
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100];

type Work = { situation: EditorSituation; params: Params };

/** The button that matches what the note says, among the ones nextStepOf offers. */
const PREFERRED_ROUTE: Partial<Record<EditorSituation, string>> = {
  noScript: 'Script',
  scriptNoPages: 'Storyboard',
  allDone: 'Export',
};

/** Where the latest story stands, in the same order as nextStepOf. */
function workOf(state: StoryData, project: Project): Work {
  const ids = chapterIdsOf(project);
  if (!ids.length) {
    return { situation: 'noChapters', params: {} };
  }
  for (const [index, chapterId] of ids.entries()) {
    const flagged = (state.chapters[chapterId]?.pageIds ?? []).filter(pageId => {
      const page = state.pages[pageId];
      return !!page && (!!page.flag || Object.values(page.panels).some(panel => panel.redo));
    }).length;
    if (flagged > 0) {
      return { situation: 'flagged', params: { n: index + 1, pages: pagesText(flagged) } };
    }
  }
  const statuses = ids.map(id => chapterStatus(state, id));
  const open = statuses.findIndex(status => status !== 'done');
  if (open < 0) {
    return { situation: 'allDone', params: {} };
  }
  const n = open + 1;
  if (statuses[open] === 'drawing') {
    const { done, total } = chapterProgress(state, ids[open]);
    return { situation: 'pagesLeft', params: { n, pages: pagesText(total - done), finished: done ? pagesText(done) : '' } };
  }
  return { situation: statuses[open] === 'writing' ? 'scriptNoPages' : 'noScript', params: { n } };
}

/** A chapter of this story finished within the last day, so Mori can cheer while it is fresh. */
function freshChapter(state: StoryData, project: Project, today: string): number {
  const ids = chapterIdsOf(project);
  const index = ids.findIndex(
    id => chapterStatus(state, id) === 'done' && daysSince(chapterTouchedAt(state, id), today) <= 1,
  );
  return index + 1;
}

function moodOf(state: StoryData, project: Project, m: Metrics, today: string, context: EditorContext): Work | null {
  const seed = seedOf('mori-mood', today);
  const away = daysSince(project.updatedAt, today);
  if (away >= ABSENCE_DAYS) {
    return { situation: 'absence', params: { days: away } };
  }
  const { levelIndex, levelSeen } = context;
  if (levelIndex !== undefined && levelSeen !== undefined && levelIndex > levelSeen) {
    const title = context.levelTitle ?? LEVELS[levelIndex]?.title;
    return { situation: 'levelUp', params: { level: title ? t(title) : '' } };
  }
  if (project.done) {
    return { situation: 'storyDone', params: {} };
  }
  const fresh = freshChapter(state, project, today);
  if (fresh > 0) {
    return { situation: 'chapterDone', params: { n: fresh } };
  }
  if (context.drewToday === false && m.streak >= 2 && (m.streak >= 5 || seed % 2 === 0)) {
    return { situation: 'streakRisk', params: { count: m.streak } };
  }
  if (context.drewToday && (STREAK_MILESTONES.includes(m.streak) || (m.streak > 10 && m.streak % 10 === 0))) {
    return { situation: 'streakKept', params: { count: m.streak } };
  }
  if (m.streak === 0 && m.bestStreak >= 3 && seed % 3 === 0) {
    return { situation: 'streakBroken', params: { best: m.bestStreak } };
  }
  return null;
}

function lineFor(situation: EditorSituation, params: Params, today: string): string | null {
  const usable = EDITOR_LINES[situation].filter(line => canFill(line, params));
  return usable.length ? t(pick(usable, seedOf('mori', today, situation)), params) : null;
}

/** The situation behind today's note, exported for tests and for Home to style the card. */
export function editorSituation(state: StoryData, m: Metrics, today: string, context: EditorContext = {}): EditorSituation {
  return editorNote(state, m, today, context).situation ?? 'welcome';
}

export function editorNote(state: StoryData, m: Metrics, today: string, context: EditorContext = {}): EditorNote {
  const project = latestProject(state);
  if (!project) {
    return { text: lineFor('welcome', {}, today) ?? '', situation: 'welcome' };
  }
  const work = workOf(state, project);
  const shared: Params = {
    story: project.title.trim(),
    name: namedCast(state, project.id)[0]?.name.trim() ?? '',
  };
  const step = nextStepOf(state, project);
  const wanted = PREFERRED_ROUTE[work.situation];
  const action = step.actions.find(item => item.route.name === wanted) ?? step.actions[0];
  const mood = moodOf(state, project, m, today, context);
  for (const choice of mood ? [mood, work] : [work]) {
    const text = lineFor(choice.situation, { ...shared, ...work.params, ...choice.params }, today);
    if (text) {
      return { text, action, situation: choice.situation };
    }
  }
  return { text: step.text, action, situation: work.situation };
}
