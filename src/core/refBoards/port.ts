import type { ID } from '../model/types';
import type { RefBoard, RefImage } from './model';

/** Where boards are saved. Synchronous, like the rest of the database. */
export interface RefBoardRepo {
  loadAll(): { boards: RefBoard[]; images: RefImage[] };
  putBoard(board: RefBoard): void;
  /** Removes the board and every picture row on it, in one transaction. */
  removeBoard(id: ID): void;
  /** Writes several pictures in one transaction. */
  putImages(images: RefImage[]): void;
  removeImage(id: ID): void;
}

/** The board files. Kept apart from `images/` so a clean-up of that folder can never take them. */
export interface RefFiles {
  /** Moves a file that is already in the files root into the board's folder; resolves with the new path. */
  adopt(path: string, boardId: ID): Promise<string>;
  remove(path: string): Promise<void>;
  /** Removes the board's whole folder. */
  removeBoard(boardId: ID): Promise<void>;
}
