import { create } from 'zustand';

import type { ChangeSet, RowPatch, StoryRepo, UndoScope } from '../core/ports';
import type { ID, Project, StoryData } from '../core/model/types';
import { EMPTY_STORY, createStoryActions, type StoryActions } from '../core/story/actions';
import { TABLES, applyPatches, diffStory, projectsTouched, scopesOf, undoablePatches } from '../core/story/changes';
import { NO_TOUCH, metaOf, type ActionMeta, type ActionName } from '../core/story/scopes';
import { clearScopes, pushEntry, stackOf, takeRedo, takeUndo, type History } from '../core/undo/history';
import { copyArt, exportArt, saveArt } from './artStore';

export type { StoryData } from '../core/model/types';
export type { NewProjectInput, SceneInit } from '../core/story/actions';

export type StoryState = StoryData & StoryActions;

const TYPING_DELAY_MS = 500;

const REWRITES_OTHER_SCOPES = new Set<ActionName>(['removeCharacter', 'renameLanguage', 'removeLanguage']);

let repo: StoryRepo | null = null;
let onWriteError: (error: unknown) => void = () => {};
let onProjectDeleted: (projectId: ID) => void = () => {};

/** Rows waiting for disk. Failed writes stay here and go out with the next flush. */
const dirty = new Map<string, RowPatch>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function flushStory(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!repo || !dirty.size) {
    return;
  }
  try {
    repo.apply([...dirty.values()]);
    dirty.clear();
  } catch (error) {
    onWriteError(error);
  }
}

function enqueue(patches: RowPatch[], typing: boolean): void {
  if (!repo) {
    return;
  }
  for (const patch of patches) {
    const key = `${patch.table}:${patch.id}`;
    const seen = dirty.get(key);
    dirty.set(key, seen ? { ...seen, after: patch.after } : patch);
  }
  if (!typing) {
    flushStory();
  } else if (!timer) {
    timer = setTimeout(flushStory, TYPING_DELAY_MS);
  }
}

export const useHistory = create<{ history: History }>(() => ({ history: {} }));

function dataOf(state: StoryData): StoryData {
  const { projects, chapters, scenes, characters, relations, world, pages } = state;
  return { projects, chapters, scenes, characters, relations, world, pages };
}

function touch(state: StoryData, patches: RowPatch[]): Partial<StoryData> | null {
  const ids = projectsTouched(state, patches).filter(id => state.projects[id]);
  if (!ids.length) {
    return null;
  }
  const now = Date.now();
  const projects: Record<ID, Project> = { ...state.projects };
  ids.forEach(id => {
    projects[id] = { ...projects[id], updatedAt: now };
  });
  return { projects };
}

function commit(base: StoryData, meta: ActionMeta, action: ActionName | null): void {
  const current = dataOf(useStory.getState());
  const edits = diffStory(base, current);
  if (!edits.length) {
    return;
  }
  const touched = action && NO_TOUCH.has(action) ? null : touch(current, edits);
  if (touched) {
    useStory.setState(touched);
  }
  const change: ChangeSet = {
    patches: touched ? diffStory(base, dataOf(useStory.getState())) : edits,
    undoScope: meta.undoScope,
    coalesceKey: meta.coalesceKey,
  };
  enqueue(change.patches, !!meta.typing);
  // Read from the action's own patches: connectStory also swaps the whole state, and that deletes nothing.
  change.patches
    .filter(patch => patch.table === 'projects' && patch.after === null)
    .forEach(patch => onProjectDeleted(patch.id));
  const scope = change.undoScope;
  if (!scope) {
    return;
  }
  const entry = undoablePatches(change.patches);
  if (!entry.length) {
    return;
  }
  const others = scopesOf(entry).filter(item => item !== scope);
  const history = pushEntry(useHistory.getState().history, scope, {
    patches: entry,
    coalesceKey: change.coalesceKey,
  });
  // Most project-level changes leave page and script rows as they were. These rewrite them in place.
  const crossScope = action && REWRITES_OTHER_SCOPES.has(action) ? others : [];
  useHistory.setState({ history: clearScopes(history, crossScope) });
}

let depth = 0;
let base: StoryData | null = null;
let forced: ActionMeta | null = null;
let outerMeta: ActionMeta = {};
let outerAction: ActionName | null = null;

function transact<R>(action: ActionName | null, meta: ActionMeta, work: () => R): R {
  if (depth === 0) {
    base = dataOf(useStory.getState());
    outerMeta = forced ?? meta;
    outerAction = action;
  }
  depth++;
  try {
    return work();
  } finally {
    depth--;
    if (depth === 0) {
      const start = base as StoryData;
      base = null;
      commit(start, outerMeta, outerAction);
    }
  }
}

/** Groups several actions into one undo step, or files them under a chosen scope. */
export function undoable<R>(meta: ActionMeta, work: () => R): R {
  forced = meta;
  try {
    return transact(null, meta, work);
  } finally {
    forced = null;
  }
}

export const useStory = create<StoryState>()((set, get) => {
  const raw = createStoryActions(
    change => set(state => change(state)),
    () => get(),
    { copyArt, saveArt, exportArt },
  );
  const wrapped = {} as Record<string, unknown>;
  for (const name of Object.keys(raw) as ActionName[]) {
    const run = raw[name] as (...args: unknown[]) => unknown;
    wrapped[name] = (...args: unknown[]) => transact(name, metaOf(get(), name, args), () => run(...args));
  }
  return { ...EMPTY_STORY, ...(wrapped as StoryActions) };
});

function step(scope: UndoScope, side: 'before' | 'after'): boolean {
  const taken = (side === 'before' ? takeUndo : takeRedo)(useHistory.getState().history, scope);
  if (!taken) {
    return false;
  }
  const state = dataOf(useStory.getState());
  const next = applyPatches(state, taken.entry.patches, side);
  const now = Date.now();
  for (const patch of taken.entry.patches) {
    const page = patch.table === 'pages' ? next.pages[patch.id] : undefined;
    if (page) {
      // Art revisions move forward only, or thumbnails would keep a stale image.
      next.pages[patch.id] = { ...page, artRev: state.pages[patch.id]?.artRev ?? page.artRev, updatedAt: now };
    }
  }
  useStory.setState(next);
  useHistory.setState({ history: taken.history });
  enqueue(diffStory(state, next), false);
  return true;
}

/**
 * Adds a whole story in one transaction, disk first. If the write fails it throws and memory stays as
 * it was, so a bad file cannot sit in the write queue and block every later save.
 */
export function importEntities(data: Partial<StoryData>): void {
  flushStory();
  const state = dataOf(useStory.getState());
  const next: StoryData = { ...state };
  for (const table of TABLES) {
    (next[table] as Record<ID, unknown>) = { ...state[table], ...data[table] };
  }
  repo?.apply(diffStory(state, next));
  useStory.setState(next);
}

export const undoStory = (scope: UndoScope) => step(scope, 'before');

export const redoStory = (scope: UndoScope) => step(scope, 'after');

export function useUndoState(scope: UndoScope): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useHistory(s => stackOf(s.history, scope).past.length > 0);
  const canRedo = useHistory(s => stackOf(s.history, scope).future.length > 0);
  return { canUndo, canRedo };
}

export function clearHistory(scopes: UndoScope[]): void {
  useHistory.setState({ history: clearScopes(useHistory.getState().history, scopes) });
}

export function connectStory(
  next: StoryRepo | null,
  reportError: (error: unknown) => void = () => {},
  projectDeleted: (projectId: ID) => void = () => {},
): void {
  repo = next;
  onWriteError = reportError;
  onProjectDeleted = projectDeleted;
  dirty.clear();
  useHistory.setState({ history: {} });
  useStory.setState(next ? next.loadAll() : EMPTY_STORY);
}
