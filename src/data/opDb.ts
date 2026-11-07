import { open, type DB } from '@op-engineering/op-sqlite';

import type { Db, DbRow, DbValue } from '../core/ports';

export function wrapDb(raw: DB): Db {
  let depth = 0;
  return {
    query: (sql, params = []) => raw.executeSync(sql, params as never).rows as unknown as DbRow[],
    run: (sql, params: DbValue[] = []) => {
      raw.executeSync(sql, params as never);
    },
    transaction: work => {
      if (depth > 0) {
        return work();
      }
      depth++;
      raw.executeSync('BEGIN');
      try {
        const result = work();
        raw.executeSync('COMMIT');
        return result;
      } catch (error) {
        raw.executeSync('ROLLBACK');
        throw error;
      } finally {
        depth--;
      }
    },
  };
}

export function openRaw(name: string, location: string): DB {
  const raw = open({ name, location });
  raw.executeSync('PRAGMA journal_mode = WAL');
  raw.executeSync('PRAGMA synchronous = NORMAL');
  raw.executeSync('PRAGMA foreign_keys = ON');
  raw.executeSync('PRAGMA auto_vacuum = INCREMENTAL');
  return raw;
}
