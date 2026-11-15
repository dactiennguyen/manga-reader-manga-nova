import { create } from 'zustand';

import type { MetaRepo } from '../core/ports';
import {
  EMPTY_PROGRESS,
  addGains,
  hasGains,
  parseProgress,
  progressSnapshot,
  progressStep,
  startProgress,
  type ProgressLog,
  type ProgressSnapshot,
} from '../core/stats/progress';
import { noteSessionStrokes, parseSessions, pruneSessions, type DrawSession } from '../core/stats/sessions';
import type { StoryData } from '../core/model/types';
import { dayKey } from '../core/util/time';

/** The story store, passed in so this file does not import it: the story store reaches the activity, which reaches this. */
type StorySource = { getState: () => StoryData; subscribe: (listener: (state: StoryData) => void) => () => void };

const PROGRESS_KEY = 'statsProgress';
const SESSIONS_KEY = 'drawSessions';
/** Story changes come in bursts while typing or dragging, so they are compared after a pause. */
const STEP_DELAY_MS = 2000;
/** Sessions grow with every pen lift, so the log is written at most this often, and when the app leaves. */
const SAVE_DELAY_MS = 15000;

/** What the statistics record from now on: progress per day and drawing sessions. */
export type StatsLog = { progress: ProgressLog; sessions: DrawSession[] };

export const useStats = create<StatsLog>()(() => ({ progress: EMPTY_PROGRESS, sessions: [] }));

let repo: MetaRepo | null = null;
let snapshot: ProgressSnapshot | null = null;
let stepTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let source: StorySource | null = null;

function save(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const { progress, sessions } = useStats.getState();
  repo?.set(PROGRESS_KEY, JSON.stringify(progress));
  repo?.set(SESSIONS_KEY, JSON.stringify(sessions));
}

function saveLater(): void {
  if (repo && !saveTimer) {
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  }
}

/** Compares the stories with the last look and adds what grew to today. */
function step(): void {
  if (stepTimer) {
    clearTimeout(stepTimer);
    stepTimer = null;
  }
  if (!snapshot || !source) {
    return;
  }
  const result = progressStep(snapshot, source.getState());
  snapshot = result.snapshot;
  if (hasGains(result.gains)) {
    useStats.setState(state => ({ progress: addGains(state.progress, dayKey(), result.gains) }));
    saveLater();
  }
}

/**
 * Loads the log and starts watching the stories. Call after connectStory, so the stories already loaded
 * are the baseline and nothing in them counts as made today.
 */
export function connectStats(next: MetaRepo | null, story: StorySource | null): void {
  unsubscribe?.();
  unsubscribe = null;
  repo = next;
  source = story;
  const progress = startProgress(parseProgress(next?.get(PROGRESS_KEY)), dayKey());
  const sessions = pruneSessions(parseSessions(next?.get(SESSIONS_KEY)), Date.now());
  useStats.setState({ progress, sessions }, true);
  if (next && !next.get(PROGRESS_KEY)) {
    next.set(PROGRESS_KEY, JSON.stringify(progress));
  }
  if (!next || !story) {
    snapshot = null;
    return;
  }
  const state = story.getState();
  snapshot = progressSnapshot(state);
  let last = { projects: state.projects, chapters: state.chapters, scenes: state.scenes, pages: state.pages };
  unsubscribe = story.subscribe(current => {
    if (
      current.projects === last.projects &&
      current.chapters === last.chapters &&
      current.scenes === last.scenes &&
      current.pages === last.pages
    ) {
      return;
    }
    last = { projects: current.projects, chapters: current.chapters, scenes: current.scenes, pages: current.pages };
    if (!stepTimer) {
      stepTimer = setTimeout(step, STEP_DELAY_MS);
    }
  });
}

/** Counts strokes into the current drawing session. Called with every pen lift, next to the activity. */
export function noteSessionStrokesNow(count: number): void {
  const sessions = useStats.getState().sessions;
  const next = noteSessionStrokes(sessions, Date.now(), count);
  if (next !== sessions) {
    useStats.setState({ sessions: next });
    saveLater();
  }
}

/** Writes now. Called when the app goes to the background. */
export function flushStats(): void {
  if (stepTimer) {
    step();
  }
  if (saveTimer) {
    save();
  }
}
