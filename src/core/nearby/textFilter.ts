/**
 * Masks offensive words in text other people will see in Play together: names, guesses, the lines of Fill
 * the bubbles and Write together, notes, card text. App Store guideline 1.2 asks apps with user content for
 * "a method for filtering objectionable material"; blocking, reporting and the host removing people cover
 * drawings and voice, this covers typed words.
 *
 * Every phone masks what it receives (schema.ts runs this on every text field of a message, cardSwap.ts and
 * friendLink.ts on cards), so a changed app on the sender's side cannot get around it. The sender's own
 * phone also masks what it sends, so the person sees what the others see.
 *
 * The lists are short on purpose: slurs, sexual words and the strongest swearing, not mild words a manga
 * script uses ("damn", "bastard", "hell"). Matching is by whole word, never inside another word, so
 * "class", "assistant" and "Scunthorpe" are left alone. A masked part is never longer than the original,
 * so a masked message still fits every length limit when the host passes it on.
 */

export const MASK = '•••';

/** Compared without accents, case or common letter swaps (sh1t, a$$), as whole words. */
const WORDS = [
  // English
  'ass',
  'asses',
  'asshole',
  'assholes',
  'dumbass',
  'jackass',
  'arsehole',
  'bullshit',
  'shite',
  'dickhead',
  'dickheads',
  'motherfucker',
  'motherfuckers',
  'motherfucking',
  'cocksucker',
  'cocksuckers',
  'pussy',
  'pussies',
  'dildo',
  'dildos',
  'jizz',
  'porn',
  'porno',
  'nigger',
  'niggers',
  'nigga',
  'niggas',
  'faggot',
  'faggots',
  'retard',
  'retards',
  'retarded',
  'tranny',
  'kike',
  'kikes',
  'rape',
  'raped',
  'raping',
  'rapist',
  'rapists',
  'kys',
  // Spanish
  'puta',
  'putas',
  'puto',
  'putos',
  'pendejo',
  'pendeja',
  'pendejos',
  'cabron',
  'cabrones',
  'joder',
  'jodete',
  'gilipollas',
  'maricon',
  'maricones',
  'verga',
  'chingada',
  'chingar',
  'mierda',
  // Portuguese
  'caralho',
  'foda',
  'foder',
  'fodase',
  'buceta',
  'viado',
  'merda',
  // Indonesian
  'kontol',
  'memek',
  'ngentot',
  'bangsat',
  'jancok',
  'jancuk',
];

/** Words that also count with an ending: fucking, shitty, bitches, wanker. */
const STEMS = ['fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'wank', 'twat'];
const ENDINGS = ['', 's', 'es', 'ed', 'er', 'ers', 'ing', 'in', 'y', 'ie', 'ies', 'ty', 'ted', 'ting', 'ter', 'head', 'heads', 'face', 'hole', 'holes', 'off', 'wit', 'wits'];

/** Several words together, compared like WORDS. */
const PHRASES = ['kill yourself', 'kill urself', 'son of a bitch'];

/**
 * Compared with accents kept, as whole words or words together. Vietnamese needs this: without accents,
 * "cặc" would be "các" (a very common word) and "lồn" would be "lớn". The same words typed without accents
 * are listed only where they cannot be an everyday word.
 */
const ACCENTED = [
  // Vietnamese
  'địt',
  'đụ',
  'đéo',
  'cặc',
  'lồn',
  'buồi',
  'đĩ',
  'đm',
  'đmm',
  'đcm',
  'đkm',
  'dm',
  'dmm',
  'dcm',
  'dkm',
  'vcl',
  'vkl',
  'clgt',
  'dit me',
  'dit con me',
  'du ma',
  // Spanish: without the ñ it is "cono", a cone
  'coño',
];

/** Scripts written without spaces between words: found anywhere in the text. Only words that are never part of an everyday word. */
const ANYWHERE = [
  // Japanese
  '死ね',
  '殺すぞ',
  'くたばれ',
  'おまんこ',
  'ちんぽ',
  'キチガイ',
  'きちがい',
  // Chinese
  '操你妈',
  '操你媽',
  '他妈的',
  '他媽的',
  '傻逼',
  '傻屄',
  '幹你娘',
  '肏',
  '屄',
  // Korean
  '씨발',
  '씨팔',
  '개새끼',
  '좆',
  // Thai
  'เย็ด',
  'ควย',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

const FOLDED_WORDS = new Set<string>([...WORDS, ...STEMS.flatMap(stem => ENDINGS.map(ending => stem + ending))]);
const FOLDED_PHRASES = new Set(PHRASES);
const ACCENTED_SET = new Set(ACCENTED.map(word => word.normalize('NFC')));
const LONGEST_PHRASE = Math.max(...[...PHRASES, ...ACCENTED].map(phrase => phrase.split(' ').length));
const ALL_FOLDED = [...FOLDED_WORDS];

/** A word, with the symbols that stand in for letters; anything else separates words. */
const TOKEN = /[\p{L}\p{M}\p{N}@$*!]+/gu;
const EDGE = /^[!*]+|[!*]+$/g;
const SPECIAL = /[.+?^$()|[\]{}\\]/g;

function lower(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

/** Letters swapped for digits or symbols, only in a word that has real letters: "455" stays a number. */
function unleet(word: string): string {
  if (!/\p{L}/u.test(word)) {
    return word;
  }
  return word.replace(/[013457@$!]/g, char => LEET[char] ?? char);
}

function fold(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

/** fuuuck: a letter said three or more times counts once, or twice (asss). */
function shapes(word: string): string[] {
  const once = word.replace(/(.)\1{2,}/g, '$1');
  const twice = word.replace(/(.)\1{2,}/g, '$1$1');
  return once === word ? [word] : [word, once, twice];
}

/** f*ck, sh*t: a star stands for one letter, when at least two real letters are left. */
function starMatch(word: string): boolean {
  if (!word.includes('*') || word.replace(/\*/g, '').length < 2) {
    return false;
  }
  const pattern = new RegExp(`^${word.replace(SPECIAL, '\\$&').replace(/\*/g, '.')}$`);
  return ALL_FOLDED.some(item => item.length === word.length && pattern.test(item));
}

type Token = { start: number; end: number; plain: string; folded: string };

function tokensOf(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const raw = match[0];
    const lead = raw.length - raw.replace(/^[!*]+/, '').length;
    const core = raw.replace(EDGE, '');
    if (!core) {
      continue;
    }
    const start = (match.index ?? 0) + lead;
    const plain = unleet(lower(core));
    tokens.push({ start, end: start + core.length, plain, folded: fold(plain) });
  }
  return tokens;
}

function badWord(token: Token): boolean {
  if (ACCENTED_SET.has(token.plain)) {
    return true;
  }
  if (token.folded.includes('*')) {
    return starMatch(token.folded);
  }
  return shapes(token.folded).some(shape => FOLDED_WORDS.has(shape));
}

function badPhrase(tokens: Token[]): boolean {
  const plain = tokens.map(token => token.plain).join(' ');
  return ACCENTED_SET.has(plain) || FOLDED_PHRASES.has(tokens.map(token => token.folded).join(' '));
}

/** A masked part keeps at most the original's length. */
function maskFor(length: number): string {
  return length >= MASK.length ? MASK : MASK.slice(0, length);
}

/** The text with every offensive word replaced by •••. Text with none comes back unchanged. */
export function maskText(text: string): string {
  if (!text) {
    return text;
  }
  const tokens = tokensOf(text);
  const spans: { start: number; end: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let size = 0;
    for (let n = Math.min(LONGEST_PHRASE, tokens.length - i); n >= 2 && !size; n--) {
      if (badPhrase(tokens.slice(i, i + n))) {
        size = n;
      }
    }
    if (!size && badWord(tokens[i])) {
      size = 1;
    }
    if (size) {
      spans.push({ start: tokens[i].start, end: tokens[i + size - 1].end });
      i += size - 1;
    }
  }
  let out = text;
  for (let i = spans.length - 1; i >= 0; i--) {
    const { start, end } = spans[i];
    out = out.slice(0, start) + maskFor(end - start) + out.slice(end);
  }
  for (const word of ANYWHERE) {
    if (out.includes(word)) {
      out = out.split(word).join(maskFor(word.length));
    }
  }
  return out;
}

/** True when maskText would change the text. */
export function hasOffensiveWords(text: string): boolean {
  return maskText(text) !== text;
}

/** Masks each line, for lists of lines such as Fill the bubbles. */
export function maskLines(lines: readonly string[]): string[] {
  return lines.map(maskText);
}
