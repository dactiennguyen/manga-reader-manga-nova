import {
  MIN_PITCH_GAP,
  NARRATOR_VOICE,
  ageGroupOf,
  assignVoiceIds,
  characterVoice,
  genderOf,
  lineAt,
  scriptLanguage,
  speakableText,
  spreadPitches,
  tableRead,
  type ScriptSource,
} from '../src/core/studio/tableRead';
import type { Block, Character } from '../src/core/model/types';

function character(id: string, extra: Partial<Character> = {}): Character {
  return {
    id,
    projectId: 'p',
    name: id,
    role: 'support',
    age: '',
    gender: '',
    traits: [],
    goal: '',
    weakness: '',
    voice: '',
    bio: '',
    notes: '',
    appearance: '',
    sheet: { expressions: {} },
    locked: false,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

function source(blocks: Block[], characters: Character[]): ScriptSource {
  return {
    chapters: {
      c1: {
        id: 'c1',
        projectId: 'p',
        title: 'Chapter 1',
        summary: '',
        goal: '',
        characterIds: [],
        sceneIds: ['s1', 's2'],
        pageIds: [],
        createdAt: 0,
        updatedAt: 0,
      },
    },
    scenes: {
      s1: { id: 's1', chapterId: 'c1', description: '', blocks: blocks.slice(0, 2) },
      s2: { id: 's2', chapterId: 'c1', description: '', blocks: blocks.slice(2) },
    },
    characters: Object.fromEntries(characters.map(item => [item.id, item])),
  };
}

const AKI = character('aki', { name: 'Aki', gender: 'girl', age: '16' });
const REN = character('ren', { name: 'Ren', gender: 'Nam', age: '40', role: 'villain', voice: 'giọng trầm, chậm rãi' });

const BLOCKS: Block[] = [
  { id: 'b1', type: 'setting', text: 'A rooftop at night.' },
  { id: 'b2', type: 'dialogue', text: 'Who is there?', characterId: 'aki' },
  { id: 'b3', type: 'sfx', text: 'BOOM' },
  { id: 'b4', type: 'dialogue', text: 'Your **worst** dream.', characterId: 'ren', kind: 'whisper' },
  { id: 'b5', type: 'narration', text: 'She did not run.' },
  { id: 'b6', type: 'dialogue', text: '   ', characterId: 'aki' },
  { id: 'b7', type: 'dialogue', text: 'Hello?' },
];

describe('voices from a profile', () => {
  it('reads gender in English, Vietnamese and Japanese', () => {
    expect(genderOf(character('a', { gender: 'Female' }))).toBe('female');
    expect(genderOf(character('a', { gender: 'nữ' }))).toBe('female');
    expect(genderOf(character('a', { gender: '女性' }))).toBe('female');
    expect(genderOf(character('a', { gender: 'man' }))).toBe('male');
    expect(genderOf(character('a', { gender: 'con trai' }))).toBe('male');
    expect(genderOf(character('a', { gender: '男' }))).toBe('male');
    expect(genderOf(character('a', { gender: 'M' }))).toBe('male');
  });

  it('reads gender in Korean, Chinese, Spanish, Portuguese, Indonesian and Thai', () => {
    const cases: [string, 'female' | 'male'][] = [
      ['여자', 'female'], ['여', 'female'], ['남자', 'male'], ['남', 'male'],
      ['女孩', 'female'], ['妈妈', 'female'], ['哥哥', 'male'], ['國王', 'male'],
      ['mujer', 'female'], ['chico', 'male'], ['mulher', 'female'], ['homem', 'male'],
      ['perempuan', 'female'], ['laki-laki', 'male'], ['ผู้หญิง', 'female'], ['ผู้ชาย', 'male'],
    ];
    for (const [gender, expected] of cases) {
      expect(`${gender} ${genderOf(character('a', { gender }))}`).toBe(`${gender} ${expected}`);
    }
    expect(genderOf(character('a', { bio: 'Ella creció junto al mar y su madre vendía pescado.' }))).toBe('female');
    expect(genderOf(character('a', { bio: 'Dia seorang ayah dan suami yang baik.' }))).toBe('male');
    expect(genderOf(character('a', { bio: '그녀는 바닷가에서 자랐고 엄마는 생선을 팔았다.' }))).toBe('female');
    // 他 hides in 其他, so it is not read: this bio says nothing of the character's gender.
    expect(genderOf(character('a', { bio: '其他人都走了。' }))).toBeNull();
  });

  it('reads age and manner of speaking in the other languages', () => {
    expect(ageGroupOf('niña')).toBe('child');
    expect(ageGroupOf('adolescente')).toBe('teen');
    expect(ageGroupOf('idoso')).toBe('elder');
    expect(ageGroupOf('remaja')).toBe('teen');
    expect(ageGroupOf('노인')).toBe('elder');
    expect(ageGroupOf('中年')).toBe('adult');
    expect(ageGroupOf('小孩')).toBe('child');
    expect(ageGroupOf('วัยรุ่น')).toBe('teen');
    expect(ageGroupOf('ผู้สูงอายุ')).toBe('elder');
    const base = character('a', { gender: 'hombre', age: '30' });
    const plain = characterVoice(base);
    for (const voice of ['voz grave y lenta', 'voz grave, lenta', 'suara berat dan pelan', '낮은 목소리, 느릿느릿', '低沉，说话缓慢', 'เสียงทุ้ม พูดช้า']) {
      const voiced = characterVoice({ ...base, voice });
      expect(`${voice} ${voiced.pitch < plain.pitch} ${voiced.rate < plain.rate}`).toBe(`${voice} true true`);
    }
    for (const voice of ['voz aguda y rápida', 'voz aguda, rápida', '높은 목소리, 빠른 말투', '尖细，语速快', 'เสียงแหลม พูดเร็ว']) {
      const voiced = characterVoice({ ...base, voice });
      expect(`${voice} ${voiced.pitch > plain.pitch} ${voiced.rate > plain.rate}`).toBe(`${voice} true true`);
    }
  });

  it('falls back to the rest of the profile, and stays unknown when it cannot tell', () => {
    expect(genderOf(character('a', { bio: 'She grew up by the sea and her mother sold fish.' }))).toBe('female');
    expect(genderOf(character('a', { voice: "I'm fine, he says." }))).toBe('male');
    expect(genderOf(character('a', { bio: 'A robot.' }))).toBeNull();
    // "woman" is not "man".
    expect(genderOf(character('a', { gender: 'woman' }))).toBe('female');
  });

  it('reads age as a number or words', () => {
    expect(ageGroupOf('9')).toBe('child');
    expect(ageGroupOf('16 tuổi')).toBe('teen');
    expect(ageGroupOf('mid 30s')).toBe('adult');
    expect(ageGroupOf('70歳')).toBe('elder');
    expect(ageGroupOf('very old')).toBe('elder');
    expect(ageGroupOf('học sinh')).toBe('teen');
    expect(ageGroupOf('')).toBeNull();
  });

  it('gives women and children higher voices and villains lower, slower ones', () => {
    const girl = characterVoice(character('a', { gender: 'girl', age: '8' }));
    const woman = characterVoice(character('a', { gender: 'woman', age: '30' }));
    const man = characterVoice(character('a', { gender: 'man', age: '30' }));
    const villain = characterVoice(character('a', { gender: 'man', age: '30', role: 'villain', voice: 'deep and slow' }));
    expect(girl.pitch).toBeGreaterThan(woman.pitch);
    expect(woman.pitch).toBeGreaterThan(man.pitch);
    expect(villain.pitch).toBeLessThan(man.pitch);
    expect(villain.rate).toBeLessThan(man.rate);
    expect(man.gender).toBe('male');
  });
});

describe('spreading pitches', () => {
  it('keeps every voice clear of the narrator and of each other', () => {
    const pitches = spreadPitches([1, 1, 1, 0.86, 0.86, 1.18]);
    const all = [NARRATOR_VOICE.pitch, ...pitches];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(Math.abs(all[i] - all[j])).toBeGreaterThanOrEqual(MIN_PITCH_GAP - 1e-9);
      }
    }
  });

  it('leaves voices that are already apart alone', () => {
    expect(spreadPitches([0.8, 1.2])).toEqual([0.8, 1.2]);
  });
});

describe('a table read of a chapter', () => {
  const lines = tableRead(source(BLOCKS, [AKI, REN]), 'c1');

  it('reads settings and narration as the narrator, skips sound effects and empty lines', () => {
    expect(lines.map(line => line.blockId)).toEqual(['b1', 'b2', 'b4', 'b5', 'b7']);
    expect(lines[0]).toMatchObject({ narrator: true, speaker: null, pitch: 1 });
    expect(lines[3]).toMatchObject({ narrator: true, type: 'narration' });
  });

  it('gives each character a voice and a name, and cleans the text', () => {
    expect(lines[1]).toMatchObject({ speaker: 'Aki', speakerId: 'aki', gender: 'female', narrator: false });
    expect(lines[2]).toMatchObject({ speaker: 'Ren', text: 'Your worst dream.', gender: 'male' });
    expect(lines[1].pitch).toBeGreaterThan(lines[2].pitch);
    // A whisper is slower than Ren talking normally would be.
    expect(lines[2].rate).toBeLessThan(characterVoice(REN).rate);
  });

  it('gives a line with no speaker its own voice, apart from the narrator', () => {
    expect(lines[4]).toMatchObject({ speaker: null, narrator: false });
    expect(Math.abs(lines[4].pitch - NARRATOR_VOICE.pitch)).toBeGreaterThanOrEqual(MIN_PITCH_GAP - 1e-9);
  });

  it('reads sound effects and drops directions when asked', () => {
    const ids = tableRead(source(BLOCKS, [AKI, REN]), 'c1', { sfx: true, directions: false }).map(line => line.blockId);
    expect(ids).toEqual(['b2', 'b3', 'b4', 'b5', 'b7']);
  });

  it('has nothing to read for a missing or empty chapter', () => {
    expect(tableRead(source([], []), 'c1')).toEqual([]);
    expect(tableRead(source(BLOCKS, []), 'nope')).toEqual([]);
  });
});

describe('helpers', () => {
  it('strips markup and drops lines with no letters', () => {
    expect(speakableText('  *Hey*   you ~ ')).toBe('Hey you');
    expect(speakableText('...!!')).toBe('');
    expect(speakableText('！？ 何')).toBe('！？ 何');
  });

  it('finds the language of the script', () => {
    expect(scriptLanguage([{ text: 'Xin chào, tôi là Linh. Rất vui được gặp bạn.' }, { text: 'Ok' }], 'en')).toBe('vi');
    expect(scriptLanguage([{ text: 'こんにちは' }], 'vi')).toBe('ja');
    expect(scriptLanguage([{ text: 'Hello there' }], 'vi')).toBe('en');
    expect(scriptLanguage([], 'ja')).toBe('ja');
    expect(scriptLanguage([{ text: '안녕, 하나야.' }], 'en')).toBe('ko');
    expect(scriptLanguage([{ text: 'สวัสดี' }], 'en')).toBe('th');
    expect(scriptLanguage([{ text: '你迟到了。' }], 'en')).toBe('zh-Hans');
    expect(scriptLanguage([{ text: '你遲到了。' }], 'zh-Hant')).toBe('zh-Hant');
    expect(scriptLanguage([{ text: 'Llegas tarde, Hana.' }], 'es')).toBe('es');
    expect(scriptLanguage([{ text: 'Hello there' }], 'ko')).toBe('en');
  });

  it('reads Spanish and Portuguese accents as Spanish and Portuguese, not Vietnamese', () => {
    expect(scriptLanguage([{ text: '¿Qué pasó?' }], 'es')).toBe('es');
    expect(scriptLanguage([{ text: 'Não, você está atrasado' }], 'pt')).toBe('pt');
    expect(scriptLanguage([{ text: 'Não, você está atrasado' }, { text: 'É verdade, olá!' }], 'pt')).toBe('pt');
    expect(scriptLanguage([{ text: 'Café, señor' }], 'id')).toBe('id');
    // In an interface whose language is not written in Latin letters, plain and accented Latin is English.
    expect(scriptLanguage([{ text: '¿Qué pasó?' }], 'ja')).toBe('en');
    // Vietnamese still shows in its own letters, whatever the interface language.
    expect(scriptLanguage([{ text: 'Trời ơi, muộn rồi!' }], 'pt')).toBe('vi');
  });

  it('reads kanji-only lines as Japanese in Japanese, and with kana around them', () => {
    expect(scriptLanguage([{ text: '東京。' }, { text: '三年後。' }], 'ja')).toBe('ja');
    expect(scriptLanguage([{ text: '贅沢！' }, { text: '躊躇' }, { text: '櫻井' }], 'ja')).toBe('ja');
    expect(scriptLanguage([{ text: '東京。' }, { text: '三年後。' }, { text: 'ただいま' }], 'en')).toBe('ja');
    // A character Japanese never writes makes it Chinese, even in Japanese.
    expect(scriptLanguage([{ text: '你迟到了。' }, { text: '東京。' }], 'ja')).toBe('zh-Hans');
    expect(scriptLanguage([{ text: '你好。' }, { text: '東京。' }], 'zh-Hant')).toBe('zh-Hant');
    // Kanji Japanese also writes, in a Chinese interface, go by its forms and then the interface.
    expect(scriptLanguage([{ text: '三年後。' }], 'zh-Hant')).toBe('zh-Hant');
    expect(scriptLanguage([{ text: '這裡沒有人' }], 'zh-Hans')).toBe('zh-Hant');
    expect(scriptLanguage([{ text: '三年後。' }], 'en')).toBe('zh-Hans');
  });

  it('hands out gendered device voices in turn', () => {
    const voices = [
      { id: 'f1', gender: 'female' },
      { id: 'm1', gender: 'male' },
      { id: 'f2', gender: 'female' },
    ];
    const lines = [
      { speakerId: 'a', gender: 'female' as const },
      { speakerId: 'b', gender: 'female' as const },
      { speakerId: 'a', gender: 'female' as const },
      { speakerId: 'c', gender: 'male' as const },
      { speakerId: 'd', gender: null },
      { speakerId: null, gender: null },
    ];
    expect([...assignVoiceIds(lines, voices)]).toEqual([
      ['a', 'f1'],
      ['b', 'f2'],
      ['c', 'm1'],
    ]);
    expect(assignVoiceIds(lines, []).size).toBe(0);
  });

  it('keeps a line index inside the list', () => {
    expect(lineAt([1, 2, 3], 5)).toBe(2);
    expect(lineAt([1, 2, 3], -1)).toBe(0);
    expect(lineAt([], 3)).toBe(0);
  });
});
