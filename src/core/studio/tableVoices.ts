/**
 * A voice for each character of a table read: a pitch and a rate guessed from the profile (gender, age,
 * role and how they talk, in English, Vietnamese or Japanese words), then spread so two rarely sound alike.
 */
import type { Character } from '../model/types';
import { ageYears } from './castUtil';

export type VoiceGender = 'female' | 'male' | null;

export type AgeGroup = 'child' | 'teen' | 'adult' | 'elder' | null;

export type VoiceProfile = { pitch: number; rate: number; gender: VoiceGender };

export const NARRATOR_VOICE: VoiceProfile = { pitch: 1, rate: 1, gender: null };

export const PITCH_RANGE = { min: 0.6, max: 1.6 } as const;
export const RATE_RANGE = { min: 0.75, max: 1.25 } as const;

/** Two voices closer than this in pitch are hard to tell apart. */
export const MIN_PITCH_GAP = 0.06;
const NUDGE = 0.07;
const NUDGE_STEPS = 8;

/** Whole words for Latin scripts, in lower case. Japanese has no spaces, so its words are matched inside the text. */
const FEMALE = {
  words: [
    'female', 'woman', 'women', 'girl', 'she', 'her', 'lady', 'mother', 'mom', 'sister', 'queen', 'princess',
    'wife', 'daughter', 'aunt', 'grandma', 'grandmother', 'feminine', 'heroine', 'witch',
    'nữ', 'cô', 'chị', 'bà', 'mẹ', 'má', 'em gái', 'con gái', 'cô gái', 'thiếu nữ', 'vợ', 'nàng', 'công chúa', 'nữ hoàng',
  ],
  ja: ['女', '姉', '妹', '母', '娘', '姫', 'おばあ', '婆', 'ママ'],
};

const MALE = {
  words: [
    'male', 'man', 'men', 'boy', 'he', 'his', 'him', 'guy', 'father', 'dad', 'brother', 'king', 'prince',
    'husband', 'son', 'uncle', 'grandpa', 'grandfather', 'masculine', 'hero', 'wizard',
    'nam', 'anh', 'ông', 'bố', 'cha', 'chú', 'cậu', 'trai', 'con trai', 'chàng', 'hắn', 'hoàng tử', 'vua',
  ],
  ja: ['男', '兄', '弟', '父', '息子', '王子', 'おじい', '爺', 'パパ', '少年'],
};

const AGE_WORDS: { group: Exclude<AgeGroup, null>; words: string[]; ja: string[] }[] = [
  { group: 'elder', words: ['old', 'elderly', 'elder', 'aged', 'ancient', 'grandma', 'grandpa', 'già', 'cụ', 'lão', 'ông lão', 'bà lão'], ja: ['老', '爺', '婆', '高齢', 'おじい', 'おばあ'] },
  { group: 'child', words: ['child', 'kid', 'little', 'toddler', 'bé', 'nhí', 'trẻ con', 'em bé'], ja: ['子供', '子ども', '幼'] },
  { group: 'teen', words: ['teen', 'teenager', 'teenage', 'young', 'youth', 'student', 'thiếu niên', 'thiếu nữ', 'học sinh', 'trẻ'], ja: ['少年', '少女', '高校', '中学', '若'] },
  { group: 'adult', words: ['adult', 'middle', 'grown', 'trung niên', 'người lớn'], ja: ['中年', '大人'] },
];

/** How someone talks, from the voice and traits fields. */
const LOW = { words: ['deep', 'low', 'gravelly', 'gruff', 'husky', 'raspy', 'rough', 'trầm', 'khàn', 'ồm'], ja: ['低い', '低音', '渋い', 'ハスキー'] };
const HIGH = { words: ['high', 'bright', 'squeaky', 'shrill', 'sweet', 'chirpy', 'giọng cao', 'the thé', 'lanh lảnh'], ja: ['高い', '高音', '甲高'] };
const FAST = { words: ['fast', 'quick', 'rapid', 'energetic', 'excitable', 'hyper', 'loud', 'nhanh', 'liến thoắng', 'sôi nổi'], ja: ['早口', '元気'] };
const SLOW = { words: ['slow', 'calm', 'measured', 'soft', 'quiet', 'stoic', 'gentle', 'chậm', 'điềm tĩnh', 'nhẹ nhàng', 'từ tốn', 'trầm tĩnh'], ja: ['ゆっくり', '落ち着', '穏やか', '静か', '無口'] };

function tokens(text: string): string {
  return ` ${text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')} `;
}

/** How many of the words the text has. */
function hits(text: string, list: { words: string[]; ja: string[] }): number {
  const padded = tokens(text);
  return list.words.filter(word => padded.includes(` ${word} `)).length + list.ja.filter(word => text.includes(word)).length;
}

function profileText(character: Pick<Character, 'voice' | 'appearance' | 'bio' | 'traits'>): string {
  return [character.voice, character.appearance, character.bio, ...character.traits].join(' \n ');
}

export function genderOf(character: Pick<Character, 'gender' | 'voice' | 'appearance' | 'bio' | 'traits'>): VoiceGender {
  const field = character.gender.trim();
  // A single letter is only read as a gender in the gender field: elsewhere "m" may be from "I'm".
  if (/^f$/i.test(field) || /^m$/i.test(field)) {
    return /^f/i.test(field) ? 'female' : 'male';
  }
  if (field) {
    const female = hits(field, FEMALE);
    const male = hits(field, MALE);
    if (female !== male) {
      return female > male ? 'female' : 'male';
    }
  }
  // No clear gender field: count the pronouns and words in the rest of the profile.
  const rest = profileText(character);
  const female = hits(rest, FEMALE);
  const male = hits(rest, MALE);
  return female === male ? null : female > male ? 'female' : 'male';
}

export function ageGroupOf(age: string): AgeGroup {
  const years = ageYears(age);
  if (years !== null) {
    return years < 13 ? 'child' : years < 20 ? 'teen' : years < 55 ? 'adult' : 'elder';
  }
  return AGE_WORDS.find(entry => hits(age, entry) > 0)?.group ?? null;
}

export const clamp = (value: number, range: { min: number; max: number }) => Math.min(range.max, Math.max(range.min, value));
export const round = (value: number) => Math.round(value * 100) / 100;

/** The voice a character's profile suggests, before it is spread from the rest of the cast. */
export function characterVoice(
  character: Pick<Character, 'gender' | 'age' | 'role' | 'voice' | 'appearance' | 'bio' | 'traits'>,
): VoiceProfile {
  const gender = genderOf(character);
  const age = ageGroupOf(character.age);
  let pitch = gender === 'female' ? 1.18 : gender === 'male' ? 0.86 : 1;
  let rate = 1;
  pitch += age === 'child' ? 0.22 : age === 'teen' ? 0.08 : age === 'elder' ? -0.1 : 0;
  rate += age === 'child' ? 0.05 : age === 'elder' ? -0.08 : 0;
  if (character.role === 'villain') {
    pitch -= 0.06;
    rate -= 0.05;
  }
  // Pitch words come from the voice field only: in traits, "cao" or "low" more often mean tall or down.
  const sound = character.voice;
  pitch += hits(sound, LOW) > hits(sound, HIGH) ? -0.1 : hits(sound, HIGH) > hits(sound, LOW) ? 0.1 : 0;
  const manner = [character.voice, ...character.traits].join(' \n ');
  rate += hits(manner, FAST) > hits(manner, SLOW) ? 0.08 : hits(manner, SLOW) > hits(manner, FAST) ? -0.08 : 0;
  return { pitch: round(clamp(pitch, PITCH_RANGE)), rate: round(clamp(rate, RATE_RANGE)), gender };
}

/** Moves each pitch the least it takes to stay clear of the narrator and of the speakers before it. */
export function spreadPitches(bases: number[], taken: number[] = [NARRATOR_VOICE.pitch]): number[] {
  const used = [...taken];
  return bases.map(base => {
    for (let step = 0; step <= NUDGE_STEPS; step++) {
      const offset = step === 0 ? 0 : Math.ceil(step / 2) * NUDGE * (step % 2 === 1 ? 1 : -1);
      const pitch = round(clamp(base + offset, PITCH_RANGE));
      if (used.every(other => Math.abs(other - pitch) >= MIN_PITCH_GAP - 1e-9)) {
        used.push(pitch);
        return pitch;
      }
    }
    used.push(base);
    return base;
  });
}
