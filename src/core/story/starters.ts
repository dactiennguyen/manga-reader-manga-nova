import { msg, t } from '../i18n';
import { chapterIdsOf } from '../model/selectors';
import type { ID, Project } from '../model/types';
import type { FormatKey } from './newProject';
import type { ChapterActions, SceneActions } from './slices/types';

/**
 * A starter fills a new story with an outline and laid-out pages, so the first screen is not empty.
 * The text is written into the story in the person's language, and is theirs to change.
 */

export type StarterKey = 'blank' | 'yonkoma' | 'oneshot' | 'episode';

type Beat = { scene: string; note: string };

export type Starter = {
  key: StarterKey;
  label: string;
  hint: string;
  /** The format this starter is built for. Blank works with any. */
  formatKey?: FormatKey;
  summary: string;
  goal: string;
  beats: Beat[];
  /** One layout template id per page. */
  pages: string[];
};

export const STARTERS: Starter[] = [
  {
    key: 'blank',
    label: msg('Blank'),
    hint: msg('An empty story. Add chapters and pages yourself.'),
    summary: '',
    goal: '',
    beats: [],
    pages: [],
  },
  {
    key: 'yonkoma',
    label: msg('4-koma strip'),
    hint: msg('Two four-panel gag strips with the classic setup, build, twist and punchline.'),
    formatKey: 'manga-B5',
    summary: msg('Two four-panel strips. Each one tells a complete joke.'),
    goal: msg('Make the reader smile by the fourth panel.'),
    beats: [
      { scene: msg('Panel 1: setup'), note: msg('Show who is here and what is normal.') },
      { scene: msg('Panel 2: build'), note: msg('Carry the situation one step further.') },
      { scene: msg('Panel 3: twist'), note: msg('Something unexpected happens.') },
      { scene: msg('Panel 4: punchline'), note: msg('The reaction or the result. Keep it short.') },
    ],
    pages: ['k4', 'k4'],
  },
  {
    key: 'oneshot',
    label: msg('One-shot, 8 pages'),
    hint: msg('A short complete story: opening page, problem, turning point and ending, already laid out.'),
    formatKey: 'manga-B5',
    summary: msg('A complete short story in eight pages.'),
    goal: msg('One character, one problem, one change.'),
    beats: [
      { scene: msg('Pages 1–2: opening'), note: msg('A strong first image, then who the story is about and what they want.') },
      { scene: msg('Pages 3–4: the problem'), note: msg('What stands in the way. Make it worse on page 4.') },
      { scene: msg('Pages 5–7: the turn'), note: msg('The biggest moment of the story. Give it the largest panel.') },
      { scene: msg('Page 8: ending'), note: msg('Show what has changed. End on an image, not an explanation.') },
    ],
    pages: ['b1', 'g4-wide', 'g5-a', 'g3-top', 'g6-grid', 'd4', 'b3', 'g3-bottom'],
  },
  {
    key: 'episode',
    label: msg('Webtoon episode'),
    hint: msg('One scrolling episode in five strips, ending on a cliffhanger.'),
    formatKey: 'webtoon',
    summary: msg('One webtoon episode, read by scrolling.'),
    goal: msg('Hook the reader in the first screen and leave them wanting the next episode.'),
    beats: [
      { scene: msg('Hook'), note: msg('Open on a question or a striking image. No long introduction.') },
      { scene: msg('Build'), note: msg('Let the scene breathe: wide spacing, one idea per screen.') },
      { scene: msg('Turn'), note: msg('The moment that changes the episode.') },
      { scene: msg('Cliffhanger'), note: msg('Stop just before the answer.') },
    ],
    pages: ['s3', 's4', 's3', 's5', 's2'],
  },
];

export function starterOf(key: StarterKey): Starter {
  return STARTERS.find(item => item.key === key) ?? STARTERS[0];
}

/** A starter stays picked only while the chosen format is the one it was made for. */
export function starterFits(starter: Starter, formatKey: FormatKey): boolean {
  if (!starter.formatKey) {
    return true;
  }
  return starter.formatKey === formatKey || (starter.formatKey === 'manga-B5' && formatKey === 'manga-A5');
}

type StarterStore = Pick<ChapterActions, 'updateChapter'> &
  Pick<SceneActions, 'addScene'> & {
    addPage: (chapterId: ID, init?: { templateId?: string }) => ID;
    projects: Record<ID, Project>;
  };

/** Fills the first chapter of a story that was just created. Returns the ids of the pages it added. */
export function applyStarter(story: () => StarterStore, projectId: ID, starter: Starter): ID[] {
  const project = story().projects[projectId];
  const chapterId = project ? chapterIdsOf(project)[0] : undefined;
  if (!chapterId || starter.key === 'blank') {
    return [];
  }
  story().updateChapter(chapterId, { summary: t(starter.summary), goal: t(starter.goal) });
  for (const beat of starter.beats) {
    story().addScene(chapterId, {
      description: t('{scene}. {note}', { scene: t(beat.scene), note: t(beat.note) }),
    });
  }
  return starter.pages.map(templateId => story().addPage(chapterId, { templateId }));
}
