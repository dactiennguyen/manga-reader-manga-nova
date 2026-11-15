import type { ID } from '../model/types';
import {
  REF_LIMITS,
  cleanCaption,
  cleanName,
  imagesOf,
  isBoardKind,
  parseTags,
  type RefBoard,
  type RefImage,
  type RefImageSource,
} from './model';

/**
 * A board inside a `.manganova` file. Only boards linked to the story go in, with their pictures, so a
 * backup of a story brings back the references drawn from it. Boards with no story stay on the device.
 */
export type RefBoardBundle = { board: RefBoard; images: RefImage[] };

export function boardsForArchive(boards: readonly RefBoard[], images: readonly RefImage[], projectId: ID): RefBoardBundle[] {
  return boards
    .filter(board => board.projectId === projectId)
    .map(board => ({ board, images: imagesOf(images, board.id) }));
}

const SOURCES: readonly RefImageSource[] = ['device', 'character', 'world'];

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value !== '__proto__';

function cleanImage(raw: unknown, boardId: ID, index: number, now: number): RefImage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const item = raw as Record<string, unknown>;
  if (!isId(item.id) || !text(item.path)) {
    return null;
  }
  return {
    id: item.id,
    boardId,
    path: text(item.path),
    width: Math.round(count(item.width)),
    height: Math.round(count(item.height)),
    caption: cleanCaption(text(item.caption)),
    tags: parseTags(Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : []),
    pos: index,
    source: SOURCES.includes(item.source as RefImageSource) ? (item.source as RefImageSource) : 'device',
    createdAt: count(item.createdAt) || now,
    updatedAt: count(item.updatedAt) || now,
  };
}

/** Reads what a file says about boards. Anything malformed is left out; the story still imports. */
export function cleanBoardBundles(raw: unknown, now: number): RefBoardBundle[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: RefBoardBundle[] = [];
  for (const entry of raw) {
    const board = (entry as { board?: Record<string, unknown> } | null)?.board;
    if (!board || typeof board !== 'object' || !isId(board.id)) {
      continue;
    }
    const clean: RefBoard = {
      id: board.id,
      name: cleanName(text(board.name)) || '…',
      kind: isBoardKind(board.kind) ? board.kind : 'other',
      createdAt: count(board.createdAt) || now,
      updatedAt: count(board.updatedAt) || now,
    };
    if (isId(board.projectId)) {
      clean.projectId = board.projectId;
    }
    if (isId(board.characterId)) {
      clean.characterId = board.characterId;
    }
    const rawImages = (entry as { images?: unknown }).images;
    const images = (Array.isArray(rawImages) ? rawImages : [])
      .slice(0, REF_LIMITS.imagesPerBoard)
      .map(item => cleanImage(item, clean.id, 0, now))
      .filter((item): item is RefImage => !!item)
      .map((item, index) => ({ ...item, pos: index }));
    out.push({ board: clean, images });
  }
  return out;
}

/** Changes every picture's path; a picture whose path maps to nothing is left out. */
export function mapBoardImages(bundles: readonly RefBoardBundle[], mapPath: (path: string) => string | undefined): RefBoardBundle[] {
  return bundles.map(({ board, images }) => ({
    board,
    images: images.flatMap(image => {
      const path = mapPath(image.path);
      return path ? [{ ...image, path }] : [];
    }),
  }));
}

/**
 * New ids for an import, from the same table as the rest of the story so a character link follows its
 * character. A link to a character that is not in the file is dropped.
 */
export function remapBoardBundles(
  bundles: readonly RefBoardBundle[],
  map: (id: ID) => ID,
  projectId: ID,
  characterIds: ReadonlySet<ID>,
): RefBoardBundle[] {
  return bundles.map(({ board, images }) => {
    const id = map(board.id);
    const next: RefBoard = { ...board, id, projectId };
    if (board.characterId && characterIds.has(board.characterId)) {
      next.characterId = map(board.characterId);
    } else {
      delete next.characterId;
    }
    return { board: next, images: images.map(image => ({ ...image, id: map(image.id), boardId: id })) };
  });
}
