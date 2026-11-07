import { LIMITS } from '../core/model/constants';
import type { ID } from '../core/model/types';
import type { Db } from '../core/ports';
import type { ScriptVersion, ScriptVersionRepo } from '../state/scriptHistory';
import { uid } from '../core/util/id';

export function createScriptVersionRepo(db: Db): ScriptVersionRepo {
  return {
    list: (chapterId: ID) =>
      db
        .query('SELECT doc FROM script_versions WHERE chapter_id = ? ORDER BY created_at DESC', [chapterId])
        .map(row => JSON.parse(row.doc as string) as ScriptVersion),
    add: (chapterId: ID, version: ScriptVersion) =>
      db.transaction(() => {
        db.run('INSERT INTO script_versions (id, chapter_id, doc, created_at) VALUES (?, ?, ?, ?)', [
          uid(),
          chapterId,
          JSON.stringify(version),
          version.at,
        ]);
        db.run(
          `DELETE FROM script_versions WHERE chapter_id = ? AND id NOT IN (
             SELECT id FROM script_versions WHERE chapter_id = ? ORDER BY created_at DESC LIMIT ?
           )`,
          [chapterId, chapterId, LIMITS.scriptVersions],
        );
      }),
    clear: (chapterId: ID) => db.run('DELETE FROM script_versions WHERE chapter_id = ?', [chapterId]),
  };
}
