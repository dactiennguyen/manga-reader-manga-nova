export type ID = string;

export type ProjectFormat = 'manga' | 'webtoon';

export type PageSize = 'B5' | 'A5';

export type ArtStyle = 'shounen' | 'shoujo' | 'seinen' | 'chibi' | 'horror' | 'slice';

export type Act = { id: ID; title: string; chapterIds: ID[] };

export type LastOpened = {
  screen: 'Script' | 'Storyboard' | 'PanelLayout' | 'Canvas' | 'Lettering' | 'Outline';
  chapterId?: ID;
  pageId?: ID;
  panelId?: ID;
};

export type Project = {
  id: ID;
  title: string;
  genres: string[];
  logline: string;
  format: ProjectFormat;
  pageSize: PageSize;
  style: ArtStyle;
  color: boolean;
  coverUri?: string;
  languages?: string[];
  done: boolean;
  acts: Act[];
  lastOpened?: LastOpened;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type Chapter = {
  id: ID;
  projectId: ID;
  title: string;
  summary: string;
  goal: string;
  characterIds: ID[];
  sceneIds: ID[];
  pageIds: ID[];
  scriptChangedAt?: number;
  paginatedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type BlockType = 'setting' | 'action' | 'dialogue' | 'narration' | 'sfx';

export type DialogueKind = 'speak' | 'think' | 'shout' | 'whisper';

export type Block = {
  id: ID;
  type: BlockType;
  text: string;
  characterId?: ID;
  kind?: DialogueKind;
};

export type Scene = {
  id: ID;
  chapterId: ID;
  description: string;
  blocks: Block[];
  collapsed?: boolean;
};

export type CharacterRole = 'main' | 'support' | 'villain' | 'extra';

export type Expression = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'shy';

export type CharacterSheet = {
  face?: string;
  body?: string;
  expressions: Partial<Record<Expression, string>>;
};

export type Character = {
  id: ID;
  projectId: ID;
  name: string;
  role: CharacterRole;
  age: string;
  gender: string;
  traits: string[];
  goal: string;
  weakness: string;
  voice: string;
  bio: string;
  notes: string;
  appearance: string;
  sheet: CharacterSheet;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Relation = {
  id: ID;
  projectId: ID;
  a: ID;
  b: ID;
  label: string;
  note: string;
};

export type WorldType = 'place' | 'faction' | 'term' | 'event' | 'note';

export type WorldEntry = {
  id: ID;
  projectId: ID;
  type: WorldType;
  title: string;
  body: string;
  images: string[];
  characterIds: ID[];
  sendToAi: boolean;
  anchor?: 'before' | 'after' | ID;
  order: number;
  reading?: string;
  leaderId?: ID;
  fromAssistant?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type LayoutNode =
  | { kind: 'panel'; id: ID }
  | { kind: 'split'; id: ID; dir: 'h' | 'v'; t0: number; t1: number; a: LayoutNode; b: LayoutNode };

export type Shot = 'wide' | 'medium' | 'close' | 'extreme' | 'high' | 'low';

export type Panel = {
  id: ID;
  bleed: boolean;
  borderless: boolean;
  description: string;
  shot?: Shot;
  blockIds: ID[];
  redo?: boolean;
};

export type BubbleType = 'speak' | 'think' | 'shout' | 'whisper' | 'machine' | 'narration' | 'sfx';

export type BubbleFont =
  | 'hand'
  | 'sans'
  | 'sansBold'
  | 'display'
  | 'comic'
  | 'casual'
  | 'rounded'
  | 'marker'
  | 'heavy'
  | 'bubbly'
  | 'playful'
  | 'soft';

export type Bubble = {
  id: ID;
  type: BubbleType;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  tail: { x: number; y: number } | null;
  fontSize: number;
  font: BubbleFont;
  bold: boolean;
  characterId?: ID;
  blockId?: ID;
  narrationStyle?: 'box' | 'inverse' | 'plain';
  sfxStyle?: number;
  skew?: number;
  outline?: number;
  outlineColor?: 'white' | 'black';
  vertical?: boolean;
  color?: string;
  translations?: Record<string, string>;
};

export type EffectType = 'speed' | 'focus' | 'tone' | 'gradient' | 'sparkle';

export type Effect = {
  id: ID;
  panelId: ID;
  type: EffectType;
  density: number;
  angle: number;
  cx: number;
  cy: number;
  opacity: number;
};

export type PageFlag = { note: string; reasons: string[] };

export type Page = {
  id: ID;
  chapterId: ID;
  layout: LayoutNode | null;
  panels: Record<ID, Panel>;
  order?: ID[];
  gutterH: number;
  gutterV: number;
  height?: number;
  done: boolean;
  flag?: PageFlag;
  bubbles: Bubble[];
  effects: Effect[];
  artRev: number;
  updatedAt: number;
};

export type StrokeTool = 'gpen' | 'pencil' | 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill';

export type StrokeTone = { density: number };

export type Stroke = {
  tool: StrokeTool;
  color: string;
  size: number;
  opacity: number;
  points: number[];
  pressure?: boolean;
  tone?: StrokeTone;
};

export type LayerImage = { uri: string; x: number; y: number; w: number; h: number };

export type ArtLayer = {
  id: ID;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  strokes: Stroke[];
  image?: LayerImage;
  /** Which generation of strokes is live. Only the repo and the art store touch this. */
  gen?: number;
  /** Number of live strokes in that generation. */
  head?: number;
};

export type PanelArt = { layers: ArtLayer[]; activeLayerId?: ID };

export type PageStatus = 'empty' | 'paneled' | 'drawing' | 'done';

export type ChapterStatus = 'unwritten' | 'writing' | 'drawing' | 'done';

export type ProjectStatus = 'draft' | 'active' | 'done';

export type StoryData = {
  projects: Record<ID, Project>;
  chapters: Record<ID, Chapter>;
  scenes: Record<ID, Scene>;
  characters: Record<ID, Character>;
  relations: Record<ID, Relation>;
  world: Record<ID, WorldEntry>;
  pages: Record<ID, Page>;
};
