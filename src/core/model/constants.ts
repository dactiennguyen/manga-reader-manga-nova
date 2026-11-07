import type {
  ArtStyle,
  BlockType,
  BubbleType,
  ChapterStatus,
  CharacterRole,
  DialogueKind,
  EffectType,
  Expression,
  PageStatus,
  ProjectStatus,
  Shot,
  WorldType,
} from './types';

export const APP_NAME = 'Mangaka AI';

export const GENRES = [
  'Action',
  'Adventure',
  'Romance',
  'Comedy',
  'Horror',
  'School',
  'Fantasy',
  'Sci-fi',
  'Slice of life',
  'Mystery',
  'Sports',
  'Historical',
] as const;

export const ART_STYLES: { id: ArtStyle; label: string; hint: string }[] = [
  { id: 'shounen', label: 'Shounen', hint: 'Bold lines, action' },
  { id: 'shoujo', label: 'Shoujo', hint: 'Fine lines, big eyes, romance' },
  { id: 'seinen', label: 'Seinen', hint: 'Realistic, detailed' },
  { id: 'chibi', label: 'Chibi', hint: 'Big heads, cute' },
  { id: 'horror', label: 'Horror', hint: 'High contrast, deep shadows' },
  { id: 'slice', label: 'Slice of life', hint: 'Soft and minimal' },
];

export const ART_STYLE_LABEL = Object.fromEntries(ART_STYLES.map(s => [s.id, s.label])) as Record<ArtStyle, string>;

export const ROLE_LABEL: Record<CharacterRole, string> = {
  main: 'Main character',
  support: 'Supporting',
  villain: 'Villain',
  extra: 'Extra',
};

export const EXPRESSIONS: Expression[] = ['happy', 'sad', 'angry', 'surprised', 'scared', 'shy'];

export const EXPRESSION_LABEL: Record<Expression, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  surprised: 'Surprised',
  scared: 'Scared',
  shy: 'Shy',
};

export const WORLD_TYPES: WorldType[] = ['place', 'faction', 'term', 'event', 'note'];

export const WORLD_TYPE_LABEL: Record<WorldType, string> = {
  place: 'Place',
  faction: 'Faction',
  term: 'Term',
  event: 'Event',
  note: 'Note',
};

export const BLOCK_TYPES: BlockType[] = ['setting', 'action', 'dialogue', 'narration', 'sfx'];

export const BLOCK_LABEL: Record<BlockType, string> = {
  setting: 'Setting',
  action: 'Action',
  dialogue: 'Dialogue',
  narration: 'Narration',
  sfx: 'SFX',
};

export const DIALOGUE_KINDS: DialogueKind[] = ['speak', 'think', 'shout', 'whisper'];

export const DIALOGUE_KIND_LABEL: Record<DialogueKind, string> = {
  speak: 'says',
  think: 'thinks',
  shout: 'shouts',
  whisper: 'whispers',
};

export const SHOTS: Shot[] = ['wide', 'medium', 'close', 'extreme', 'high', 'low'];

export const SHOT_LABEL: Record<Shot, string> = {
  wide: 'Wide',
  medium: 'Medium',
  close: 'Close-up',
  extreme: 'Extreme close-up',
  high: 'High angle',
  low: 'Low angle',
};

export const BUBBLE_TYPE_LABEL: Record<BubbleType, string> = {
  speak: 'Speech',
  think: 'Thought',
  shout: 'Shout',
  whisper: 'Whisper',
  machine: 'Machine',
  narration: 'Narration',
  sfx: 'SFX',
};

export const EFFECT_LABEL: Record<EffectType, string> = {
  speed: 'Speed lines',
  focus: 'Focus lines',
  tone: 'Screentone',
  gradient: 'Gradient',
  sparkle: 'Sparkles',
};

export const PAGE_STATUS_LABEL: Record<PageStatus, string> = {
  empty: 'Empty',
  paneled: 'Paneled',
  drawing: 'In progress',
  done: 'Done',
};

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  unwritten: 'Not written',
  writing: 'Writing',
  drawing: 'Drawing',
  done: 'Done',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: 'Draft',
  active: 'In progress',
  done: 'Completed',
};

export const DEFAULT_ACT_TITLES = ['Act 1 · Setup', 'Act 2 · Confrontation', 'Act 3 · Resolution'];

export const LIMITS = {
  projectTitle: 60,
  logline: 200,
  genresPerProject: 3,
  favoriteGenres: 5,
  chapterTitle: 60,
  chapterSummary: 300,
  characterName: 30,
  characterTraits: 8,
  appearance: 400,
  bio: 1000,
  worldImages: 6,
  layers: 8,
  undoSteps: 50,
  scriptVersions: 20,
  longDialogue: 80,
  blocksPerPage: 5,
  trashDays: 30,
} as const;

export const DAILY_TIPS = [
  'A manga page usually has 4 to 6 panels. Use many small panels for action and big ones for emotion.',
  'Place speech bubbles along the reading path: right to left, top to bottom.',
  'End a page on a question so the reader wants to turn it.',
  'Dialogue over 80 characters rarely fits one bubble. Split it in two.',
  'Sketch in pencil on its own layer, then ink on a layer above it.',
  'A bleed panel feels wide open. Save it for an opening shot or a climax.',
  'Give every character their own voice. Read the lines out loud to check.',
  'Speed lines pointing at the center pull the eye straight to the character.',
  'Write the goal of a chapter before its script: what the character wants and what changes.',
  'Alternate close-ups with wide shots to give the page a rhythm.',
];
