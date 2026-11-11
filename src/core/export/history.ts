import { z } from 'zod';

import type { ID } from '../model/types';

export const EXPORT_HISTORY_LIMIT = 5;

const recordSchema = z.object({
  path: z.string(),
  fileName: z.string(),
  mime: z.string(),
  size: z.number(),
  pages: z.number(),
  format: z.enum(['png', 'pdf', 'cbz', 'long', 'social']),
  createdAt: z.number(),
});

/** `path` is stored relative to the files root, like every other path in the app. */
export type ExportRecord = z.infer<typeof recordSchema>;

export function exportHistoryKey(projectId: ID): string {
  return `exports:${projectId}`;
}

/** A damaged history only costs the list. It must never stop the screen from opening. */
export function parseExportHistory(raw: string | null | undefined): ExportRecord[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = z.array(recordSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function addExportRecord(history: readonly ExportRecord[], record: ExportRecord): ExportRecord[] {
  return [record, ...history.filter(item => item.path !== record.path)].slice(0, EXPORT_HISTORY_LIMIT);
}

export function removeExportRecord(history: readonly ExportRecord[], path: string): ExportRecord[] {
  return history.filter(item => item.path !== path);
}
