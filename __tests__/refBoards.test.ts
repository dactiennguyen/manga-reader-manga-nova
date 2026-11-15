import { buildProjectBundle, mapBundleImages, remapBundleIds } from '../src/core/archive/bundle';
import { parseProjectBundle } from '../src/core/archive/parse';
import { boardsForArchive, cleanBoardBundles, remapBoardBundles } from '../src/core/refBoards/archive';
import { boardListGrid, containSize, masonry, masonryColumnCount, stepIndex, tileRatio } from '../src/core/refBoards/layout';
import {
  boardLink,
  boardTags,
  boardsForCanvas,
  countByKind,
  filterBoards,
  fold,
  imagesOf,
  makeBoard,
  makeImage,
  moveImage,
  parseTags,
  patchBoard,
  type LinkTargets,
  type RefBoard,
  type RefImage,
} from '../src/core/refBoards/model';
import type { RefFiles } from '../src/core/refBoards/port';
import {
  REF_WINDOW,
  clampWidth,
  clampX,
  clampY,
  defaultWindow,
  fitWindow,
  nextOpacity,
  tabSide,
  windowHeight,
} from '../src/core/refBoards/window';
import { SWEPT_DIRS } from '../src/data/gc';
import { MIGRATIONS, migrate, userVersion } from '../src/data/migrations';
import { createRefBoardRepo } from '../src/data/refBoardRepo';
import { connectRefBoards, exportRefBoards, importRefBoards, useRefBoards } from '../src/state/useRefBoards';
import { createNodeDb } from './helpers/nodeDb';

const NOW = 1_700_000_000_000;

const targets: LinkTargets = {
  projects: { p1: { title: 'The Parcel' }, p2: { title: 'Gone', deletedAt: NOW } },
  characters: { c1: { name: 'Minh', projectId: 'p1' }, c2: { name: 'Tu', projectId: 'p2' } },
};

function board(id: string, extra: Partial<RefBoard> = {}): RefBoard {
  return { id, name: id, kind: 'other', createdAt: NOW, updatedAt: NOW, ...extra };
}

function image(id: string, boardId: string, pos: number, extra: Partial<RefImage> = {}): RefImage {
  return makeImage(boardId, { path: `refs/${boardId}/${id}.jpg`, width: 400, height: 300, source: 'device', ...extra }, id, pos, NOW);
}

describe('reference board model', () => {
  it('cleans names and falls back to the kind', () => {
    expect(makeBoard({ name: '  Rooftops   at  night ', kind: 'settings' }, 'b', NOW, 'Settings').name).toBe('Rooftops at night');
    expect(makeBoard({ name: '   ', kind: 'poses' }, 'b', NOW, 'Poses').name).toBe('Poses');
    expect(makeBoard({ name: 'x'.repeat(80), kind: 'other' }, 'b', NOW, '').name).toHaveLength(40);
  });

  it('keeps a character link only with a story link', () => {
    expect(makeBoard({ name: 'a', kind: 'characters', characterId: 'c1' }, 'b', NOW, '').characterId).toBeUndefined();
    const linked = makeBoard({ name: 'a', kind: 'characters', projectId: 'p1', characterId: 'c1' }, 'b', NOW, '');
    expect(linked).toMatchObject({ projectId: 'p1', characterId: 'c1' });
    const unlinked = patchBoard(linked, { projectId: undefined }, NOW + 1);
    expect(unlinked.projectId).toBeUndefined();
    expect(unlinked.characterId).toBeUndefined();
    expect(patchBoard(linked, { name: '  ' }, NOW).name).toBe('a');
  });

  it('parses tags without repeats', () => {
    expect(parseTags('#hands, Hands  feet,#back')).toEqual(['hands', 'feet', 'back']);
    expect(parseTags(['a b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(parseTags('1 2 3 4 5 6 7 8 9 10')).toHaveLength(8);
  });

  it('moves a picture and only returns what changed', () => {
    const list = [image('a', 'b', 0), image('b', 'b', 1), image('c', 'b', 2), image('d', 'b', 3)];
    const changed = moveImage(list, 'd', 1, NOW);
    expect(changed.map(item => [item.id, item.pos])).toEqual([
      ['d', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(moveImage(list, 'a', -5, NOW)).toEqual([]);
    expect(moveImage(list, 'missing', 0, NOW)).toEqual([]);
  });

  it('sorts a board by place and counts tags', () => {
    const list = [image('b', 'x', 1, { tags: ['Hands'] }), image('a', 'x', 0, { tags: ['hands', 'feet'] }), image('z', 'y', 0)];
    expect(imagesOf(list, 'x').map(item => item.id)).toEqual(['a', 'b']);
    expect(boardTags(imagesOf(list, 'x'))).toEqual([
      { tag: 'hands', count: 2 },
      { tag: 'feet', count: 1 },
    ]);
  });

  it('drops links to deleted stories and moved characters', () => {
    expect(boardLink(board('a', { projectId: 'p1', characterId: 'c1' }), targets)).toEqual({
      projectId: 'p1',
      projectTitle: 'The Parcel',
      characterId: 'c1',
      characterName: 'Minh',
    });
    expect(boardLink(board('a', { projectId: 'p2' }), targets)).toEqual({});
    expect(boardLink(board('a', { projectId: 'gone' }), targets)).toEqual({});
    expect(boardLink(board('a', { projectId: 'p1', characterId: 'c2' }), targets)).toEqual({ projectId: 'p1', projectTitle: 'The Parcel' });
  });

  it('searches names, kinds, links, captions and tags without marks', () => {
    const boards = [
      board('a', { name: 'Nhân vật chính', updatedAt: NOW + 2 }),
      board('b', { name: 'Streets', kind: 'settings', projectId: 'p1', updatedAt: NOW + 1 }),
      board('c', { name: 'Misc' }),
    ];
    const images = [image('i', 'c', 0, { caption: 'Rainy alley', tags: ['night'] })];
    const find = (query: string, extra = {}) => filterBoards(boards, images, { query, kind: 'all', ...extra }, targets).map(item => item.id);
    expect(find('')).toEqual(['a', 'b', 'c']);
    expect(find('nhan vat')).toEqual(['a']);
    expect(find('parcel')).toEqual(['b']);
    expect(find('alley')).toEqual(['c']);
    expect(find('NIGHT')).toEqual(['c']);
    expect(find('', { kind: 'settings' })).toEqual(['b']);
    expect(find('', { scope: { projectId: 'p1' } })).toEqual(['b']);
    expect(fold('Đường phố')).toBe('duong pho');
    expect(countByKind(boards)).toEqual({ all: 3, characters: 0, settings: 1, poses: 0, other: 2 });
  });

  it('puts the character and story boards first on the canvas', () => {
    const boards = [board('none', { updatedAt: NOW + 9 }), board('story', { projectId: 'p1' }), board('hero', { projectId: 'p1', characterId: 'c1' })];
    expect(boardsForCanvas(boards, targets, { projectId: 'p1', characterId: 'c1' }).map(item => item.id)).toEqual(['hero', 'story', 'none']);
  });
});

describe('reference board layout', () => {
  it('fills the shortest column first, in board order', () => {
    const items = [
      { id: 'tall', width: 100, height: 180 },
      { id: 'a', width: 100, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 0, height: 0 },
    ];
    const columns = masonry(items, 2, 100, 10);
    expect(columns.map(column => column.map(tile => tile.id))).toEqual([['tall', 'c'], ['a', 'b']]);
    expect(columns[0][0].height).toBe(180);
    expect(tileRatio(100, 1000)).toBe(1.8);
    expect(tileRatio(1000, 10)).toBe(0.6);
  });

  it('adds columns on wider screens', () => {
    expect(masonryColumnCount(360)).toBe(2);
    expect(masonryColumnCount(800)).toBeGreaterThanOrEqual(4);
    expect(boardListGrid(360).columns).toBe(2);
    expect(boardListGrid(900).columns).toBeGreaterThanOrEqual(3);
  });

  it('steps round the ends and fits pictures', () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(5, 1, 0)).toBe(0);
    expect(containSize(400, 200, 100, 100)).toEqual({ w: 100, h: 50 });
  });
});

describe('floating reference window', () => {
  const area = { w: 400, h: 800 };

  it('starts small, opposite the rail and under the top bar', () => {
    const right = defaultWindow(area, 'right', 72);
    expect(right).toMatchObject({ w: REF_WINDOW.defaultW, y: 72, collapsed: false, opacity: 1, flipped: false });
    expect(right.x + right.w).toBe(area.w - REF_WINDOW.edge);
    expect(defaultWindow(area, 'left', 72).x).toBe(REF_WINDOW.edge);
  });

  it('stays on screen and never takes most of the page', () => {
    expect(clampWidth(1000, area.w)).toBe(area.w * REF_WINDOW.maxShare);
    expect(clampWidth(10, area.w)).toBe(REF_WINDOW.minW);
    expect(clampX(-50, 200, area)).toBe(REF_WINDOW.edge);
    expect(clampX(500, 200, area)).toBe(area.w - 200 - REF_WINDOW.edge);
    expect(clampY(0, 300, area, 72)).toBe(72);
    expect(clampY(2000, 300, area, 72)).toBe(area.h - 300 - REF_WINDOW.edge);
    const moved = fitWindow({ ...defaultWindow(area, 'right', 72), x: 900, w: 900 }, { w: 300, h: 500 }, 1, 72);
    expect(moved.x + moved.w).toBeLessThanOrEqual(300);
    expect(windowHeight(200, 5)).toBe(REF_WINDOW.header + 300 + REF_WINDOW.tools);
    expect(tabSide(10, 100, 400)).toBe('left');
    expect(tabSide(300, 100, 400)).toBe('right');
  });

  it('cycles the picture opacity', () => {
    expect(nextOpacity(1)).toBe(0.75);
    expect(nextOpacity(0.25)).toBe(1);
    expect(nextOpacity(0.33)).toBe(1);
  });
});

describe('reference board storage', () => {
  function fakeFiles() {
    const removed: string[] = [];
    const removedBoards: string[] = [];
    const files: RefFiles = {
      adopt: async (path, boardId) => `refs/${boardId}/${path.split('/').pop()}`,
      remove: async path => {
        removed.push(path);
      },
      removeBoard: async boardId => {
        removedBoards.push(boardId);
      },
    };
    return { files, removed, removedBoards };
  }

  it('adds migration 3 with its own tables', () => {
    const db = createNodeDb();
    expect(migrate(db)).toBe(MIGRATIONS[MIGRATIONS.length - 1].version);
    expect(userVersion(db)).toBeGreaterThanOrEqual(3);
    const tables = db.query("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name);
    expect(tables).toEqual(expect.arrayContaining(['ref_boards', 'ref_images']));
  });

  it('saves boards and pictures, and reads them back after a restart', () => {
    const db = createNodeDb();
    migrate(db);
    connectRefBoards(createRefBoardRepo(db));
    const store = useRefBoards.getState();
    const id = store.createBoard({ name: 'Minh', kind: 'characters', projectId: 'p1', characterId: 'c1' });
    const [a, b] = store.addImages(id, [
      { path: `refs/${id}/a.jpg`, width: 10, height: 20, source: 'device' },
      { path: `refs/${id}/b.jpg`, width: 10, height: 20, source: 'character', caption: 'jacket' },
    ]);
    store.updateImage(a, { caption: ' Side view ', tags: '#profile, hair' });
    store.moveImage(b, 0);
    connectRefBoards(createRefBoardRepo(db));
    const state = useRefBoards.getState();
    expect(state.boards[id]).toMatchObject({ name: 'Minh', kind: 'characters', characterId: 'c1' });
    expect(imagesOf(state.images, id).map(item => [item.id, item.caption, item.tags])).toEqual([
      [b, 'jacket', []],
      [a, 'Side view', ['profile', 'hair']],
    ]);
  });

  it('frees the files of a removed picture and a deleted board', () => {
    const db = createNodeDb();
    migrate(db);
    const { files, removed, removedBoards } = fakeFiles();
    connectRefBoards(createRefBoardRepo(db), files);
    const store = useRefBoards.getState();
    const id = store.createBoard({ name: '', kind: 'poses' });
    const [a] = store.addImages(id, [
      { path: `refs/${id}/a.jpg`, width: 1, height: 1, source: 'device' },
      { path: `refs/${id}/b.jpg`, width: 1, height: 1, source: 'device' },
    ]);
    store.removeImage(a);
    expect(removed).toEqual([`refs/${id}/a.jpg`]);
    store.deleteBoard(id);
    expect(removedBoards).toEqual([id]);
    expect(Object.keys(useRefBoards.getState().images)).toEqual([]);
    expect(Number(db.query('SELECT COUNT(*) AS n FROM ref_images')[0].n)).toBe(0);
    expect(Number(db.query('SELECT COUNT(*) AS n FROM ref_boards')[0].n)).toBe(0);
  });

  it('keeps board files out of the folders a clean-up may sweep', () => {
    expect(SWEPT_DIRS).not.toContain('refs');
  });
});

describe('reference boards in a .manganova file', () => {
  const story = {
    projects: {
      p1: { id: 'p1', title: 'Parcel', genres: [], logline: '', format: 'manga', pageSize: 'B5', style: 'shounen', color: false, done: false, acts: [], createdAt: NOW, updatedAt: NOW },
    },
    chapters: {},
    scenes: {},
    characters: {
      c1: { id: 'c1', projectId: 'p1', name: 'Minh', sheet: { expressions: {} } },
    },
    relations: {},
    world: {},
    pages: {},
  } as never;

  it('carries only the boards linked to the story, and gives them new ids on import', () => {
    const boards = [board('linked', { projectId: 'p1', characterId: 'c1' }), board('loose')];
    const images = [image('i1', 'linked', 0, { caption: 'hood', tags: ['coat'] }), image('i2', 'loose', 0)];
    const built = buildProjectBundle(story, 'p1', () => ({}));
    const bundle = { ...built!, refBoards: boardsForArchive(boards, images, 'p1') };
    expect(bundle.refBoards.map(entry => entry.board.id)).toEqual(['linked']);

    const portable = mapBundleImages(bundle, path => `images/${path.split('/').pop()}`);
    expect(portable.refBoards?.[0].images[0].path).toBe('images/i1.jpg');

    const parsed = parseProjectBundle(JSON.stringify(portable));
    let n = 0;
    const remapped = remapBundleIds(parsed, () => `new${++n}`);
    const [entry] = remapped.refBoards ?? [];
    expect(entry.board.projectId).toBe(remapped.project.id);
    expect(entry.board.characterId).toBe(remapped.characters[0].id);
    expect(entry.board.id).not.toBe('linked');
    expect(entry.images[0]).toMatchObject({ boardId: entry.board.id, caption: 'hood', tags: ['coat'] });
  });

  it('reads files without boards, and skips broken entries', () => {
    const built = buildProjectBundle(story, 'p1', () => ({}));
    expect(parseProjectBundle(JSON.stringify(built)).refBoards).toBeUndefined();
    expect(cleanBoardBundles([null, { board: { id: '' } }, { board: { id: 'b', kind: 'odd' }, images: [{ id: 'i' }, { id: 'j', path: 'images/1.png', tags: [3, 'x'] }] }], NOW)).toEqual([
      {
        board: { id: 'b', name: '…', kind: 'other', createdAt: NOW, updatedAt: NOW },
        images: [expect.objectContaining({ id: 'j', boardId: 'b', path: 'images/1.png', tags: ['x'], pos: 0 })],
      },
    ]);
    const lost = remapBoardBundles([{ board: board('x', { projectId: 'old', characterId: 'nobody' }), images: [] }], id => `n-${id}`, 'p9', new Set());
    expect(lost[0].board).toMatchObject({ id: 'n-x', projectId: 'p9' });
    expect(lost[0].board.characterId).toBeUndefined();
  });

  it('moves imported pictures into their board folder', async () => {
    const db = createNodeDb();
    migrate(db);
    connectRefBoards(createRefBoardRepo(db), {
      adopt: async (path, boardId) => `refs/${boardId}/${path.split('/').pop()}`,
      remove: async () => {},
      removeBoard: async () => {},
    });
    await importRefBoards([{ board: board('b9', { projectId: 'p1' }), images: [image('i9', 'b9', 0, { path: 'images/7.jpg' })] }]);
    expect(useRefBoards.getState().images.i9.path).toBe('refs/b9/7.jpg');
    expect(exportRefBoards('p1').map(entry => entry.board.id)).toEqual(['b9']);
    connectRefBoards(createRefBoardRepo(db));
    expect(useRefBoards.getState().images.i9.path).toBe('refs/b9/7.jpg');
  });
});
