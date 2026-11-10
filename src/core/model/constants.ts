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
import { msg } from '../i18n';

export const APP_NAME = 'Manganova';

export const GENRES = [
  msg('Action'),
  msg('Adventure'),
  msg('Romance'),
  msg('Comedy'),
  msg('Horror'),
  msg('School'),
  msg('Fantasy'),
  msg('Sci-fi'),
  msg('Slice of life'),
  msg('Mystery'),
  msg('Sports'),
  msg('Historical'),
] as const;

export const ART_STYLES: { id: ArtStyle; label: string; hint: string }[] = [
  { id: 'shounen', label: msg('Shounen'), hint: msg('Bold lines, action') },
  { id: 'shoujo', label: msg('Shoujo'), hint: msg('Fine lines, big eyes, romance') },
  { id: 'seinen', label: msg('Seinen'), hint: msg('Realistic, detailed') },
  { id: 'chibi', label: msg('Chibi'), hint: msg('Big heads, cute') },
  { id: 'horror', label: msg('Horror'), hint: msg('High contrast, deep shadows') },
  { id: 'slice', label: msg('Slice of life'), hint: msg('Soft and minimal') },
];

export const ART_STYLE_LABEL = Object.fromEntries(ART_STYLES.map(s => [s.id, s.label])) as Record<ArtStyle, string>;

export const ROLE_LABEL: Record<CharacterRole, string> = {
  main: msg('Main character'),
  support: msg('Supporting'),
  villain: msg('Villain'),
  extra: msg('Extra'),
};

export const EXPRESSIONS: Expression[] = ['happy', 'sad', 'angry', 'surprised', 'scared', 'shy'];

export const EXPRESSION_LABEL: Record<Expression, string> = {
  happy: msg('Happy'),
  sad: msg('Sad'),
  angry: msg('Angry'),
  surprised: msg('Surprised'),
  scared: msg('Scared'),
  shy: msg('Shy'),
};

export const WORLD_TYPES: WorldType[] = ['place', 'faction', 'term', 'event', 'note'];

export const WORLD_TYPE_LABEL: Record<WorldType, string> = {
  place: msg('Place'),
  faction: msg('Faction'),
  term: msg('Term'),
  event: msg('Event'),
  note: msg('Note'),
};

export const BLOCK_TYPES: BlockType[] = ['setting', 'action', 'dialogue', 'narration', 'sfx'];

export const BLOCK_LABEL: Record<BlockType, string> = {
  setting: msg('Setting'),
  action: msg('Action'),
  dialogue: msg('Dialogue'),
  narration: msg('Narration'),
  sfx: msg('SFX'),
};

export const DIALOGUE_KINDS: DialogueKind[] = ['speak', 'think', 'shout', 'whisper'];

export const DIALOGUE_KIND_LABEL: Record<DialogueKind, string> = {
  speak: msg('says'),
  think: msg('thinks'),
  shout: msg('shouts'),
  whisper: msg('whispers'),
};

export const SHOTS: Shot[] = ['wide', 'medium', 'close', 'extreme', 'high', 'low'];

export const SHOT_LABEL: Record<Shot, string> = {
  wide: msg('Wide'),
  medium: msg('Medium'),
  close: msg('Close-up'),
  extreme: msg('Extreme close-up'),
  high: msg('High angle'),
  low: msg('Low angle'),
};

export const BUBBLE_TYPE_LABEL: Record<BubbleType, string> = {
  speak: msg('Speech'),
  think: msg('Thought'),
  shout: msg('Shout'),
  whisper: msg('Whisper'),
  machine: msg('Machine'),
  narration: msg('Narration'),
  sfx: msg('SFX'),
};

export const EFFECT_LABEL: Record<EffectType, string> = {
  speed: msg('Speed lines'),
  focus: msg('Focus lines'),
  tone: msg('Screentone'),
  gradient: msg('Gradient'),
  sparkle: msg('Sparkles'),
};

export const PAGE_STATUS_LABEL: Record<PageStatus, string> = {
  empty: msg('Empty'),
  paneled: msg('Paneled'),
  drawing: msg('In progress'),
  done: msg('Done'),
};

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  unwritten: msg('Not written'),
  writing: msg('Writing'),
  drawing: msg('Drawing'),
  done: msg('Done'),
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: msg('Draft'),
  active: msg('In progress'),
  done: msg('Completed'),
};

export const DEFAULT_ACT_TITLES = [msg('Act 1 · Setup'), msg('Act 2 · Confrontation'), msg('Act 3 · Resolution')];

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
  msg('A manga page usually has 4 to 6 panels. Use many small panels for action and big ones for emotion.'),
  msg('Place speech bubbles along the reading path: right to left, top to bottom.'),
  msg('End a page on a question so the reader wants to turn it.'),
  msg('Dialogue over 80 characters rarely fits one bubble. Split it in two.'),
  msg('Sketch in pencil on its own layer, then ink on a layer above it.'),
  msg('A bleed panel feels wide open. Save it for an opening shot or a climax.'),
  msg('Give every character their own voice. Read the lines out loud to check.'),
  msg('Speed lines pointing at the center pull the eye straight to the character.'),
  msg('Write the goal of a chapter before its script: what the character wants and what changes.'),
  msg('Alternate close-ups with wide shots to give the page a rhythm.'),
];
