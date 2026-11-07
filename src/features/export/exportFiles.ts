import {
  addExportRecord,
  exportHistoryKey,
  parseExportHistory,
  removeExportRecord,
  type ExportRecord,
} from '../../core/export/history';
import type { ID } from '../../core/model/types';
import { DIRS, RNFS, ensureDirs, removeFile } from '../../native/files';
import { metaStore } from '../../state/useSettings';

/** One folder per story, so everything a story exported can leave with it. */
function projectExportDir(projectId: ID): string {
  return `${DIRS.exports}/${projectId}`;
}

export async function ensureProjectExportDir(projectId: ID): Promise<string> {
  await ensureDirs();
  const dir = projectExportDir(projectId);
  await RNFS.mkdir(dir);
  return dir;
}

export function readExportHistory(projectId: ID): ExportRecord[] {
  return parseExportHistory(metaStore()?.get(exportHistoryKey(projectId)));
}

function writeExportHistory(projectId: ID, history: ExportRecord[]): ExportRecord[] {
  metaStore()?.set(exportHistoryKey(projectId), JSON.stringify(history));
  return history;
}

export function recordExport(projectId: ID, record: ExportRecord): ExportRecord[] {
  return writeExportHistory(projectId, addExportRecord(readExportHistory(projectId), record));
}

/** A file that is already gone only loses its row. */
export async function deleteExport(projectId: ID, path: string): Promise<ExportRecord[]> {
  await removeFile(path);
  return writeExportHistory(projectId, removeExportRecord(readExportHistory(projectId), path));
}

/** For when a story is deleted for good: its folder and its history go together. */
export async function removeProjectExports(projectId: ID): Promise<void> {
  await removeFile(projectExportDir(projectId));
  metaStore()?.remove(exportHistoryKey(projectId));
}
