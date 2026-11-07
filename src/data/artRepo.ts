import type { ArtRepo, Db, DbRow, LayerRow } from '../core/ports';
import type { ArtLayer, ID, LayerImage, Stroke, StrokeTool } from '../core/model/types';
import { uid } from '../core/util/id';

const FLAG_PRESSURE = 1;

function encodePoints(points: readonly number[]): ArrayBuffer {
  return Float32Array.from(points).buffer as ArrayBuffer;
}

function decodeStroke(row: DbRow): Stroke {
  const stroke: Stroke = {
    tool: row.tool as StrokeTool,
    color: row.color as string,
    size: row.size as number,
    opacity: row.opacity as number,
    points: Array.from(new Float32Array(row.points as ArrayBuffer)),
  };
  if ((row.flags as number) & FLAG_PRESSURE) {
    stroke.pressure = true;
  }
  if (row.tone !== null && row.tone !== undefined) {
    stroke.tone = { density: row.tone as number };
  }
  return stroke;
}

function insertStroke(db: Db, layerId: ID, gen: number, seq: number, stroke: Stroke): void {
  db.run(
    `INSERT INTO strokes (layer_id, gen, seq, tool, color, size, opacity, flags, tone, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      layerId,
      gen,
      seq,
      stroke.tool,
      stroke.color,
      stroke.size,
      stroke.opacity,
      stroke.pressure ? FLAG_PRESSURE : 0,
      stroke.tone?.density ?? null,
      encodePoints(stroke.points),
    ],
  );
}

export function createArtRepo(db: Db, now: () => number = Date.now): ArtRepo {
  const strokesOf = (layerId: ID, gen: number, head: number) =>
    db
      .query('SELECT * FROM strokes WHERE layer_id = ? AND gen = ? AND seq < ? ORDER BY seq', [layerId, gen, head])
      .map(decodeStroke);

  const layerState = (layerId: ID) => {
    const row = db.query('SELECT gen, head FROM art_layers WHERE id = ?', [layerId])[0];
    if (!row) {
      throw new Error(`Layer not found: ${layerId}`);
    }
    return { gen: row.gen as number, head: row.head as number };
  };

  const nextGeneration = (layerId: ID) => {
    const row = db.query('SELECT MAX(gen) AS top FROM strokes WHERE layer_id = ?', [layerId])[0];
    return Math.max(layerState(layerId).gen, (row?.top as number | null) ?? 0) + 1;
  };

  const ensurePanel = (panelId: ID) =>
    db.run(
      `INSERT INTO art_panels (panel_id, deleted_at) VALUES (?, NULL)
       ON CONFLICT(panel_id) DO UPDATE SET deleted_at = NULL`,
      [panelId],
    );

  const putLayer = (row: LayerRow) => {
    ensurePanel(row.panelId);
    db.run(
      `INSERT INTO art_layers (id, panel_id, pos, name, visible, opacity, locked, image, gen, head, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET pos = excluded.pos, name = excluded.name, visible = excluded.visible,
         opacity = excluded.opacity, locked = excluded.locked, image = excluded.image, gen = excluded.gen,
         head = excluded.head, deleted_at = excluded.deleted_at`,
      [
        row.id,
        row.panelId,
        row.pos,
        row.name,
        row.visible ? 1 : 0,
        row.opacity,
        row.locked ? 1 : 0,
        row.image ? JSON.stringify(row.image) : null,
        row.gen,
        row.head,
        row.deleted ? now() : null,
      ],
    );
  };

  return {
    loadPanel(panelId) {
      const panel = db.query('SELECT active_layer_id FROM art_panels WHERE panel_id = ?', [panelId])[0];
      if (!panel) {
        return null;
      }
      const rows = db.query('SELECT * FROM art_layers WHERE panel_id = ? AND deleted_at IS NULL ORDER BY pos', [panelId]);
      const layers: ArtLayer[] = rows.map(row => {
        const layer: ArtLayer = {
          id: row.id as string,
          name: row.name as string,
          visible: !!row.visible,
          opacity: row.opacity as number,
          locked: !!row.locked,
          strokes: strokesOf(row.id as string, row.gen as number, row.head as number),
          gen: row.gen as number,
          head: row.head as number,
        };
        if (row.image) {
          layer.image = JSON.parse(row.image as string) as LayerImage;
        }
        return layer;
      });
      return { layers, activeLayerId: (panel.active_layer_id as string | null) ?? undefined };
    },

    savePanel(panelId, art) {
      return db.transaction(() => {
        ensurePanel(panelId);
        db.run('UPDATE art_layers SET deleted_at = ? WHERE panel_id = ? AND deleted_at IS NULL', [now(), panelId]);
        const ids = new Map<ID, ID>();
        const layers = art.layers.map((layer, pos) => {
          const id = uid();
          ids.set(layer.id, id);
          putLayer({
            id,
            panelId,
            pos,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            locked: layer.locked,
            image: layer.image,
            gen: 0,
            head: layer.strokes.length,
            deleted: false,
          });
          layer.strokes.forEach((stroke, seq) => insertStroke(db, id, 0, seq, stroke));
          return { ...layer, id, gen: 0, head: layer.strokes.length };
        });
        const activeLayerId = art.activeLayerId ? ids.get(art.activeLayerId) : undefined;
        db.run('UPDATE art_panels SET active_layer_id = ? WHERE panel_id = ?', [activeLayerId ?? null, panelId]);
        return { layers, activeLayerId };
      });
    },

    appendStroke(layerId, stroke) {
      return db.transaction(() => {
        const { gen, head } = layerState(layerId);
        // Drawing after an undo overwrites the redo tail.
        db.run('DELETE FROM strokes WHERE layer_id = ? AND gen = ? AND seq >= ?', [layerId, gen, head]);
        insertStroke(db, layerId, gen, head, stroke);
        db.run('UPDATE art_layers SET head = ? WHERE id = ?', [head + 1, layerId]);
        return { gen, head: head + 1 };
      });
    },

    writeGeneration(layerId, strokes) {
      return db.transaction(() => {
        const gen = nextGeneration(layerId);
        strokes.forEach((stroke, seq) => insertStroke(db, layerId, gen, seq, stroke));
        db.run('UPDATE art_layers SET gen = ?, head = ? WHERE id = ?', [gen, strokes.length, layerId]);
        return { gen, head: strokes.length };
      });
    },

    loadStrokes: strokesOf,

    putLayer: row => db.transaction(() => putLayer(row)),

    setActiveLayer(panelId, layerId) {
      db.run('UPDATE art_panels SET active_layer_id = ? WHERE panel_id = ?', [layerId ?? null, panelId]);
    },

    panelsWithArt() {
      return db
        .query(
          `SELECT DISTINCT panel_id FROM art_layers
           WHERE deleted_at IS NULL AND (head > 0 OR image IS NOT NULL)`,
        )
        .map(row => row.panel_id as string);
    },
  };
}
