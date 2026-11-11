/**
 * A table read: a chapter's script turned into lines for the device's speech engine, with one voice per
 * character. A voice is a pitch and a rate guessed from the character's profile (gender, age, role and how
 * they talk, in words of any of the app's languages), then nudged so two characters rarely sound alike.
 */
import type { Locale } from '../i18n';
import { LATIN_LOCALES, chineseScript, hanScript, writingOf, type TextScript } from '../lettering/textScript';
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

export const KIND_TONE: Record<DialogueKind, { pitch: number; rate: number }> = {
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

/**
 * The language the script is written in, which may not be the app's: most languages show in their letters
 * (see textScript.ts, which the fonts read too). Chinese lines that could be either form count as the form
 * the other lines show, else as the app's. Han lines Japanese could have written count as Japanese when
 * other lines have kana, as the Chinese of the other lines when there is some, and otherwise by the app's
 * language: Japanese in Japanese, else Chinese. Plain Latin text is read in the app's language when that
 * is written in Latin letters, else as English. With no lines, the app's language.
 */
export function scriptLanguage(lines: Pick<Utterance, 'text'>[], fallback: Locale): Locale {
  if (lines.length === 0) {
    return fallback;
  }
  const counts = new Map<TextScript, number>();
  const add = (script: TextScript, count: number) => counts.set(script, (counts.get(script) ?? 0) + count);
  const han: string[] = [];
  let chinese = 0;
  lines.forEach(line => {
    const writing = writingOf(line.text);
    if (writing === 'han') {
      han.push(line.text);
    } else if (writing === 'zh') {
      chinese += 1;
    } else if (writing) {
      add(writing, 1);
    }
  });
  const hans = counts.get('zh-Hans') ?? 0;
  const hant = counts.get('zh-Hant') ?? 0;
  const form: TextScript = hans + hant > 0 ? (hant > hans ? 'zh-Hant' : 'zh-Hans') : chineseScript(fallback);
  const japanese = counts.has('ja');
  const isChinese = chinese + hans + hant > 0;
  if (chinese > 0) {
    add(form, chinese);
  }
  han.forEach(text => add(japanese ? 'ja' : isChinese ? form : hanScript(text, fallback), 1));
  let top: TextScript | null = null;
  let most = 0;
  for (const [script, count] of counts) {
    if (count > most) {
      top = script;
      most = count;
    }
  }
  return top ?? (LATIN_LOCALES.includes(fallback) ? fallback : 'en');
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
