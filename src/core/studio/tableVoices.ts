/**
 * A voice for each character of a table read: a pitch and a rate guessed from the profile (gender, age,
 * role and how they talk), then spread so two rarely sound alike. The profile can be written in any of the
 * app's languages: English, Vietnamese, Spanish, Portuguese and Indonesian words are matched whole, and
 * Japanese, Chinese, Korean and Thai words inside the text (see Keywords).
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

/**
 * `words` are whole words of the languages written with spaces between words, in lower case. `inside` are
 * found anywhere in the text: Japanese, Chinese and Thai have no spaces, and Korean fixes particles to the
 * word (여자는, 여자가). Short ones that hide in longer words are left out (Chinese 他 in 其他, Thai ย่า in อย่า).
 */
type Keywords = { words: string[]; inside: string[] };

const FEMALE: Keywords = {
  words: [
    'female', 'woman', 'women', 'girl', 'she', 'her', 'lady', 'mother', 'mom', 'sister', 'queen', 'princess',
    'wife', 'daughter', 'aunt', 'grandma', 'grandmother', 'feminine', 'heroine', 'witch',
    'nữ', 'cô', 'chị', 'bà', 'mẹ', 'má', 'em gái', 'con gái', 'cô gái', 'thiếu nữ', 'vợ', 'nàng', 'công chúa', 'nữ hoàng',
    // Spanish and Portuguese.
    'mujer', 'chica', 'niña', 'ella', 'señora', 'madre', 'mamá', 'hermana', 'reina', 'princesa', 'esposa', 'hija',
    'tía', 'abuela', 'femenina', 'femenino', 'heroína', 'bruja',
    'mulher', 'menina', 'garota', 'moça', 'ela', 'senhora', 'mãe', 'irmã', 'rainha', 'filha', 'tia', 'avó',
    'feminina', 'bruxa',
    // Indonesian.
    'perempuan', 'wanita', 'gadis', 'cewek', 'ibu', 'nenek', 'ratu', 'putri', 'istri', 'bibi', 'tante',
  ],
  inside: [
    '女', '姉', '妹', '母', '娘', '姫', 'おばあ', '婆', 'ママ',
    '姐', '妈', '媽', '妻', '奶奶', '阿姨', '公主', '她',
    '여자', '여성', '소녀', '엄마', '어머니', '언니', '누나', '할머니', '공주', '여왕', '아내', '그녀',
    'ผู้หญิง', 'หญิง', 'สาว', 'คุณแม่', 'มารดา', 'ราชินี', 'เจ้าหญิง', 'ภรรยา', 'ลูกสาว', 'เธอ',
  ],
};

const MALE: Keywords = {
  words: [
    'male', 'man', 'men', 'boy', 'he', 'his', 'him', 'guy', 'father', 'dad', 'brother', 'king', 'prince',
    'husband', 'son', 'uncle', 'grandpa', 'grandfather', 'masculine', 'hero', 'wizard',
    'nam', 'anh', 'ông', 'bố', 'cha', 'chú', 'cậu', 'trai', 'con trai', 'chàng', 'hắn', 'hoàng tử', 'vua',
    // Spanish and Portuguese.
    'hombre', 'chico', 'niño', 'él', 'señor', 'padre', 'papá', 'hermano', 'rey', 'príncipe', 'esposo', 'marido',
    'hijo', 'tío', 'abuelo', 'masculino', 'héroe', 'brujo',
    'homem', 'menino', 'garoto', 'rapaz', 'ele', 'senhor', 'pai', 'irmão', 'rei', 'filho', 'tio', 'avô', 'herói',
    'bruxo',
    // Indonesian: 'laki-laki' is two words once the hyphen goes.
    'laki laki', 'lelaki', 'pria', 'cowok', 'ayah', 'bapak', 'kakek', 'raja', 'pangeran', 'suami', 'paman', 'putra',
  ],
  inside: [
    '男', '兄', '弟', '父', '息子', '王子', 'おじい', '爺', 'パパ', '少年',
    '哥', '爸', '爷', '丈夫', '儿子', '兒子', '国王', '國王', '叔叔',
    '남자', '남성', '소년', '아빠', '아버지', '오빠', '할아버지', '왕자', '아들', '삼촌', '남편',
    'ผู้ชาย', 'ชาย', 'หนุ่ม', 'พ่อ', 'พี่ชาย', 'น้องชาย', 'ราชา', 'กษัตริย์', 'เจ้าชาย', 'สามี', 'ลูกชาย',
  ],
};

const AGE_WORDS: ({ group: Exclude<AgeGroup, null> } & Keywords)[] = [
  {
    group: 'elder',
    words: [
      'old', 'elderly', 'elder', 'aged', 'ancient', 'grandma', 'grandpa', 'già', 'cụ', 'lão', 'ông lão', 'bà lão',
      'viejo', 'vieja', 'anciano', 'anciana', 'abuelo', 'abuela', 'velho', 'velha', 'idoso', 'idosa', 'avô', 'avó',
      'tua', 'lansia', 'kakek', 'nenek', 'sepuh',
    ],
    inside: ['老', '爺', '婆', '高齢', 'おじい', 'おばあ', '爷爷', '奶奶', '高龄', '노인', '할머니', '할아버지', '노년', 'แก่', 'ชรา', 'สูงอายุ'],
  },
  {
    group: 'child',
    words: [
      'child', 'kid', 'little', 'toddler', 'bé', 'nhí', 'trẻ con', 'em bé',
      'niño', 'niña', 'pequeño', 'pequeña', 'criança', 'pequeno', 'pequena', 'anak', 'balita', 'kecil', 'bocah',
    ],
    inside: ['子供', '子ども', '幼', '孩子', '小孩', '儿童', '兒童', '어린이', '아이', '꼬마', 'เด็ก'],
  },
  {
    group: 'teen',
    words: [
      'teen', 'teenager', 'teenage', 'young', 'youth', 'student', 'thiếu niên', 'thiếu nữ', 'học sinh', 'trẻ',
      'adolescente', 'joven', 'estudiante', 'jovem', 'estudante', 'remaja', 'muda', 'pelajar', 'siswa', 'siswi',
    ],
    inside: ['少年', '少女', '高校', '中学', '若', '学生', '學生', '高中', '初中', '青年', '청소년', '십대', '학생', '소년', '소녀', 'วัยรุ่น', 'นักเรียน'],
  },
  {
    group: 'adult',
    words: ['adult', 'middle', 'grown', 'trung niên', 'người lớn', 'adulto', 'adulta', 'dewasa', 'paruh baya'],
    inside: ['中年', '大人', '成年', '중년', '성인', '어른', 'ผู้ใหญ่', 'วัยกลางคน'],
  },
];

/** How someone talks, from the voice and traits fields. */
const LOW: Keywords = {
  words: [
    'deep', 'low', 'gravelly', 'gruff', 'husky', 'raspy', 'rough', 'trầm', 'khàn', 'ồm',
    'grave', 'profunda', 'profundo', 'ronca', 'ronco', 'rouca', 'rouco', 'áspera', 'áspero', 'berat', 'serak', 'rendah',
  ],
  inside: ['低い', '低音', '渋い', 'ハスキー', '低沉', '沙哑', '沙啞', '浑厚', '渾厚', '낮은', '굵은', '허스키', '걸걸', 'ทุ้ม', 'แหบ', 'เสียงต่ำ'],
};
const HIGH: Keywords = {
  words: [
    'high', 'bright', 'squeaky', 'shrill', 'sweet', 'chirpy', 'giọng cao', 'the thé', 'lanh lảnh',
    'aguda', 'agudo', 'chillona', 'chillón', 'dulce', 'estridente', 'doce', 'melengking', 'cempreng', 'nyaring',
  ],
  inside: ['高い', '高音', '甲高', '尖细', '尖細', '高亢', '清脆', '甜美', '높은', '하이톤', '앳된', 'แหลม', 'เสียงสูง'],
};
const FAST: Keywords = {
  words: [
    'fast', 'quick', 'rapid', 'energetic', 'excitable', 'hyper', 'loud', 'nhanh', 'liến thoắng', 'sôi nổi',
    'rápido', 'rápida', 'enérgico', 'enérgica', 'ruidoso', 'ruidosa', 'agitado', 'agitada', 'barulhento', 'barulhenta',
    'cepat', 'energik', 'bersemangat', 'cerewet',
  ],
  inside: ['早口', '元気', '语速快', '語速快', '急躁', '活泼', '活潑', '话多', '話多', '빠른', '빠르게', '활발', '수다', 'เร็ว', 'ร่าเริง', 'พูดมาก'],
};
const SLOW: Keywords = {
  words: [
    'slow', 'calm', 'measured', 'soft', 'quiet', 'stoic', 'gentle', 'chậm', 'điềm tĩnh', 'nhẹ nhàng', 'từ tốn', 'trầm tĩnh',
    'lento', 'lenta', 'tranquilo', 'tranquila', 'calmado', 'calmada', 'suave', 'callado', 'callada', 'pausado', 'pausada',
    'calmo', 'calma', 'quieto', 'quieta', 'lambat', 'pelan', 'tenang', 'lembut', 'pendiam',
  ],
  inside: [
    'ゆっくり', '落ち着', '穏やか', '静か', '無口', '缓慢', '緩慢', '冷静', '冷靜', '温柔', '溫柔', '安静', '安靜', '沉默',
    '느린', '느릿', '차분', '조용', '과묵', '부드러운', 'ช้าๆ', 'พูดช้า', 'สงบ', 'นุ่มนวล', 'เงียบ', 'ใจเย็น',
  ],
};

function tokens(text: string): string {
  return ` ${text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')} `;
}

/** How many of the words the text has. */
function hits(text: string, list: Keywords): number {
  const padded = tokens(text);
  return list.words.filter(word => padded.includes(` ${word} `)).length + list.inside.filter(word => text.includes(word)).length;
}

function profileText(character: Pick<Character, 'voice' | 'appearance' | 'bio' | 'traits'>): string {
  return [character.voice, character.appearance, character.bio, ...character.traits].join(' \n ');
}

export function genderOf(character: Pick<Character, 'gender' | 'voice' | 'appearance' | 'bio' | 'traits'>): VoiceGender {
  const field = character.gender.trim();
  // A single letter is only read as a gender in the gender field: elsewhere "m" may be from "I'm".
  // Korean forms write 여 and 남, Thai ones ญ and ช.
  if (/^[fm여남ญช]$/i.test(field)) {
    return /^[f여ญ]$/i.test(field) ? 'female' : 'male';
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
