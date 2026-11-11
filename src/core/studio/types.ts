/**
 * Shared shapes for the studio features shown on Home: the journey, badges, gifts, the editor, the reading
 * club, fan mail, the magazine and character cards. Everything here is worked out on the device from the
 * person's own stories and drawing activity. Nothing pretends to be another real person: the editor and the
 * reading club are named characters of the app, the way a mascot is.
 */
import type { StoryRoute } from '../story/resume';
import type { ID } from '../model/types';

/** Counts taken from the stories and the drawing activity. Every rule in the studio reads only these. */
export type Metrics = {
  projects: number;
  projectsDone: number;
  chapters: number;
  /** Chapters with at least one script block. */
  chaptersWritten: number;
  /** Chapters whose pages are all done, with at least one page. */
  chaptersDone: number;
  pages: number;
  pagesDone: number;
  /** Panels with any art in them. */
  panelsDrawn: number;
  bubbles: number;
  sfx: number;
  effects: number;
  characters: number;
  /** Characters with name, role, appearance, goal and at least two traits filled. */
  charactersFull: number;
  relations: number;
  worldEntries: number;
  scriptWords: number;
  dialogueLines: number;
  strokes: number;
  streak: number;
  bestStreak: number;
  /** Days with any drawing. */
  activeDays: number;
  promptsDone: number;
  giftsOpened: number;
};

export type MetricKey = keyof Metrics;

/** Saved on the device under the meta key `studio`. Every field must survive being missing. */
export type StudioState = {
  /** Day key to the id of the daily prompt finished that day. */
  promptDays: Record<string, string>;
  /** Ids of gifts already opened. */
  giftsOpened: string[];
  /** Ids of rewards won from gifts. */
  unlocked: string[];
  /** Gift id to the id of the reward it gave, so an opened gift shows the same reward again. */
  giftRewards: Record<string, string>;
  /** Badges the person has already been shown, so new ones can be announced once. */
  badgesSeen: string[];
  /** Ids of letters already read. */
  mailRead: string[];
  /** Highest journey level already celebrated. */
  levelSeen: number;
  /** The reading club was introduced once. */
  clubIntroSeen: boolean;
  /** Weekday the magazine comes out, 0 Sunday to 6 Saturday. */
  issueWeekday: number;
  /** Day keys on which a Home card was hidden for the day. */
  editorHiddenDay: string;
  chatHiddenDay: string;
  /** Character id to the card frame chosen for that character's card. Missing means the newest won frame. */
  cardFrames: Record<string, string>;
};

export const EMPTY_STUDIO: StudioState = {
  promptDays: {},
  giftsOpened: [],
  unlocked: [],
  giftRewards: {},
  badgesSeen: [],
  mailRead: [],
  levelSeen: 0,
  clubIntroSeen: false,
  issueWeekday: 5,
  editorHiddenDay: '',
  chatHiddenDay: '',
  cardFrames: {},
};

/** A requirement for the next journey level, such as 8 finished pages. `label` is a msg() text with {count}. */
export type Requirement = { metric: MetricKey; count: number; label: string };

export type LevelId = 'rookie' | 'assistant' | 'oneshot' | 'serial' | 'cover' | 'anime';

export const LEVEL_IDS: readonly LevelId[] = ['rookie', 'assistant', 'oneshot', 'serial', 'cover', 'anime'];

export type Level = {
  id: LevelId;
  /** 0 for the first level. */
  index: number;
  /** msg() texts. */
  title: string;
  blurb: string;
  /** What it takes to reach this level. The first level has none. */
  needs: Requirement[];
};

export type LevelProgress = {
  level: Level;
  next: Level | null;
  /** 0 to 1 toward the next level, 1 at the last level. */
  progress: number;
  /** Each requirement of the next level with how much the person has. */
  steps: { need: Requirement; have: number }[];
};

export type BadgeTier = 'bronze' | 'silver' | 'gold';

export type Badge = {
  id: string;
  /** msg() texts. */
  title: string;
  text: string;
  tier: BadgeTier;
  metric: MetricKey;
  count: number;
};

export type RewardKind = 'palette' | 'cardFrame' | 'sfx' | 'bubble' | 'pose';

export type Reward = {
  id: string;
  kind: RewardKind;
  /** msg() text. */
  title: string;
  /** Colours for a palette, a frame id for a card frame, a preset or pose id otherwise. */
  payload: string[];
};

export type Gift = {
  id: string;
  /** msg() text saying what earned it, such as a 7-day streak. */
  reason: string;
};

export type CastId = 'mori' | 'hana' | 'kenta' | 'aiko' | 'daichi' | 'mai' | 'minh' | 'linh' | 'sora' | 'tetsu' | 'yui' | 'bao' | 'rin';

export const READER_IDS: readonly CastId[] = ['hana', 'kenta', 'aiko', 'daichi', 'mai', 'minh', 'linh', 'sora', 'tetsu', 'yui', 'bao', 'rin'];

export type Taste = 'action' | 'romance' | 'mystery' | 'drama' | 'comedy' | 'fantasy' | 'horror' | 'slice' | 'art' | 'dialogue' | 'pacing';

export type CastMember = {
  id: CastId;
  /** A name, the same in every language. */
  name: string;
  /** msg() texts. */
  role: string;
  bio: string;
  tastes: Taste[];
  /** 1 kind to 3 hard to please. */
  strictness: 1 | 2 | 3;
};

/** Why the editor says what it says today, so Home can style the note or offer a fitting button. */
export type EditorSituation =
  | 'welcome'
  | 'absence'
  | 'levelUp'
  | 'streakRisk'
  | 'streakKept'
  | 'streakBroken'
  | 'chapterDone'
  | 'storyDone'
  | 'flagged'
  | 'noChapters'
  | 'noScript'
  | 'scriptNoPages'
  | 'pagesLeft'
  | 'allDone';

/** What the editor says on Home today. `situation` is 'welcome' when there is no story yet (offer New story then). */
export type EditorNote = { text: string; action?: { label: string; route: StoryRoute }; situation?: EditorSituation };

/** A short message from one of the person's own characters. */
export type CharacterMessage = { characterId: ID; projectId: ID; text: string; route: StoryRoute };

export type DailyPrompt = {
  id: string;
  kind: 'draw' | 'write';
  text: string;
  projectId?: ID;
  characterId?: ID;
  route?: StoryRoute;
};

export type Vote = { readerId: CastId; score: 1 | 2 | 3 | 4 | 5; comment: string };

export type ChapterReview = {
  chapterId: ID;
  votes: Vote[];
  /** Mean score, one decimal. */
  average: number;
  /** One sentence summing the club up. */
  headline: string;
};

export type RankedChapter = { chapterId: ID; projectId: ID; average: number; rank: number };

export type Letter = {
  id: string;
  fromId: CastId;
  subject: string;
  body: string;
  chapterId?: ID;
  /** When it arrived, in ms. Derived from the story, so the same letter keeps its date. */
  at: number;
};

export type Rarity = 'common' | 'rare' | 'epic' | 'legend';

export type CharacterCard = {
  characterId: ID;
  /** 1 to 99 each. */
  stats: { power: number; wit: number; charm: number; heart: number };
  rarity: Rarity;
  /** A line in the character's voice, from their profile. */
  quote: string;
  /** A card frame id: 'plain' unless a frame reward is unlocked and chosen. */
  frame: string;
};

export type Issue = {
  /** Counts up from 1, one more on each issue weekday since the first story was made. */
  number: number;
  /** A page to use as the cover, or null when nothing is drawn yet. */
  coverPageId: ID | null;
  /** Chapters worked on this week, best ranked first. */
  contents: { chapterId: ID; projectId: ID }[];
  /** Day key of the next issue, and days until then. */
  nextDay: string;
  daysLeft: number;
};

export type ProgressPair = {
  firstPageId: ID | null;
  latestPageId: ID | null;
  daysBetween: number;
  /** A page from about a week, month or year ago today, if there is one. */
  memory: { pageId: ID; daysAgo: number } | null;
};
