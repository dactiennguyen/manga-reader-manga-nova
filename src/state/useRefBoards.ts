import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { t } from '../core/i18n';
import type { ID } from '../core/model/types';
import { boardsForArchive, type RefBoardBundle } from '../core/refBoards/archive';
import {
  REF_KIND_LABEL,
  REF_LIMITS,
  cleanCaption,
  imagesOf,
  makeBoard,
  makeImage,
  moveImage as moveInOrder,
  nextPos,
  parseTags,
  patchBoard,
  type BoardInput,
  type ImageInput,
  type LinkTargets,
  type RefBoard,
  type RefImage,
} from '../core/refBoards/model';
import type { RefBoardRepo, RefFiles } from '../core/refBoards/port';
import type { RefWindowState } from '../core/refBoards/window';
import { uid } from '../core/util/id';
import { useStory } from './useStory';

export * from '../core/refBoards/model';

/** What the canvas remembers until the app closes: where the window was and what it showed. */
export type RefSession = { window: RefWindowState | null; boardId: ID | null; index: number };

type RefBoardsState = {
  boards: Record<ID, RefBoard>;
  images: Record<ID, RefImage>;
  session: RefSession;
  createBoard: (input: BoardInput) => ID;
  updateBoard: (id: ID, patch: Partial<BoardInput>) => void;
  /** Removes the rows now and the board's folder after. */
  deleteBoard: (id: ID) => void;
  /** The files must already be in the board's folder. Returns the new ids; extra pictures past the limit are dropped. */
  addImages: (boardId: ID, inputs: ImageInput[]) => ID[];
  updateImage: (id: ID, patch: { caption?: string; tags?: string | string[] }) => void;
  removeImage: (id: ID) => void;
  moveImage: (id: ID, to: number) => void;
  setSession: (patch: Partial<RefSession>) => void;
};

let repo: RefBoardRepo | null = null;
let files: RefFiles | null = null;
let onSaveError: () => void = () => {};

function save(work: (target: RefBoardRepo) => void): void {
  if (!repo) {
    return;
  }
  try {
    work(repo);
  } catch {
    onSaveError();
  }
}

function dropFile(path: string): void {
  files?.remove(path).catch(() => {});
}

const EMPTY_SESSION: RefSession = { window: null, boardId: null, index: 0 };

export const useRefBoards = create<RefBoardsState>()((set, get) => {
  /** A board moves to the top of the list whenever its pictures change. */
  const touch = (boardId: ID, now: number) => {
    const board = get().boards[boardId];
    if (!board) {
      return;
    }
    const next = { ...board, updatedAt: now };
    set(state => ({ boards: { ...state.boards, [boardId]: next } }));
    save(target => target.putBoard(next));
  };

  return {
    boards: {},
    images: {},
    session: EMPTY_SESSION,

    createBoard: input => {
      const board = makeBoard(input, uid(), Date.now(), t(REF_KIND_LABEL[input.kind] ?? REF_KIND_LABEL.other));
      set(state => ({ boards: { ...state.boards, [board.id]: board } }));
      save(target => target.putBoard(board));
      return board.id;
    },

    updateBoard: (id, patch) => {
      const board = get().boards[id];
      if (!board) {
        return;
      }
      const next = patchBoard(board, patch, Date.now());
      set(state => ({ boards: { ...state.boards, [id]: next } }));
      save(target => target.putBoard(next));
    },

    deleteBoard: id => {
      if (!get().boards[id]) {
        return;
      }
      set(state => {
        const boards = { ...state.boards };
        delete boards[id];
        const images: Record<ID, RefImage> = {};
        for (const image of Object.values(state.images)) {
          if (image.boardId !== id) {
            images[image.id] = image;
          }
        }
        const session = state.session.boardId === id ? { ...state.session, boardId: null, index: 0 } : state.session;
        return { boards, images, session };
      });
      save(target => target.removeBoard(id));
      files?.removeBoard(id).catch(() => {});
    },

    addImages: (boardId, inputs) => {
      if (!get().boards[boardId]) {
        inputs.forEach(input => dropFile(input.path));
        return [];
      }
      const current = imagesOf(get().images, boardId);
      const room = Math.max(0, REF_LIMITS.imagesPerBoard - current.length);
      inputs.slice(room).forEach(input => dropFile(input.path));
      const now = Date.now();
      let pos = nextPos(current);
      const added = inputs.slice(0, room).map(input => makeImage(boardId, input, uid(), pos++, now));
      if (!added.length) {
        return [];
      }
      set(state => {
        const images = { ...state.images };
        added.forEach(image => {
          images[image.id] = image;
        });
        return { images };
      });
      save(target => target.putImages(added));
      touch(boardId, now);
      return added.map(image => image.id);
    },

    updateImage: (id, patch) => {
      const image = get().images[id];
      if (!image) {
        return;
      }
      const next: RefImage = {
        ...image,
        caption: patch.caption === undefined ? image.caption : cleanCaption(patch.caption),
        tags: patch.tags === undefined ? image.tags : parseTags(patch.tags),
        updatedAt: Date.now(),
      };
      set(state => ({ images: { ...state.images, [id]: next } }));
      save(target => target.putImages([next]));
    },

    removeImage: id => {
      const image = get().images[id];
      if (!image) {
        return;
      }
      set(state => {
        const images = { ...state.images };
        delete images[id];
        return { images };
      });
      save(target => target.removeImage(id));
      dropFile(image.path);
      touch(image.boardId, Date.now());
    },

    moveImage: (id, to) => {
      const image = get().images[id];
      if (!image) {
        return;
      }
      const changed = moveInOrder(imagesOf(get().images, image.boardId), id, to, Date.now());
      if (!changed.length) {
        return;
      }
      set(state => {
        const images = { ...state.images };
        changed.forEach(item => {
          images[item.id] = item;
        });
        return { images };
      });
      save(target => target.putImages(changed));
    },

    setSession: patch => set(state => ({ session: { ...state.session, ...patch } })),
  };
});

export function connectRefBoards(nextRepo: RefBoardRepo | null, nextFiles: RefFiles | null = null, onError?: () => void): void {
  repo = nextRepo;
  files = nextFiles;
  onSaveError = onError ?? (() => {});
  const loaded = nextRepo?.loadAll() ?? { boards: [], images: [] };
  const boards: Record<ID, RefBoard> = {};
  loaded.boards.forEach(board => {
    boards[board.id] = board;
  });
  const images: Record<ID, RefImage> = {};
  loaded.images.forEach(image => {
    if (boards[image.boardId]) {
      images[image.id] = image;
    }
  });
  useRefBoards.setState({ boards, images, session: EMPTY_SESSION });
}

/** The boards that go into a story's `.manganova` file. */
export function exportRefBoards(projectId: ID): RefBoardBundle[] {
  const { boards, images } = useRefBoards.getState();
  return boardsForArchive(Object.values(boards), Object.values(images), projectId);
}

/**
 * Boards from an imported file. Their pictures were unpacked next to the story's images; each one moves
 * into its board's folder before the rows are written, so a failure leaves no row without a file.
 */
export async function importRefBoards(bundles: RefBoardBundle[]): Promise<void> {
  for (const { board, images } of bundles) {
    const kept: RefImage[] = [];
    for (const image of images) {
      try {
        const path = files ? await files.adopt(image.path, board.id) : image.path;
        kept.push({ ...image, path, boardId: board.id });
      } catch {}
    }
    useRefBoards.setState(state => {
      const nextImages = { ...state.images };
      kept.forEach(image => {
        nextImages[image.id] = image;
      });
      return { boards: { ...state.boards, [board.id]: board }, images: nextImages };
    });
    save(target => {
      target.putBoard(board);
      target.putImages(kept);
    });
  }
}

/** The stories and characters a board can link to, from the story store. */
export function useLinkTargets(): LinkTargets {
  const projects = useStory(s => s.projects);
  const characters = useStory(s => s.characters);
  return useMemo(() => ({ projects, characters }), [projects, characters]);
}

export function useBoardImages(boardId: ID | undefined): RefImage[] {
  return useRefBoards(useShallow(s => (boardId ? imagesOf(s.images, boardId) : [])));
}

export function useBoard(boardId: ID | undefined): RefBoard | undefined {
  return useRefBoards(s => (boardId ? s.boards[boardId] : undefined));
}
