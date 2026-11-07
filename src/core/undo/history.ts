import type { RowPatch, UndoScope } from '../ports';

export type HistoryEntry = { patches: RowPatch[]; coalesceKey?: string };

export type HistoryStack = { past: HistoryEntry[]; future: HistoryEntry[] };

export type History = Partial<Record<UndoScope, HistoryStack>>;

const EMPTY_STACK: HistoryStack = { past: [], future: [] };

export function limitOf(scope: UndoScope): number {
  return scope.startsWith('project:') ? 20 : 50;
}

export function stackOf(history: History, scope: UndoScope): HistoryStack {
  return history[scope] ?? EMPTY_STACK;
}

function merge(first: HistoryEntry, second: HistoryEntry): HistoryEntry {
  const rows = new Map<string, RowPatch>();
  for (const patch of [...first.patches, ...second.patches]) {
    const key = `${patch.table}:${patch.id}`;
    const seen = rows.get(key);
    rows.set(key, seen ? { ...seen, after: patch.after } : patch);
  }
  return { patches: [...rows.values()], coalesceKey: second.coalesceKey };
}

export function pushEntry(history: History, scope: UndoScope, entry: HistoryEntry): History {
  const { past } = stackOf(history, scope);
  const last = past[past.length - 1];
  const next =
    last && entry.coalesceKey && last.coalesceKey === entry.coalesceKey
      ? [...past.slice(0, -1), merge(last, entry)]
      : [...past, entry].slice(-limitOf(scope));
  return { ...history, [scope]: { past: next, future: [] } };
}

export function takeUndo(history: History, scope: UndoScope): { history: History; entry: HistoryEntry } | null {
  const { past, future } = stackOf(history, scope);
  const entry = past[past.length - 1];
  if (!entry) {
    return null;
  }
  return { entry, history: { ...history, [scope]: { past: past.slice(0, -1), future: [...future, entry] } } };
}

export function takeRedo(history: History, scope: UndoScope): { history: History; entry: HistoryEntry } | null {
  const { past, future } = stackOf(history, scope);
  const entry = future[future.length - 1];
  if (!entry) {
    return null;
  }
  return { entry, history: { ...history, [scope]: { past: [...past, entry], future: future.slice(0, -1) } } };
}

export function clearScopes(history: History, scopes: UndoScope[]): History {
  const next = { ...history };
  scopes.forEach(scope => delete next[scope]);
  return next;
}
