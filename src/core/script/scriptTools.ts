import { BLOCK_LABEL, DIALOGUE_KIND_LABEL } from '../model/constants';
import { estimatePages } from '../model/paginate';
import type { Block, BlockType, Character, ID, Scene } from '../model/types';

export type ScriptMatch = { sceneId: ID; blockId: ID; start: number; end: number };

export type SceneChange = { sceneId: ID; blocks: Block[] };

type SpeakerStat = { characterId: ID | null; name: string; lines: number; words: number };

export type ScriptStats = {
  words: number;
  scenes: number;
  blocks: number;
  dialogueLines: number;
  byType: Record<BlockType, number>;
  pages: number;
  readingSeconds: number;
  speakers: SpeakerStat[];
};

const WORDS_PER_MINUTE = 200;
const SECONDS_PER_PAGE = 6;
const UNASSIGNED_SPEAKER = 'Unassigned';

function matcher(query: string, matchCase: boolean): RegExp {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
}

export function findInText(text: string, query: string, matchCase = false): { start: number; end: number }[] {
  if (!query || !text) {
    return [];
  }
  return Array.from(text.matchAll(matcher(query, matchCase)), found => ({
    start: found.index,
    end: found.index + found[0].length,
  }));
}

export function findMatches(scenes: Scene[], query: string, matchCase = false): ScriptMatch[] {
  const matches: ScriptMatch[] = [];
  if (!query) {
    return matches;
  }
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      for (const range of findInText(block.text, query, matchCase)) {
        matches.push({ sceneId: scene.id, blockId: block.id, start: range.start, end: range.end });
      }
    }
  }
  return matches;
}

export function replaceRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end);
}

export function replaceInText(
  text: string,
  query: string,
  replacement: string,
  matchCase = false,
): { text: string; count: number } {
  if (!query || !text) {
    return { text, count: 0 };
  }
  let count = 0;
  const next = text.replace(matcher(query, matchCase), () => {
    count += 1;
    return replacement;
  });
  return { text: next, count };
}

export function replaceAllInScenes(
  scenes: Scene[],
  query: string,
  replacement: string,
  matchCase = false,
): { changes: SceneChange[]; count: number } {
  const changes: SceneChange[] = [];
  let count = 0;
  for (const scene of scenes) {
    let touched = false;
    const blocks = scene.blocks.map(block => {
      const result = replaceInText(block.text, query, replacement, matchCase);
      if (!result.count) {
        return block;
      }
      touched = true;
      count += result.count;
      return { ...block, text: result.text };
    });
    if (touched) {
      changes.push({ sceneId: scene.id, blocks });
    }
  }
  return { changes, count };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function scriptStats(scenes: Scene[], characters: Record<ID, Character | undefined>): ScriptStats {
  const byType: Record<BlockType, number> = { setting: 0, action: 0, dialogue: 0, narration: 0, sfx: 0 };
  const speakers = new Map<ID | null, SpeakerStat>();
  let words = 0;
  let blocks = 0;
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      const count = countWords(block.text);
      if (!count) {
        continue;
      }
      words += count;
      blocks += 1;
      byType[block.type] += 1;
      if (block.type !== 'dialogue') {
        continue;
      }
      const character = block.characterId ? characters[block.characterId] : undefined;
      const key = character ? character.id : null;
      const entry = speakers.get(key) ?? {
        characterId: key,
        name: character ? character.name.trim() || 'Unnamed' : UNASSIGNED_SPEAKER,
        lines: 0,
        words: 0,
      };
      entry.lines += 1;
      entry.words += count;
      speakers.set(key, entry);
    }
  }
  const pages = estimatePages(scenes);
  return {
    words,
    scenes: scenes.length,
    blocks,
    dialogueLines: byType.dialogue,
    byType,
    pages,
    readingSeconds: Math.round((words / WORDS_PER_MINUTE) * 60 + pages * SECONDS_PER_PAGE),
    speakers: [...speakers.values()].sort(
      (a, b) => b.lines - a.lines || b.words - a.words || a.name.localeCompare(b.name),
    ),
  };
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return '0 min';
  }
  if (seconds < 60) {
    return 'under 1 min';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`;
}

export function sceneSummary(scene: Scene): string {
  const lead = scene.blocks.find(block => block.type === 'setting' && block.text.trim()) ?? scene.blocks[0];
  return (lead?.text.trim() || scene.description.trim()).replace(/\s+/g, ' ');
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map(line => pad + line.trimEnd())
    .join('\n');
}

export function formatScript(title: string, scenes: Scene[], characters: Record<ID, Character | undefined>): string {
  const heading = title.trim().toUpperCase() || 'UNTITLED';
  const parts: string[] = [`${heading}\n${'='.repeat(Math.min(heading.length, 60))}`];
  scenes.forEach((scene, index) => {
    parts.push(`SCENE ${index + 1}\n${'-'.repeat(`SCENE ${index + 1}`.length)}`);
    for (const block of scene.blocks) {
      const text = block.text.trim();
      if (!text) {
        continue;
      }
      if (block.type === 'setting') {
        parts.push(`[${text.replace(/\s*\n\s*/g, ' ')}]`);
      } else if (block.type === 'dialogue') {
        const character = block.characterId ? characters[block.characterId] : undefined;
        const name = (character?.name.trim() || 'Unknown').toUpperCase();
        const kind = block.kind && block.kind !== 'speak' ? ` (${DIALOGUE_KIND_LABEL[block.kind]})` : '';
        parts.push(`        ${name}${kind}\n${indent(text, '    ')}`);
      } else if (block.type === 'narration') {
        parts.push(`${BLOCK_LABEL.narration.toUpperCase()}: ${text}`);
      } else if (block.type === 'sfx') {
        parts.push(`${BLOCK_LABEL.sfx.toUpperCase()}: ${text}`);
      } else {
        parts.push(text);
      }
    }
  });
  return `${parts.join('\n\n')}\n`;
}

export function scriptFileName(title: string): string {
  const safe = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${safe || 'script'}-script.txt`;
}
