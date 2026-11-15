import type { Db } from '../core/ports';
import type { RefBoard, RefImage } from '../core/refBoards/model';
import type { RefBoardRepo } from '../core/refBoards/port';

function parse<T>(doc: unknown): T | null {
  try {
    return JSON.parse(doc as string) as T;
  } catch {
    return null;
  }
}

export function createRefBoardRepo(db: Db): RefBoardRepo {
  const putImage = (image: RefImage) =>
    db.run(
      `INSERT INTO ref_images (id, board_id, pos, doc, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET board_id = excluded.board_id, pos = excluded.pos, doc = excluded.doc,
       updated_at = excluded.updated_at`,
      [image.id, image.boardId, image.pos, JSON.stringify(image), image.updatedAt],
    );
  return {
    loadAll: () => {
      const boards = db
        .query('SELECT doc FROM ref_boards')
        .map(row => parse<RefBoard>(row.doc))
        .filter((board): board is RefBoard => !!board);
      const images = db
        .query('SELECT doc FROM ref_images ORDER BY board_id, pos')
        .map(row => parse<RefImage>(row.doc))
        .filter((image): image is RefImage => !!image);
      return { boards, images };
    },
    putBoard: board =>
      db.run(
        `INSERT INTO ref_boards (id, project_id, character_id, doc, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, character_id = excluded.character_id,
         doc = excluded.doc, updated_at = excluded.updated_at`,
        [board.id, board.projectId ?? null, board.characterId ?? null, JSON.stringify(board), board.updatedAt],
      ),
    removeBoard: id =>
      db.transaction(() => {
        db.run('DELETE FROM ref_images WHERE board_id = ?', [id]);
        db.run('DELETE FROM ref_boards WHERE id = ?', [id]);
      }),
    putImages: images => db.transaction(() => images.forEach(putImage)),
    removeImage: id => db.run('DELETE FROM ref_images WHERE id = ?', [id]),
  };
}
