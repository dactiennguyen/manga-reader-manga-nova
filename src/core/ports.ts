import type { ID, LayerImage, PanelArt, Stroke, StoryData } from './model/types';

export type TableName = keyof StoryData;

export type RowPatch = {
  table: TableName;
  id: ID;
  /** null: the row did not exist. */
  before: unknown | null;
  /** null: the row is soft deleted. */
  after: unknown | null;
};

export type UndoScope = `script:${string}` | `page:${string}` | `panel:${string}` | `project:${string}`;

export type ChangeSet = {
  patches: RowPatch[];
  /** Missing: the change does not enter history. */
  undoScope?: UndoScope;
  /** Merges consecutive edits, for example typing in one block. */
  coalesceKey?: string;
};

export type DbValue = string | number | null | ArrayBuffer;

export type DbRow = Record<string, DbValue>;

/** Synchronous on purpose: one change touches a few rows, and a stroke must be on disk when the pen lifts. */
export interface Db {
  query(sql: string, params?: DbValue[]): DbRow[];
  run(sql: string, params?: DbValue[]): void;
  transaction<T>(work: () => T): T;
}

export interface StoryRepo {
  loadAll(): StoryData;
  apply(patches: RowPatch[]): void;
}

/** One art_layers row: everything undo needs, since strokes themselves are immutable. */
export type LayerRow = {
  id: ID;
  panelId: ID;
  pos: number;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  image?: LayerImage;
  gen: number;
  head: number;
  deleted: boolean;
};

export interface ArtRepo {
  loadPanel(panelId: ID): PanelArt | null;
  /** Replaces the whole panel with new layer ids. Layer ids repeat across panels in old files. */
  savePanel(panelId: ID, art: PanelArt): PanelArt;
  appendStroke(layerId: ID, stroke: Stroke): { gen: number; head: number };
  /** Writes a new generation, used by moving or clearing a layer. */
  writeGeneration(layerId: ID, strokes: Stroke[]): { gen: number; head: number };
  loadStrokes(layerId: ID, gen: number, head: number): Stroke[];
  putLayer(row: LayerRow): void;
  setActiveLayer(panelId: ID, layerId: ID | undefined): void;
  panelsWithArt(): ID[];
}

export interface MetaRepo {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
