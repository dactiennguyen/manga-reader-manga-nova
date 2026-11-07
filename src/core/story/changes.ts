import type { RowPatch, TableName, UndoScope } from '../ports';
import type { Chapter, ID, Page, Scene, StoryData } from '../model/types';

export const TABLES: TableName[] = ['projects', 'chapters', 'scenes', 'characters', 'relations', 'world', 'pages'];

/** Actions keep untouched rows by reference, so comparing references finds exactly the dirty rows. */
export function diffStory(before: StoryData, after: StoryData): RowPatch[] {
  const patches: RowPatch[] = [];
  for (const table of TABLES) {
    const a = before[table] as Record<ID, unknown>;
    const b = after[table] as Record<ID, unknown>;
    if (a === b) {
      continue;
    }
    for (const id of Object.keys(b)) {
      if (a[id] !== b[id]) {
        patches.push({ table, id, before: a[id] ?? null, after: b[id] });
      }
    }
    for (const id of Object.keys(a)) {
      if (!(id in b)) {
        patches.push({ table, id, before: a[id], after: null });
      }
    }
  }
  return patches;
}

export function applyPatches(state: StoryData, patches: RowPatch[], side: 'before' | 'after'): StoryData {
  const next: StoryData = { ...state };
  const copied = new Set<TableName>();
  for (const patch of patches) {
    if (!copied.has(patch.table)) {
      (next[patch.table] as Record<ID, unknown>) = { ...next[patch.table] };
      copied.add(patch.table);
    }
    const table = next[patch.table] as Record<ID, unknown>;
    const row = patch[side];
    if (row === null) {
      delete table[patch.id];
    } else {
      table[patch.id] = mergeRow(table[patch.id], patch, row);
    }
  }
  return next;
}

/**
 * Applies only the fields this patch changed. One row can belong to two undo scopes: a chapter's
 * sceneIds are script history and its pageIds are project history, so writing the whole snapshot
 * back would erase what the other scope did since.
 */
function mergeRow(current: unknown, patch: RowPatch, row: unknown): unknown {
  if (current === undefined || patch.before === null || patch.after === null) {
    return row;
  }
  const before = patch.before as Record<string, unknown>;
  const after = patch.after as Record<string, unknown>;
  const source = row as Record<string, unknown>;
  const merged = { ...(current as Record<string, unknown>) };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key]) {
      if (key in source) {
        merged[key] = source[key];
      } else {
        delete merged[key];
      }
    }
  }
  return merged;
}

const NOISE = new Set(['updatedAt', 'scriptChangedAt']);

function sameIgnoringNoise(a: unknown, b: unknown): boolean {
  if (a === null || b === null) {
    return false;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!NOISE.has(key) && left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

/** Timestamps are not history. A row that only got a new timestamp stays out of the undo entry. */
export function undoablePatches(patches: RowPatch[]): RowPatch[] {
  return patches.filter(patch => !sameIgnoringNoise(patch.before, patch.after));
}

export function projectsTouched(state: StoryData, patches: RowPatch[]): ID[] {
  const ids = new Set<ID>();
  const ofChapter = (chapterId: ID | undefined) => {
    const projectId = chapterId ? state.chapters[chapterId]?.projectId : undefined;
    if (projectId) {
      ids.add(projectId);
    }
  };
  for (const patch of patches) {
    const row = (patch.after ?? patch.before) as Record<string, unknown>;
    if (patch.table === 'projects') {
      continue;
    }
    if (patch.table === 'chapters' || patch.table === 'characters' || patch.table === 'relations' || patch.table === 'world') {
      ids.add(row.projectId as ID);
    } else {
      ofChapter(row.chapterId as ID);
    }
  }
  return [...ids];
}

/** Scopes whose rows this change also wrote. Their history no longer matches, so it is cleared. */
export function scopesOf(patches: RowPatch[]): UndoScope[] {
  const scopes = new Set<UndoScope>();
  for (const patch of patches) {
    const row = (patch.after ?? patch.before) as Page & Scene & Chapter;
    if (patch.table === 'scenes') {
      scopes.add(`script:${row.chapterId}`);
    } else if (patch.table === 'pages') {
      scopes.add(`page:${patch.id}`);
    }
  }
  return [...scopes];
}
