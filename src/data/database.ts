import { DIRS, RNFS, ensureDirs } from '../native/files';
import type { Db } from '../core/ports';
import { migrate, pendingMigrations } from './migrations';
import { openRaw, wrapDb } from './opDb';

const DB_NAME = 'manganova.db';
const BACKUPS_KEPT = 2;

async function backup(): Promise<string | null> {
  const source = `${DIRS.root}/${DB_NAME}`;
  if (!(await RNFS.exists(source))) {
    return null;
  }
  const target = `${DIRS.backups}/${DB_NAME}.${Date.now()}`;
  await RNFS.copyFile(source, target);
  const entries = (await RNFS.readDir(DIRS.backups)).sort((a, b) => b.name.localeCompare(a.name));
  await Promise.all(entries.slice(BACKUPS_KEPT).map(entry => RNFS.unlink(entry.path)));
  return target;
}

/** Copies the file aside before migrating, and puts it back if a step fails. */
export async function openDatabase(): Promise<Db> {
  await ensureDirs();
  let raw = openRaw(DB_NAME, DIRS.root);
  let db = wrapDb(raw);
  if (!pendingMigrations(db)) {
    return db;
  }
  raw.executeSync('PRAGMA wal_checkpoint(TRUNCATE)');
  raw.close();
  const saved = await backup();
  raw = openRaw(DB_NAME, DIRS.root);
  db = wrapDb(raw);
  try {
    migrate(db);
    return db;
  } catch (error) {
    raw.close();
    if (saved) {
      await RNFS.copyFile(saved, `${DIRS.root}/${DB_NAME}`);
    }
    throw error;
  }
}
