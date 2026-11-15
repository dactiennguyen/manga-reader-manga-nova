import { moveItem } from '../reorder/reorder';
import { msg } from '../i18n';
import type { ID } from '../model/types';

/** What a board collects. A board also has its own name, so the kind is only a tag. */
export type RefBoardKind = 'characters' | 'settings' | 'poses' | 'other';

export const REF_BOARD_KINDS: readonly RefBoardKind[] = ['characters', 'settings', 'poses', 'other'];

export const REF_KIND_LABEL: Record<RefBoardKind, string> = {
  characters: msg('Characters'),
  settings: msg('Settings|refKind'),
  poses: msg('Poses'),
  other: msg('Other|refKind'),
};

export type RefBoard = {
  id: ID;
  name: string;
  kind: RefBoardKind;
  /** Optional link. The story or character can be deleted later; read it through `boardLink`. */
  projectId?: ID;
  characterId?: ID;
  createdAt: number;
  updatedAt: number;
};

/** Where a picture came from. The file itself is always a copy in the board's own folder. */
export type RefImageSource = 'device' | 'character' | 'world';

export type RefImage = {
  id: ID;
  boardId: ID;
  /** Relative to the files root: `refs/<boardId>/<file>`. */
  path: string;
  /** Pixel size, 0 when unknown. Used for the masonry grid and the floating window. */
  width: number;
  height: number;
  caption: string;
  tags: string[];
  /** Order inside the board, lowest first. */
  pos: number;
  source: RefImageSource;
  createdAt: number;
  updatedAt: number;
};

export const REF_LIMITS = {
  boardName: 40,
  caption: 300,
  tags: 8,
  tag: 24,
  imagesPerBoard: 300,
  /** Picked from the device in one go. */
  pickAtOnce: 20,
} as const;

/** The folder that holds every board's files, next to `images/`. Nothing else writes here. */
export const REFS_DIR = 'refs';

export function boardDir(boardId: ID): string {
  return `${REFS_DIR}/${boardId}`;
}

export function isRefPath(path: string): boolean {
  return path.startsWith(`${REFS_DIR}/`);
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, REF_LIMITS.boardName);
}

export function cleanCaption(caption: string): string {
  return caption.trim().slice(0, REF_LIMITS.caption);
}

export function isBoardKind(value: unknown): value is RefBoardKind {
  return typeof value === 'string' && (REF_BOARD_KINDS as readonly string[]).includes(value);
}

/**
 * Tags from what was typed: split on commas, spaces and `#`, kept in the order typed. Two tags that differ
 * only in case are one tag, and the first spelling stays.
 */
export function parseTags(input: string | readonly string[]): string[] {
  const parts = typeof input === 'string' ? input.split(/[,#\s]+/) : input.flatMap(item => item.split(/[,#\s]+/));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const tag = part.trim().slice(0, REF_LIMITS.tag);
    const key = tag.toLocaleLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
    if (out.length >= REF_LIMITS.tags) {
      break;
    }
  }
  return out;
}

export function tagsText(tags: readonly string[]): string {
  return tags.join(', ');
}

export type BoardInput = { name: string; kind: RefBoardKind; projectId?: ID; characterId?: ID };

export function makeBoard(input: BoardInput, id: ID, now: number, fallbackName: string): RefBoard {
  const board: RefBoard = {
    id,
    name: cleanName(input.name) || cleanName(fallbackName),
    kind: isBoardKind(input.kind) ? input.kind : 'other',
    createdAt: now,
    updatedAt: now,
  };
  if (input.projectId) {
    board.projectId = input.projectId;
    if (input.characterId) {
      board.characterId = input.characterId;
    }
  }
  return board;
}

/** A patch for an existing board. A character link needs a story link, so dropping the story drops both. */
export function patchBoard(board: RefBoard, patch: Partial<BoardInput>, now: number): RefBoard {
  const next: RefBoard = { ...board, updatedAt: now };
  if (patch.name !== undefined) {
    next.name = cleanName(patch.name) || board.name;
  }
  if (patch.kind !== undefined && isBoardKind(patch.kind)) {
    next.kind = patch.kind;
  }
  if ('projectId' in patch) {
    if (patch.projectId) {
      next.projectId = patch.projectId;
    } else {
      delete next.projectId;
      delete next.characterId;
    }
  }
  if ('characterId' in patch) {
    if (patch.characterId && next.projectId) {
      next.characterId = patch.characterId;
    } else {
      delete next.characterId;
    }
  }
  return next;
}

export type ImageInput = { path: string; width: number; height: number; source: RefImageSource; caption?: string; tags?: string[] };

export function makeImage(boardId: ID, input: ImageInput, id: ID, pos: number, now: number): RefImage {
  return {
    id,
    boardId,
    path: input.path,
    width: Math.max(0, Math.round(input.width) || 0),
    height: Math.max(0, Math.round(input.height) || 0),
    caption: cleanCaption(input.caption ?? ''),
    tags: parseTags(input.tags ?? []),
    pos,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
}

export function imagesOf(images: Record<ID, RefImage> | readonly RefImage[], boardId: ID): RefImage[] {
  const list = Array.isArray(images) ? images : Object.values(images);
  return list.filter(image => image.boardId === boardId).sort((a, b) => a.pos - b.pos || a.createdAt - b.createdAt);
}

export function nextPos(images: readonly RefImage[]): number {
  return images.reduce((max, image) => Math.max(max, image.pos + 1), 0);
}

/**
 * Moves one picture to a new place and numbers the board again from 0. Returns only the pictures whose
 * place changed, so the caller writes as few rows as it can.
 */
export function moveImage(sorted: readonly RefImage[], id: ID, to: number, now: number): RefImage[] {
  const from = sorted.findIndex(image => image.id === id);
  if (from < 0) {
    return [];
  }
  const order = moveItem(sorted, from, Math.max(0, Math.min(sorted.length - 1, to)));
  const changed: RefImage[] = [];
  order.forEach((image, index) => {
    if (image.pos !== index) {
      changed.push({ ...image, pos: index, updatedAt: now });
    }
  });
  return changed;
}

/** Each tag on the board once, most used first, then by name. */
export function boardTags(images: readonly RefImage[]): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const image of images) {
    for (const tag of image.tags) {
      const key = tag.toLocaleLowerCase();
      const entry = counts.get(key);
      if (entry) {
        entry.count++;
      } else {
        counts.set(key, { tag, count: 1 });
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function hasTag(image: RefImage, tag: string): boolean {
  const key = tag.toLocaleLowerCase();
  return image.tags.some(item => item.toLocaleLowerCase() === key);
}

/** Lower case without Vietnamese marks, so "nhan vat" finds "Nhân vật". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase();
}

/** Only the links whose story and character still exist. */
export type LinkTargets = {
  projects: Record<ID, { title: string; deletedAt?: number }>;
  characters: Record<ID, { name: string; projectId: ID }>;
};

export type BoardLink = { projectId?: ID; projectTitle?: string; characterId?: ID; characterName?: string };

export function boardLink(board: RefBoard, targets: LinkTargets): BoardLink {
  const project = board.projectId ? targets.projects[board.projectId] : undefined;
  if (!project || project.deletedAt) {
    return {};
  }
  const character = board.characterId ? targets.characters[board.characterId] : undefined;
  const link: BoardLink = { projectId: board.projectId, projectTitle: project.title };
  if (character && character.projectId === board.projectId) {
    link.characterId = board.characterId;
    link.characterName = character.name;
  }
  return link;
}

export type BoardScope = { projectId?: ID; characterId?: ID };

export type BoardFilter = { query: string; kind: RefBoardKind | 'all'; scope?: BoardScope };

/**
 * Boards to show, last changed first. The search looks at the board's name, its kind, the story and
 * character it is linked to, and every caption and tag on it.
 */
export function filterBoards(
  boards: readonly RefBoard[],
  images: readonly RefImage[],
  filter: BoardFilter,
  targets: LinkTargets,
  kindLabel: (kind: RefBoardKind) => string = kind => REF_KIND_LABEL[kind],
): RefBoard[] {
  const needle = fold(filter.query.trim());
  const words = new Map<ID, string>();
  if (needle) {
    for (const image of images) {
      words.set(image.boardId, `${words.get(image.boardId) ?? ''} ${image.caption} ${image.tags.join(' ')}`);
    }
  }
  return boards
    .filter(board => {
      if (filter.kind !== 'all' && board.kind !== filter.kind) {
        return false;
      }
      const link = boardLink(board, targets);
      if (filter.scope?.projectId && link.projectId !== filter.scope.projectId) {
        return false;
      }
      if (filter.scope?.characterId && link.characterId !== filter.scope.characterId) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [board.name, kindLabel(board.kind), link.projectTitle, link.characterName, words.get(board.id)]
        .filter(Boolean)
        .join(' ');
      return fold(haystack).includes(needle);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Boards for the canvas: the ones linked to this character, then to this story, then the rest. */
export function boardsForCanvas(boards: readonly RefBoard[], targets: LinkTargets, scope: BoardScope): RefBoard[] {
  const rank = (board: RefBoard) => {
    const link = boardLink(board, targets);
    if (scope.characterId && link.characterId === scope.characterId) {
      return 0;
    }
    return scope.projectId && link.projectId === scope.projectId ? 1 : 2;
  };
  return [...boards].sort((a, b) => rank(a) - rank(b) || b.updatedAt - a.updatedAt);
}

export function countByKind(boards: readonly RefBoard[]): Record<RefBoardKind | 'all', number> {
  const out: Record<RefBoardKind | 'all', number> = { all: boards.length, characters: 0, settings: 0, poses: 0, other: 0 };
  for (const board of boards) {
    out[board.kind]++;
  }
  return out;
}
