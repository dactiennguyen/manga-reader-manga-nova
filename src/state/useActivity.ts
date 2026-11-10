import { create } from 'zustand';

import { EMPTY_ACTIVITY, addStrokes, parseActivity, type Activity } from '../core/story/activity';
import type { MetaRepo } from '../core/ports';
import { dayKey } from '../core/util/time';

const KEY = 'activity';
const SAVE_DELAY_MS = 3000;

let repo: MetaRepo | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useActivity = create<Activity>()(() => EMPTY_ACTIVITY);

export function connectActivity(next: MetaRepo | null): void {
  repo = next;
  useActivity.setState(parseActivity(next?.get(KEY)), true);
}

/** Writes now. Called when the app goes to the background, so a count is never lost to the delay. */
export function flushActivity(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    repo?.set(KEY, JSON.stringify(useActivity.getState()));
  }
}

/** Counts strokes for today. Saving is delayed, because this runs on every pen lift. */
export function noteStrokes(count: number): void {
  useActivity.setState(addStrokes(useActivity.getState(), dayKey(), count), true);
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      repo?.set(KEY, JSON.stringify(useActivity.getState()));
    }, SAVE_DELAY_MS);
  }
}
