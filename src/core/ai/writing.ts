import { LIMITS } from '../model/constants';
import type { Block, BlockType, Character, DialogueKind, ID } from '../model/types';
import { AiError, chat, type AiMessage } from './port';
import { askJson } from './story';

export type BlockDraft = {
  type: BlockType;
  text: string;
  characterId?: ID;
  characterName?: string;
  kind?: DialogueKind;
};

const WRITER =
  'You are a manga scriptwriter helping an author with their own story. Match the tone, language and names already used in the script. Answer with JSON only: no markdown fences, no commentary.';

const BLOCK_TYPES: BlockType[] = ['setting', 'action', 'dialogue', 'narration', 'sfx'];
const KINDS: DialogueKind[] = ['speak', 'think', 'shout', 'whisper'];
const FORMAT_ERROR = 'The AI answer was not in the expected format. Try again.';

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '';
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

export function matchCharacter(name: string, characters: Character[]): Character | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) {
    return undefined;
  }
  return (
    characters.find(item => item.name.trim().toLowerCase() === wanted) ??
    characters.find(item => wanted.includes(item.name.trim().toLowerCase()) && item.name.trim().length > 1)
  );
}

/** With `exact`, every item must parse and the count must match, because drafts pair with blocks by index. */
export function parseBlockDrafts(value: unknown, characters: Character[], exact?: number): BlockDraft[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(field(value, 'blocks'))
    ? (field(value, 'blocks') as unknown[])
    : [];
  const drafts: BlockDraft[] = [];
  for (const item of source) {
    const rawType = text(field(item, 'type'), 20).toLowerCase();
    const type = BLOCK_TYPES.find(candidate => candidate === rawType) ?? (rawType === 'sound' ? 'sfx' : undefined);
    const body = text(field(item, 'text'), type === 'dialogue' ? 240 : 400);
    if (!type || !body) {
      if (exact !== undefined) {
        throw new AiError('format', FORMAT_ERROR);
      }
      continue;
    }
    const draft: BlockDraft = { type, text: body };
    if (type === 'dialogue') {
      const name = text(field(item, 'character'), LIMITS.characterName);
      const match = matchCharacter(name, characters);
      draft.characterName = match?.name ?? name;
      draft.characterId = match?.id;
      const kind = text(field(item, 'kind'), 12).toLowerCase();
      draft.kind = KINDS.find(candidate => candidate === kind) ?? 'speak';
    }
    drafts.push(draft);
  }
  if (!drafts.length || (exact !== undefined && drafts.length !== exact)) {
    throw new AiError('format', FORMAT_ERROR);
  }
  return exact === undefined ? drafts.slice(0, 8) : drafts;
}

function blockSchema(): string {
  return '{"blocks": [{"type": "setting" | "action" | "dialogue" | "narration" | "sfx", "text": string, "character": name (dialogue only), "kind": "speak" | "think" | "shout" | "whisper" (dialogue only)}]}';
}

export function continueMessages(brief: string, script: string, characters: Character[]): AiMessage[] {
  const names = characters.map(item => item.name).filter(Boolean);
  return [
    { role: 'system', content: WRITER },
    {
      role: 'user',
      content: `${brief}\n\nScript so far (the cursor is at the end):\n${
        script || '(empty)'
      }\n\nWrite the next 3 to 5 script blocks that follow naturally. Use dialogue for at most 2 of them, keep each dialogue line under ${
        LIMITS.longDialogue
      } characters, and only use these character names for dialogue: ${
        names.join(', ') || '(none: use narration and action)'
      }.\n\nReturn ${blockSchema()}.`,
    },
  ];
}

export function rewriteMessages(
  brief: string,
  blocks: Block[],
  characters: Record<ID, Character | undefined>,
  instruction: string,
): AiMessage[] {
  const lines = blocks.map(block => {
    const name = block.characterId ? characters[block.characterId]?.name : undefined;
    return JSON.stringify({ type: block.type, text: block.text, character: name, kind: block.kind });
  });
  return [
    { role: 'system', content: WRITER },
    {
      role: 'user',
      content: `${brief}\n\nRewrite these script blocks${
        instruction ? ` so that they are ${instruction}` : ', keeping the meaning but improving rhythm and clarity'
      }. Keep the same number, order, types and characters; keep dialogue under ${
        LIMITS.longDialogue
      } characters.\n${lines.join('\n')}\n\nReturn ${blockSchema()}.`,
    },
  ];
}

export function voiceMessages(brief: string, line: string, character: Character): AiMessage[] {
  const profile = [
    `Name: ${character.name}`,
    character.traits.length && `Traits: ${character.traits.join(', ')}`,
    character.voice && `Way of speaking: ${character.voice}`,
    character.age && `Age: ${character.age}`,
    character.bio && `Bio: ${character.bio.slice(0, 300)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: WRITER },
    {
      role: 'user',
      content: `${brief}\n\nCharacter profile:\n${profile}\n\nRewrite this line so it sounds exactly like this character, same meaning, under ${LIMITS.longDialogue} characters:\n"${line}"\n\nReturn {"text": string}.`,
    },
  ];
}

export function shortenMessages(line: string): AiMessage[] {
  return [
    { role: 'system', content: WRITER },
    {
      role: 'user',
      content: `Shorten this manga dialogue line to at most ${Math.round(
        LIMITS.longDialogue * 0.75,
      )} characters so it fits one speech bubble. Keep the meaning and the voice.\n"${line}"\n\nReturn {"text": string}.`,
    },
  ];
}

export function sfxMessages(action: string): AiMessage[] {
  return [
    { role: 'system', content: WRITER },
    {
      role: 'user',
      content: `Suggest 3 manga sound effects (onomatopoeia, uppercase, 2 to 8 letters, no spaces) for this action:\n"${action}"\n\nReturn {"sfx": [string, string, string]}.`,
    },
  ];
}

export function parseLine(value: unknown): string {
  const line = text(field(value, 'text'), 400).replace(/^["“]|["”]$/g, '');
  if (!line) {
    throw new AiError('format', FORMAT_ERROR);
  }
  return line;
}

export function parseSfx(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(field(value, 'sfx'))
    ? (field(value, 'sfx') as unknown[])
    : [];
  const words = source
    .map(item =>
      text(item, 12)
        .toUpperCase()
        .replace(/[^A-Z0-9!?…-]/g, ''),
    )
    .filter(word => word.length >= 2);
  const unique = [...new Set(words)].slice(0, 3);
  if (!unique.length) {
    throw new AiError('format', FORMAT_ERROR);
  }
  return unique;
}

export async function continueScript(brief: string, script: string, characters: Character[], signal?: AbortSignal) {
  return askJson(continueMessages(brief, script, characters), value => parseBlockDrafts(value, characters), signal);
}

export async function rewriteBlocks(
  brief: string,
  blocks: Block[],
  characters: Record<ID, Character | undefined>,
  instruction: string,
  signal?: AbortSignal,
) {
  const list = Object.values(characters).filter((item): item is Character => !!item);
  return askJson(
    rewriteMessages(brief, blocks, characters, instruction),
    value => parseBlockDrafts(value, list, blocks.length),
    signal,
  );
}

export async function changeVoice(brief: string, line: string, character: Character, signal?: AbortSignal) {
  return askJson(voiceMessages(brief, line, character), parseLine, signal);
}

export async function shortenLine(line: string, signal?: AbortSignal) {
  return askJson(shortenMessages(line), parseLine, signal);
}

export async function suggestSfx(action: string, signal?: AbortSignal) {
  return askJson(sfxMessages(action), parseSfx, signal);
}

export async function freeText(messages: AiMessage[], signal?: AbortSignal): Promise<string> {
  const answer = (await chat(messages, { signal })).trim();
  if (!answer) {
    throw new AiError('empty', 'The AI returned an empty answer. Try again.');
  }
  return answer;
}
