import { TRANSLATED_LOCALES } from '../src/core/i18n';
import { localeParts } from '../src/core/i18n/locales';
import { readCardBlob, cardBlob, type CardPayload } from '../src/core/nearby/cardSwap';
import { friendLink, parseFriendLink } from '../src/core/nearby/friendLink';
import { parseRoomLink, roomLink } from '../src/core/nearby/link';
import { parseEnvelope } from '../src/core/nearby/schema';
import { maskStoryText } from '../src/core/nearby/storyText';
import type { StoryData } from '../src/core/model/types';
import { MASK, hasOffensiveWords, maskText } from '../src/core/nearby/textFilter';
import type { Message } from '../src/core/nearby/types';
import { GUESS_WORDS } from '../src/features/nearby/guess/guessWords';

const line = (m: Message, from?: string) => JSON.stringify(from ? { m, from } : { m });
const parsed = (m: Message) => {
  const result = parseEnvelope(line(m));
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`);
  }
  return result.envelope.m;
};

describe('maskText', () => {
  it('masks offensive words, keeping the rest of the text', () => {
    expect(maskText('what the fuck is this')).toBe(`what the ${MASK} is this`);
    expect(maskText('You are an asshole!')).toBe(`You are an ${MASK}!`);
    expect(maskText('shit, that hurt')).toBe(`${MASK}, that hurt`);
    expect(maskText('Stop it, bitch.')).toBe(`Stop it, ${MASK}.`);
  });

  it('ignores case, accents, endings and common letter swaps', () => {
    for (const word of ['FUCK', 'Fucking', 'fucker', 'fück', 'f*ck', 'f**k', 'fuuuuck', 'sh1t', 'sh!t', '5h1t', 'shitty', 'bitches', 'a$$hole', 'motherfucker', 'cunts']) {
      expect(maskText(word)).toBe(MASK);
    }
    expect(maskText('asss')).toBe(MASK);
  });

  it('masks Vietnamese with and without accents', () => {
    expect(maskText('địt mẹ mày')).toBe(`${MASK} mẹ mày`);
    expect(maskText('Đéo biết')).toBe(`${MASK} biết`);
    expect(maskText('đồ cặc')).toBe(`đồ ${MASK}`);
    expect(maskText('vcl luôn')).toBe(`${MASK} luôn`);
    expect(maskText('dit me may')).toBe(`${MASK} may`);
    expect(maskText('ĐM')).toBe('••');
    // Typed with combining accents (NFD) still matches.
    expect(maskText('cặc'.normalize('NFD'))).toBe(MASK);
  });

  it('masks a few words in the app’s other languages', () => {
    expect(maskText('お前、死ね')).toBe(`お前、••`);
    expect(maskText('你是傻逼吗')).toBe('你是••吗');
    expect(maskText('씨발 진짜')).toBe('•• 진짜');
    expect(maskText('¡Qué puta mierda!')).toBe(`¡Qué ${MASK} ${MASK}!`);
    expect(maskText('Que porra, caralho')).toBe(`Que porra, ${MASK}`);
    expect(maskText('dasar kontol')).toBe(`dasar ${MASK}`);
    expect(maskText('coño')).toBe(MASK);
  });

  it('leaves everyday words alone (no Scunthorpe problem)', () => {
    const fine = [
      'class',
      'assistant',
      'Scunthorpe',
      'bass',
      'passion',
      'assess the assassin',
      'Sussex',
      'cocktail',
      'peacock',
      'Dickens',
      'therapist',
      'grape',
      'skyscraper',
      'shiitake',
      'rapped',
      'pussycat',
      'hello world',
      'Mississippi',
      '455',
      '1337',
      'cono de helado',
      'porra',
      // Vietnamese words that lose their accents into something else
      'đức',
      'nước Đức',
      'cực kỳ',
      'cực',
      'các bạn',
      'buổi sáng',
      'lớn lên',
      'cái lớn',
      'cụm từ',
      'du lịch',
      'dù mẹ nói',
      'đeo kính',
      'con cá',
      'đít',
      'dái tai',
      'đi đâu',
      // Other scripts
      '始発',
      '시발점',
      '操作',
      'わたしね',
      'กล่องหีบ',
    ];
    for (const text of fine) {
      expect(maskText(text)).toBe(text);
    }
  });

  it('never masks a word to draw in Guess the drawing, in any language', () => {
    const answers = GUESS_WORDS.flatMap(key => key.split('|'));
    for (const locale of TRANSLATED_LOCALES) {
      Object.values(localeParts(locale).guessWords).forEach(value => answers.push(...value.split('|')));
    }
    expect(answers.filter(hasOffensiveWords)).toEqual([]);
  });

  it('never makes text longer, and masking twice changes nothing', () => {
    for (const text of ['dm', 'fuck', 'shit happens', '肏', 'vcl', 'x'.repeat(78) + 'dm']) {
      const once = maskText(text);
      expect(once.length).toBeLessThanOrEqual(text.length);
      expect(maskText(once)).toBe(once);
    }
    expect(maskText('')).toBe('');
  });
});

describe('what arrives from other phones is masked', () => {
  it('masks names, guesses, lines and notes as a message is read', () => {
    expect(parsed({ t: 'hello', v: 3, token: 'abcd', name: 'Fuck Face', app: 'x' })).toMatchObject({ name: `${MASK} Face` });
    expect(parsed({ t: 'guess.try', turn: 0, text: 'shit' })).toMatchObject({ text: MASK });
    expect(parsed({ t: 'guess.miss', turn: 0, member: 'a', text: 'bitch' })).toMatchObject({ text: MASK });
    expect(parsed({ t: 'fill.lines', turn: 0, id: 'v1', lines: ['hi', 'fuck you'] })).toMatchObject({ lines: ['hi', `${MASK} you`] });
    expect(parsed({ t: 'fill.reveal', turn: 0, at: 0, versions: [{ id: 'v1', lines: ['cunt'] }] })).toMatchObject({ versions: [{ id: 'v1', lines: [MASK] }] });
    expect(parsed({ t: 'script.edit', key: 'b:1', text: 'You asshole' })).toMatchObject({ text: `You ${MASK}` });
    expect(parsed({ t: 'script.apply', by: 'a', op: { t: 'script.edit', key: 'b:1', text: 'shit' } })).toMatchObject({ op: { text: MASK } });
    expect(
      parsed({ t: 'read.note', from: 'a', pageId: 'p', panelId: null, x: 0, y: 0, sticker: 'love', text: 'đụ' }),
    ).toMatchObject({ text: MASK.slice(0, 2) });
    expect(parsed({ t: 'battle.start', prompt: 'draw a dildo', seconds: 60, startsAt: 0 })).toMatchObject({ prompt: `draw a ${MASK}` });
    expect(parsed({ t: 'send.offer', from: 'a', blobId: 'b', title: 'Porn', bytes: 1 })).toMatchObject({ title: MASK });
    expect(parsed({ t: 'brushes.offer', from: 'a', blobId: 'b', name: 'slut pens', brushes: 1, tones: 0 })).toMatchObject({ name: `${MASK} pens` });
  });

  it('masks the room and member names in the room state', () => {
    const room = { roomId: 'r', name: 'Nigga room', members: [{ id: 'a', name: 'Mai', color: 0, host: true }, { id: 'b', name: 'shithead', color: 1, host: false }], activity: 'lobby' as const, options: {} };
    expect(parsed({ t: 'room', room })).toMatchObject({ room: { name: `${MASK} room`, members: [{ name: 'Mai' }, { name: MASK }] } });
  });

  it('masks the shared script', () => {
    const doc = {
      chapterId: 'c',
      title: 'Fuck it',
      characters: [{ id: 'k', name: 'Bitch' }],
      scenes: [{ id: 's', description: 'shit happens', blocks: [{ id: 'b', type: 'action' as const, text: 'cunt' }] }],
    };
    expect(parsed({ t: 'script.doc', doc, rev: 0, locks: {} })).toMatchObject({
      doc: { title: `${MASK} it`, characters: [{ name: MASK }], scenes: [{ description: `${MASK} happens`, blocks: [{ text: MASK }] }] },
    });
  });

  it('masks cards, mangaka cards and room links', () => {
    const payload: CardPayload = {
      card: { v: 1, key: 'me:c1', name: 'Hana', role: 'main', story: 'Shit Story', stats: { power: 5, wit: 5, charm: 5, heart: 5 }, rarity: 'common', quote: 'You bitch', frame: 'basic', owner: 'asshole' },
    };
    expect(readCardBlob(cardBlob(payload))?.card).toMatchObject({ name: 'Hana', story: `${MASK} Story`, quote: `You ${MASK}`, owner: MASK });
    const friend = parseFriendLink(friendLink({ id: 'abcd1234', name: 'Cunt', stories: ['Bullshit'], room: { host: '10.0.0.2', port: 4000, token: 'abcd', name: 'whore house' } }));
    expect(friend).toMatchObject({ name: MASK, stories: [MASK], room: { name: `${MASK} house` } });
    expect(parseRoomLink(roomLink({ host: '10.0.0.2', port: 4000, token: 'abcd', name: 'fuck' }))?.name).toBe(MASK);
  });
});

describe('a story from someone else', () => {
  const story = {
    projects: { p: { id: 'p', title: 'Shit Story', logline: 'A kind tale', acts: [{ id: 'a', title: 'Act one', chapterIds: ['c'] }] } },
    chapters: { c: { id: 'c', projectId: 'p', title: 'Chapter 1', summary: 'fuck this', goal: '' }, other: { id: 'other', projectId: 'q', title: 'fuck', summary: '', goal: '' } },
    scenes: { s: { id: 's', chapterId: 'c', description: 'Rain', blocks: [{ id: 'b', type: 'dialogue', text: 'You bitch' }, { id: 'b2', type: 'action', text: 'She runs' }] } },
    characters: { k: { id: 'k', projectId: 'p', name: 'Hana', traits: ['kind', 'asshole'], bio: '', age: '', gender: '', goal: '', weakness: '', voice: '', notes: '', appearance: '' } },
    relations: {},
    world: {},
    pages: { g: { id: 'g', chapterId: 'c', panels: { x: { id: 'x', description: 'a cunt' } }, bubbles: [{ id: 'u', text: 'Hi!' }, { id: 'v', text: 'shut up, slut' }] } },
  } as unknown as StoryData;

  it('has only the changed rows of that story, masked', () => {
    const masked = maskStoryText(story, 'p');
    expect(masked.projects?.p.title).toBe(`${MASK} Story`);
    expect(masked.projects?.p.logline).toBe('A kind tale');
    expect(Object.keys(masked.chapters ?? {})).toEqual(['c']);
    expect(masked.chapters?.c.summary).toBe(`${MASK} this`);
    expect(masked.scenes?.s.blocks.map(block => block.text)).toEqual([`You ${MASK}`, 'She runs']);
    expect(masked.characters?.k.traits).toEqual(['kind', MASK]);
    expect(masked.pages?.g.bubbles.map(bubble => bubble.text)).toEqual(['Hi!', `shut up, ${MASK}`]);
    expect(masked.pages?.g.panels.x.description).toBe(`a ${MASK}`);
  });

  it('changes nothing in a clean story', () => {
    const clean = maskStoryText(mergeAll(story, maskStoryText(story, 'p')), 'p');
    expect(Object.values(clean).every(rows => Object.keys(rows).length === 0)).toBe(true);
  });
});

function mergeAll(base: StoryData, patch: Partial<StoryData>): StoryData {
  const out = { ...base } as Record<string, Record<string, unknown>>;
  for (const [table, rows] of Object.entries(patch)) {
    out[table] = { ...out[table], ...rows };
  }
  return out as unknown as StoryData;
}
