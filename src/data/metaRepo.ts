import type { Db, MetaRepo } from '../core/ports';

export function createMetaRepo(db: Db): MetaRepo {
  return {
    get: key => (db.query('SELECT value FROM meta WHERE key = ?', [key])[0]?.value as string | undefined) ?? null,
    set: (key, value) =>
      db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        value,
      ]),
    remove: key => db.run('DELETE FROM meta WHERE key = ?', [key]),
  };
}
