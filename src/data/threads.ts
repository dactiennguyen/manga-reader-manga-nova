import type { Conversation } from '../core/assistant/conversations';
import type { Db } from '../core/ports';

export function createThreadRepo(db: Db) {
  return {
    load: () => db.query('SELECT doc FROM assistant_threads').map(row => JSON.parse(row.doc as string) as Conversation),
    save: (conversation: Conversation) =>
      db.run(
        `INSERT INTO assistant_threads (id, project_id, doc, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at`,
        [conversation.id, conversation.projectKey, JSON.stringify(conversation), conversation.updatedAt],
      ),
    remove: (id: string) => db.run('DELETE FROM assistant_threads WHERE id = ?', [id]),
  };
}
