import { buildProjectBundle } from '../src/core/archive/bundle';
import { parseProjectBundle } from '../src/core/archive/parse';
import { BUILTIN_BRUSHES, DEFAULT_BRUSH } from '../src/core/art/brushes';
import { parseLayerPayload } from '../src/core/nearby/codraw';
import type { Db, MetaRepo } from '../src/core/ports';
import type { PanelArt, StoryData, Stroke } from '../src/core/model/types';
import { createArtRepo } from '../src/data/artRepo';
import { MIGRATIONS, migrate, userVersion } from '../src/data/migrations';
import { connectArtPresets, saveBrush, useArtPresets } from '../src/state/useArtPresets';
import { createNodeDb } from './helpers/nodeDb';

/** Writes a stroke the way the app did before custom brushes: no style column. */
function insertOld(db: Db, layerId: string, seq: number, stroke: Stroke): void {
  db.run(
    `INSERT INTO strokes (layer_id, gen, seq, tool, color, size, opacity, flags, tone, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      layerId,
      0,
      seq,
      stroke.tool,
      stroke.color,
      stroke.size,
      stroke.opacity,
      stroke.pressure ? 1 : 0,
      stroke.tone?.density ?? null,
      Float32Array.from(stroke.points).buffer as ArrayBuffer,
    ],
  );
}

const oldStrokes: Stroke[] = [
  { tool: 'gpen', color: '#000000', size: 6, opacity: 1, points: [1, 2, 0.5, 3, 4, 0.25], pressure: true },
  { tool: 'pencil', color: '#333333', size: 3, opacity: 0.75, points: [10, 10, 20, 20] },
  { tool: 'brush', color: '#000000', size: 16, opacity: 1, points: [5, 5, 9, 9], tone: { density: 0.25 } },
  { tool: 'fill', color: '#000000', size: 4, opacity: 1, points: [0, 0, 10, 0, 10, 10], tone: { density: 0.6 } },
];

const newStrokes: Stroke[] = [
  {
    tool: 'pencil',
    color: '#000000',
    size: 4,
    opacity: 0.9,
    points: [1, 2, 0.5, 3, 4, 0.75],
    pressure: true,
    brush: { ...DEFAULT_BRUSH, pressureOpacity: 0.6, grain: 'pencil' },
  },
  {
    tool: 'fill',
    color: '#000000',
    size: 4,
    opacity: 1,
    points: [0, 0, 10, 0, 10, 10],
    tone: { density: 0.05, kind: 'gradient', pitch: 6, angle: 45, density2: 0.6, span: [5, 0, 5, 10] },
  },
  {
    tool: 'brush',
    color: '#000000',
    size: 12,
    opacity: 1,
    points: [1, 1, 5, 5],
    tone: { density: 0.25, kind: 'lines', pitch: 6, angle: 30, weight: 1.5 },
    brush: { ...DEFAULT_BRUSH, grain: 'dry' },
  },
];

function v1Database(): Db {
  const db = createNodeDb();
  migrate(db, MIGRATIONS.slice(0, 1));
  db.run('INSERT INTO art_panels (panel_id, active_layer_id) VALUES (?, ?)', ['panel', 'layer']);
  db.run(
    `INSERT INTO art_layers (id, panel_id, pos, name, visible, opacity, locked, image, gen, head)
     VALUES ('layer', 'panel', 0, 'Ink', 1, 1, 0, NULL, 0, ?)`,
    [oldStrokes.length],
  );
  oldStrokes.forEach((stroke, seq) => insertOld(db, 'layer', seq, stroke));
  return db;
}

describe('strokes on disk', () => {
  it('a database from before custom brushes upgrades and reads back every stroke unchanged', () => {
    const db = v1Database();
    expect(userVersion(db)).toBe(1);
    migrate(db);
    expect(userVersion(db)).toBe(2);
    const art = createArtRepo(db).loadPanel('panel');
    expect(art?.layers[0].strokes).toEqual(oldStrokes);
    // Old strokes keep exactly their old fields: no brush, a density-only tone.
    expect(art?.layers[0].strokes.every(stroke => stroke.brush === undefined)).toBe(true);
    expect(art?.layers[0].strokes[2].tone).toEqual({ density: 0.25 });
  });

  it('writes nothing extra for an old-style stroke', () => {
    const db = createNodeDb();
    migrate(db);
    const repo = createArtRepo(db);
    const saved = repo.savePanel('panel', { layers: [{ id: 'l', name: 'Ink', visible: true, opacity: 1, locked: false, strokes: oldStrokes }] });
    const rows = db.query('SELECT style, tone FROM strokes WHERE layer_id = ? ORDER BY seq', [saved.layers[0].id]);
    expect(rows.map(row => row.style)).toEqual([null, null, null, null]);
    expect(rows.map(row => row.tone)).toEqual([null, null, 0.25, 0.6]);
  });

  it('keeps a custom brush and tone through a cold start, with the density as a fallback', () => {
    const db = createNodeDb();
    migrate(db);
    const repo = createArtRepo(db);
    const saved = repo.savePanel('panel', { layers: [{ id: 'l', name: 'Ink', visible: true, opacity: 1, locked: false, strokes: newStrokes }] });
    const back = createArtRepo(db).loadPanel('panel');
    expect(back?.layers[0].strokes).toEqual(newStrokes);
    const rows = db.query('SELECT tone FROM strokes WHERE layer_id = ? ORDER BY seq', [saved.layers[0].id]);
    expect(rows.map(row => row.tone)).toEqual([null, 0.05, 0.25]);
  });

  it('ignores a broken style instead of failing the panel', () => {
    const db = createNodeDb();
    migrate(db);
    const repo = createArtRepo(db);
    const saved = repo.savePanel('panel', { layers: [{ id: 'l', name: 'Ink', visible: true, opacity: 1, locked: false, strokes: [oldStrokes[2]] }] });
    db.run('UPDATE strokes SET style = ? WHERE layer_id = ?', ['{not json', saved.layers[0].id]);
    expect(createArtRepo(db).loadPanel('panel')?.layers[0].strokes).toEqual([oldStrokes[2]]);
  });
});

const art = (strokes: Stroke[]): PanelArt => ({
  layers: [{ id: 'layer', name: 'Ink', visible: true, opacity: 1, locked: false, strokes }],
});

function archiveJson(strokes: Stroke[]): string {
  const state = {
    projects: {
      p: { id: 'p', title: 'T', genres: [], logline: '', format: 'manga', pageSize: 'B5', style: 'shounen', color: false, done: false, acts: [], createdAt: 1, updatedAt: 1 },
    },
    chapters: {
      c: { id: 'c', projectId: 'p', title: 'C', summary: '', goal: '', characterIds: [], sceneIds: [], pageIds: ['pg'], createdAt: 1, updatedAt: 1 },
    },
    scenes: {},
    characters: {},
    relations: {},
    world: {},
    pages: {
      pg: {
        id: 'pg',
        chapterId: 'c',
        layout: { kind: 'panel', id: 'panel' },
        panels: { panel: { id: 'panel', bleed: false, borderless: false, description: '', blockIds: [] } },
        gutterH: 22,
        gutterV: 12,
        done: false,
        bubbles: [],
        effects: [],
        artRev: 0,
        updatedAt: 1,
      },
    },
  };
  const bundle = buildProjectBundle(state as unknown as StoryData, 'p', () => ({ panel: art(strokes) }));
  return JSON.stringify(bundle);
}

describe('.manganova archives', () => {
  it('an archive from before custom brushes reads back its strokes unchanged', () => {
    const parsed = parseProjectBundle(archiveJson(oldStrokes));
    expect(parsed.art.panel.layers[0].strokes).toEqual(oldStrokes);
  });

  it('carries every brush and tone parameter, so the drawing looks the same elsewhere', () => {
    const parsed = parseProjectBundle(archiveJson(newStrokes));
    expect(parsed.art.panel.layers[0].strokes).toEqual(newStrokes);
  });

  it('clamps or drops what a hand-edited file gets wrong', () => {
    const bad = [{ ...newStrokes[0], brush: { hardness: 7, grain: 'glitter' } }, { ...oldStrokes[2], tone: { kind: 'dots' } }] as unknown as Stroke[];
    const strokes = parseProjectBundle(archiveJson(bad)).art.panel.layers[0].strokes;
    expect(strokes[0].brush).toMatchObject({ hardness: 1, grain: 'none' });
    expect(strokes[1].tone).toBeUndefined();
  });
});

describe('drawing together', () => {
  it('a whole layer sent by a friend keeps its brushes and tones', () => {
    expect(parseLayerPayload({ strokes: [...oldStrokes, ...newStrokes] })).toEqual([...oldStrokes, ...newStrokes]);
  });
});

describe('preset store', () => {
  function memoryRepo(): MetaRepo & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
      data,
      get: key => data[key] ?? null,
      set: (key, value) => {
        data[key] = value;
      },
      remove: key => {
        delete data[key];
      },
    };
  }

  it('saves to the meta table and reads back on the next launch', () => {
    const repo = memoryRepo();
    connectArtPresets(repo);
    expect(useArtPresets.getState().brushes).toEqual([]);
    useArtPresets.getState().update(p => saveBrush(p, { ...BUILTIN_BRUSHES[0], id: 'mine', name: 'Mine' }));
    expect(JSON.parse(repo.data.artPresets).brushes[0].id).toBe('mine');
    connectArtPresets(null);
    expect(useArtPresets.getState().brushes).toEqual([]);
    connectArtPresets(repo);
    expect(useArtPresets.getState().brushes.map(b => b.name)).toEqual(['Mine']);
  });

  it('does not write when nothing changed', () => {
    const repo = memoryRepo();
    connectArtPresets(repo);
    useArtPresets.getState().update(p => p);
    expect(repo.data.artPresets).toBeUndefined();
  });
});
