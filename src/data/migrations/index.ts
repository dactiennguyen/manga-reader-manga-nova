import type { Db } from '../../core/ports';

export type Migration = { version: number; up: (db: Db) => void };

const documentTable = (name: string, parent: string, parentTable: string) => `
  CREATE TABLE ${name} (
    id          TEXT PRIMARY KEY,
    ${parent}   TEXT NOT NULL REFERENCES ${parentTable}(id) DEFERRABLE INITIALLY DEFERRED,
    doc         TEXT NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
  )`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: db => {
      db.run(`CREATE TABLE projects (
        id TEXT PRIMARY KEY, doc TEXT NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
      )`);
      db.run(documentTable('chapters', 'project_id', 'projects'));
      db.run(documentTable('scenes', 'chapter_id', 'chapters'));
      db.run(documentTable('characters', 'project_id', 'projects'));
      db.run(documentTable('relations', 'project_id', 'projects'));
      db.run(documentTable('world_entries', 'project_id', 'projects'));
      db.run(`CREATE TABLE pages (
        id          TEXT PRIMARY KEY,
        chapter_id  TEXT NOT NULL REFERENCES chapters(id) DEFERRABLE INITIALLY DEFERRED,
        doc         TEXT NOT NULL,
        art_rev     INTEGER NOT NULL DEFAULT 0,
        updated_at  INTEGER NOT NULL,
        deleted_at  INTEGER
      )`);
      db.run(`CREATE TABLE art_panels (
        panel_id         TEXT PRIMARY KEY,
        active_layer_id  TEXT,
        deleted_at       INTEGER
      )`);
      db.run(`CREATE TABLE art_layers (
        id         TEXT PRIMARY KEY,
        panel_id   TEXT NOT NULL REFERENCES art_panels(panel_id) DEFERRABLE INITIALLY DEFERRED,
        pos        INTEGER NOT NULL,
        name       TEXT NOT NULL,
        visible    INTEGER NOT NULL,
        opacity    REAL NOT NULL,
        locked     INTEGER NOT NULL,
        image      TEXT,
        gen        INTEGER NOT NULL DEFAULT 0,
        head       INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER
      )`);
      db.run(`CREATE TABLE strokes (
        id        INTEGER PRIMARY KEY,
        layer_id  TEXT NOT NULL REFERENCES art_layers(id) DEFERRABLE INITIALLY DEFERRED,
        gen       INTEGER NOT NULL,
        seq       INTEGER NOT NULL,
        tool      TEXT NOT NULL,
        color     TEXT NOT NULL,
        size      REAL NOT NULL,
        opacity   REAL NOT NULL,
        flags     INTEGER NOT NULL,
        tone      REAL,
        codec     INTEGER NOT NULL DEFAULT 1,
        points    BLOB NOT NULL,
        UNIQUE (layer_id, gen, seq)
      )`);
      db.run('CREATE INDEX idx_chapters_project ON chapters(project_id)');
      db.run('CREATE INDEX idx_scenes_chapter ON scenes(chapter_id)');
      db.run('CREATE INDEX idx_pages_chapter ON pages(chapter_id)');
      db.run('CREATE INDEX idx_layers_panel ON art_layers(panel_id)');
      db.run(`CREATE TABLE script_versions (
        id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, doc TEXT NOT NULL, created_at INTEGER NOT NULL
      )`);
      db.run('CREATE INDEX idx_versions_chapter ON script_versions(chapter_id, created_at)');
      db.run(`CREATE TABLE assistant_threads (
        id TEXT PRIMARY KEY, project_id TEXT, doc TEXT NOT NULL, updated_at INTEGER NOT NULL
      )`);
      db.run('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    },
  },
];

export function userVersion(db: Db): number {
  return Number(db.query('PRAGMA user_version')[0]?.user_version ?? 0);
}

/** Each step commits alone, so a failure leaves the file at the last good version. */
export function migrate(db: Db, migrations: Migration[] = MIGRATIONS): number {
  let current = userVersion(db);
  for (const migration of migrations) {
    if (migration.version <= current) {
      continue;
    }
    db.transaction(() => {
      migration.up(db);
      db.run(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
  return current;
}

export function pendingMigrations(db: Db, migrations: Migration[] = MIGRATIONS): number {
  const current = userVersion(db);
  return migrations.filter(migration => migration.version > current).length;
}
