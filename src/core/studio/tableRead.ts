/**
 * A table read: a chapter's script turned into lines for the device's speech engine, with one voice per
 * character. A voice is a pitch and a rate guessed from the character's profile (gender, age, role and how
 * they talk, in English, Vietnamese or Japanese words), then nudged so two characters rarely sound alike.
 */
import type { Locale } from '../i18n';
import { scriptOf } from '../lettering/fonts';
import type { Block, BlockType, Character, DialogueKind, ID, StoryData } from '../model/types';
import {
  NARRATOR_VOICE,
  PITCH_RANGE,
  RATE_RANGE,
  characterVoice,
  clamp,
  round,
  spreadPitches,
  type VoiceGender,
  type VoiceProfile,
} from './tableVoices';

export * from './tableVoices';

export type Utterance = {
  blockId: ID;
  type: BlockType;
  /** The narrator reads narration, and settings, actions and sound effects when they are read. */
  narrator: boolean;
  /** The character speaking, or null for the narrator and for a line with no character set. */
  speakerId: ID | null;
  speaker: string | null;
  text: string;
  /** 1 is the engine's normal pitch and rate. */
  pitch: number;
  rate: number;
  gender: VoiceGender;
};

export type TableReadOptions = {
  /** Read settings and actions in the narrator's voice. On by default, like an audiobook. */
  directions?: boolean;
  /** Read sound effects. Off by default: "BOOM" read aloud sounds flat. */
  sfx?: boolean;
};

/** A line with no speaker set gets its own voice too, keyed by this id. */
export const UNKNOWN_SPEAKER = '?';

/** Voices for the speakers in the order they first talk. */
export function castVoices(speakers: (Character | null)[]): Map<ID, VoiceProfile> {
  const profiles = speakers.map(character => (character ? characterVoice(character) : { ...NARRATOR_VOICE }));
  const pitches = spreadPitches(profiles.map(profile => profile.pitch));
  const voices = new Map<ID, VoiceProfile>();
  speakers.forEach((character, index) => {
    voices.set(character?.id ?? UNKNOWN_SPEAKER, { ...profiles[index], pitch: pitches[index] });
  });
  return voices;
}

/** Speech engines read symbols aloud or choke on them, so markup goes and spaces collapse. */
export function speakableText(text: string): string {
  const clean = text.replace(/[*_#~`|<>[\]{}]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /[\p{L}\p{N}]/u.test(clean) ? clean : '';
}

const KIND_TONE: Record<DialogueKind, { pitch: number; rate: number }> = {
  speak: { pitch: 0, rate: 1 },
  think: { pitch: -0.02, rate: 0.94 },
  shout: { pitch: 0.05, rate: 1.06 },
  whisper: { pitch: -0.03, rate: 0.9 },
};

export type ScriptSource = Pick<StoryData, 'chapters' | 'scenes' | 'characters'>;

export function chapterBlocks(state: ScriptSource, chapterId: ID): Block[] {
  const chapter = state.chapters[chapterId];
  return chapter ? chapter.sceneIds.flatMap(id => state.scenes[id]?.blocks ?? []) : [];
}

function wanted(block: Block, options: TableReadOptions): boolean {
  if (block.type === 'sfx') {
    return !!options.sfx;
  }
  if (block.type === 'setting' || block.type === 'action') {
    return options.directions !== false;
  }
  return true;
}

/** The chapter's script as lines to read, in order. Empty when the chapter has nothing to read. */
export function tableRead(state: ScriptSource, chapterId: ID, options: TableReadOptions = {}): Utterance[] {
  const blocks = chapterBlocks(state, chapterId).filter(block => wanted(block, options) && speakableText(block.text));
  const speakers: (Character | null)[] = [];
  const seen = new Set<ID>();
  for (const block of blocks) {
    if (block.type !== 'dialogue') {
      continue;
    }
    const character = block.characterId ? state.characters[block.characterId] ?? null : null;
    const key = character?.id ?? UNKNOWN_SPEAKER;
    if (!seen.has(key)) {
      seen.add(key);
      speakers.push(character);
    }
  }
  const voices = castVoices(speakers);
  return blocks.map(block => {
    const text = speakableText(block.text);
    if (block.type !== 'dialogue') {
      const rate = block.type === 'sfx' ? 1.1 : NARRATOR_VOICE.rate;
      return { blockId: block.id, type: block.type, narrator: true, speakerId: null, speaker: null, text, pitch: NARRATOR_VOICE.pitch, rate, gender: null };
    }
    const character = block.characterId ? state.characters[block.characterId] ?? null : null;
    const voice = voices.get(character?.id ?? UNKNOWN_SPEAKER) ?? NARRATOR_VOICE;
    const tone = KIND_TONE[block.kind ?? 'speak'];
    return {
      blockId: block.id,
      type: block.type,
      narrator: false,
      speakerId: character?.id ?? null,
      speaker: character?.name.trim() || null,
      text,
      pitch: round(clamp(voice.pitch + tone.pitch, PITCH_RANGE)),
      rate: round(clamp(voice.rate * tone.rate, RATE_RANGE)),
      gender: voice.gender,
    };
  });
}

/** Tone marks: French has some of them too, but English text almost never does. */
const VIETNAMESE_MARKS = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * The language the script is written in, which may not be the app's: Japanese and Vietnamese show in their
 * letters, and plain Latin text is read as English. With nothing to go on, the app's language.
 */
export function scriptLanguage(lines: Pick<Utterance, 'text'>[], fallback: Locale): Locale {
  if (lines.length === 0) {
    return fallback;
  }
  const counts = { ja: 0, vi: 0, other: 0 };
  lines.forEach(line => {
    const script = scriptOf(line.text) ?? (VIETNAMESE_MARKS.test(line.text.normalize('NFC')) ? 'vi' : 'other');
    counts[script] += 1;
  });
  if (counts.ja === 0 && counts.vi === 0) {
    return 'en';
  }
  return counts.ja >= counts.vi ? 'ja' : 'vi';
}

/** The line to start from or move to, kept inside the list. */
export function lineAt(lines: readonly unknown[], index: number): number {
  return lines.length === 0 ? 0 : Math.min(lines.length - 1, Math.max(0, index));
}

/**
 * Device voices for the speakers whose gender is known, taken in turn from the voices of that gender so
 * two such characters get different voices while there are enough. The rest keep the system voice, told
 * apart by pitch. Voices come best first.
 */
export function assignVoiceIds(
  lines: Pick<Utterance, 'speakerId' | 'gender'>[],
  voices: { id: string; gender: string }[],
): Map<ID, string> {
  const byGender = {
    female: voices.filter(voice => voice.gender === 'female'),
    male: voices.filter(voice => voice.gender === 'male'),
  };
  const used = { female: 0, male: 0 };
  const result = new Map<ID, string>();
  for (const line of lines) {
    if (!line.speakerId || !line.gender || result.has(line.speakerId)) {
      continue;
    }
    const pool = byGender[line.gender];
    if (pool.length > 0) {
      result.set(line.speakerId, pool[used[line.gender] % pool.length].id);
      used[line.gender] += 1;
    }
  }
  return result;
}
