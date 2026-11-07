import type { Db, RowPatch, StoryRepo, TableName } from '../core/ports';
import type { ID, StoryData } from '../core/model/types';
import { EMPTY_STORY } from '../core/story/actions';
import { TABLES } from '../core/story/changes';

type TableSpec = { name: string; parent?: { column: string; field: string } };

const SPECS: Record<TableName, TableSpec> = {
  projects: { name: 'projects' },
  chapters: { name: 'chapters', parent: { column: 'project_id', field: 'projectId' } },
  scenes: { name: 'scenes', parent: { column: 'chapter_id', field: 'chapterId' } },
  characters: { name: 'characters', parent: { column: 'project_id', field: 'projectId' } },
  relations: { name: 'relations', parent: { column: 'project_id', field: 'projectId' } },
  world: { name: 'world_entries', parent: { column: 'project_id', field: 'projectId' } },
  pages: { name: 'pages', parent: { column: 'chapter_id', field: 'chapterId' } },
};

export function createStoryRepo(db: Db, now: () => number = Date.now): StoryRepo {
  const write = (patch: RowPatch) => {
    const spec = SPECS[patch.table];
    const time = now();
    if (patch.after === null) {
      db.run(`UPDATE ${spec.name} SET deleted_at = ? WHERE id = ?`, [time, patch.id]);
      return;
    }
    const row = patch.after as Record<string, unknown>;
    const doc = JSON.stringify(row);
    if (spec.parent) {
      db.run(
        `INSERT INTO ${spec.name} (id, ${spec.parent.column}, doc, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at, deleted_at = NULL`,
        [patch.id, row[spec.parent.field] as string, doc, time],
      );
    } else {
      db.run(
        `INSERT INTO ${spec.name} (id, doc, updated_at, deleted_at) VALUES (?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at, deleted_at = NULL`,
        [patch.id, doc, time],
      );
    }
  };

  return {
    loadAll() {
      const data: StoryData = { ...EMPTY_STORY };
      for (const table of TABLES) {
        const rows: Record<ID, unknown> = {};
        for (const row of db.query(`SELECT id, doc FROM ${SPECS[table].name} WHERE deleted_at IS NULL`)) {
          rows[row.id as string] = JSON.parse(row.doc as string);
        }
        (data[table] as Record<ID, unknown>) = rows;
      }
      return data;
    },
    apply(patches) {
      if (patches.length) {
        db.transaction(() => patches.forEach(write));
      }
    },
  };
}
