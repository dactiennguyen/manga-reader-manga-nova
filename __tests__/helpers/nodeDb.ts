import type { Db, DbRow, DbValue } from '../../src/core/ports';

type Statement = { all: (...params: unknown[]) => Record<string, unknown>[]; run: (...params: unknown[]) => unknown };
type Database = { prepare: (sql: string) => Statement; exec: (sql: string) => void };

function load(): new (path: string) => Database {
  // Jest's resolver does not know node:sqlite, so ask Node directly.
  const { process } = globalThis as unknown as { process: { getBuiltinModule: (name: string) => unknown } };
  const sqlite = process.getBuiltinModule('node:sqlite');
  return (sqlite as { DatabaseSync: new (path: string) => Database }).DatabaseSync;
}

// Jest runs tests in a vm, so instanceof fails on buffers made on the other side.
const kindOf = (value: unknown) => Object.prototype.toString.call(value);

const toParam = (value: DbValue) => (kindOf(value) === '[object ArrayBuffer]' ? new Uint8Array(value as ArrayBuffer) : value);

function toRow(row: Record<string, unknown>): DbRow {
  const out: DbRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (kindOf(value) === '[object Uint8Array]') {
      const copy = new Uint8Array((value as Uint8Array).byteLength);
      copy.set(value as Uint8Array);
      out[key] = copy.buffer as ArrayBuffer;
    } else {
      out[key] = value as DbValue;
    }
  }
  return out;
}

/** The same SQL as production, on the SQLite built into Node. */
export function createNodeDb(path = ':memory:'): Db {
  const DatabaseSync = load();
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  let depth = 0;
  return {
    query: (sql, params = []) =>
      db
        .prepare(sql)
        .all(...params.map(toParam))
        .map(toRow),
    run: (sql, params = []) => {
      db.prepare(sql).run(...params.map(toParam));
    },
    transaction: work => {
      if (depth > 0) {
        return work();
      }
      depth++;
      db.exec('BEGIN');
      try {
        const result = work();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        depth--;
      }
    },
  };
}
