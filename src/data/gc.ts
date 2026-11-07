import type { Db } from '../core/ports';
import { LIMITS } from '../core/model/constants';
import type { StoryData } from '../core/model/types';

const DAY = 24 * 60 * 60 * 1000;
const SOFT_DELETE_DAYS = 7;

export type GcReport = {
  orphanPanels: string[];
  expiredRows: number;
  staleStrokes: number;
  expiredProjects: string[];
};

/**
 * Finds what would be removed. Until phase 7 of the roadmap this only reports: removing art in use
 * is the worst failure this design can have.
 */
export function collectGarbage(db: Db, data: StoryData, now: number, dryRun = true): GcReport {
  const live = new Set<string>();
  Object.values(data.pages).forEach(page => Object.keys(page.panels).forEach(id => live.add(id)));
  const orphanPanels = db
    .query('SELECT panel_id FROM art_panels WHERE deleted_at IS NULL')
    .map(row => row.panel_id as string)
    .filter(id => !live.has(id));
  const expiredProjects = Object.values(data.projects)
    .filter(project => project.deletedAt && now - project.deletedAt > LIMITS.trashDays * DAY)
    .map(project => project.id);
  const cutoff = now - SOFT_DELETE_DAYS * DAY;
  const tables = ['chapters', 'scenes', 'characters', 'relations', 'world_entries', 'pages'];
  const expiredRows = tables.reduce(
    (sum, table) =>
      sum + Number(db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at < ?`, [cutoff])[0]?.n ?? 0),
    0,
  );
  const staleStrokes = Number(
    db.query(
      `SELECT COUNT(*) AS n FROM strokes s JOIN art_layers l ON l.id = s.layer_id
       WHERE s.gen <> l.gen OR s.seq >= l.head`,
    )[0]?.n ?? 0,
  );
  if (!dryRun) {
    throw new Error('Real collection stays off until phase 7.');
  }
  return { orphanPanels, expiredRows, staleStrokes, expiredProjects };
}
