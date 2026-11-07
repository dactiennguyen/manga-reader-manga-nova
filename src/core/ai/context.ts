import { chapterIdsOf } from '../model/selectors';
import type { Character, ID, StoryData } from '../model/types';

export type StoryBrief = { title: string; genres: string[]; logline: string; text: string };

export function characterLine(character: Character): string {
  const bits = [
    character.name,
    character.role,
    character.age && `age ${character.age}`,
    character.gender,
    character.traits.length ? character.traits.join(', ') : '',
    character.goal && `wants: ${character.goal}`,
    character.voice && `speaks: ${character.voice}`,
  ].filter(Boolean);
  return bits.join(' · ');
}

export function storyBrief(
  state: StoryData,
  projectId: ID,
  options: { chapterId?: ID; maxChars?: number } = {},
): StoryBrief {
  const project = state.projects[projectId];
  if (!project) {
    return { title: '', genres: [], logline: '', text: '' };
  }
  const lines: string[] = [`Title: ${project.title || 'Untitled'}`];
  if (project.genres.length) {
    lines.push(`Genres: ${project.genres.join(', ')}`);
  }
  lines.push(`Logline: ${project.logline || '(none)'}`);
  const characters = Object.values(state.characters).filter(item => item.projectId === projectId);
  if (characters.length) {
    lines.push('Characters:');
    characters.forEach(item => lines.push(`- ${characterLine(item)}`));
  }
  const world = Object.values(state.world).filter(
    item => item.projectId === projectId && item.sendToAi && item.body.trim(),
  );
  if (world.length) {
    lines.push('World notes:');
    world.forEach(item => lines.push(`- ${item.title}: ${item.body.replace(/\s+/g, ' ').trim().slice(0, 240)}`));
  }
  const chapterIds = chapterIdsOf(project);
  if (chapterIds.length) {
    lines.push('Chapters:');
    chapterIds.forEach((id, index) => {
      const chapter = state.chapters[id];
      if (chapter) {
        const mark = id === options.chapterId ? ' (current)' : '';
        lines.push(`${index + 1}. ${chapter.title}${mark}${chapter.summary ? ` — ${chapter.summary}` : ''}`);
      }
    });
  }
  const max = options.maxChars ?? 6000;
  const text = lines.join('\n');
  return {
    title: project.title,
    genres: project.genres,
    logline: project.logline,
    text: text.length > max ? `${text.slice(0, max)}…` : text,
  };
}

export function scriptText(
  state: StoryData,
  chapterId: ID,
  options: { untilBlockId?: ID; maxChars?: number } = {},
): string {
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return '';
  }
  const lines: string[] = [];
  let stop = false;
  chapter.sceneIds.forEach((sceneId, index) => {
    const scene = state.scenes[sceneId];
    if (!scene || stop) {
      return;
    }
    lines.push(`SCENE ${index + 1}${scene.description ? `: ${scene.description}` : ''}`);
    for (const block of scene.blocks) {
      if (block.id === options.untilBlockId) {
        stop = true;
        break;
      }
      if (!block.text.trim()) {
        continue;
      }
      lines.push(formatBlock(block, state.characters));
    }
  });
  const text = lines.join('\n');
  const max = options.maxChars ?? 8000;
  return text.length > max ? `…${text.slice(text.length - max)}` : text;
}

export function formatBlock(
  block: { type: string; text: string; characterId?: ID; kind?: string },
  characters: Record<ID, Character | undefined>,
): string {
  if (block.type === 'dialogue') {
    const name = (block.characterId && characters[block.characterId]?.name) || 'UNKNOWN';
    const kind = block.kind && block.kind !== 'speak' ? ` (${block.kind})` : '';
    return `${name.toUpperCase()}${kind}: ${block.text}`;
  }
  if (block.type === 'setting') {
    return `[${block.text}]`;
  }
  if (block.type === 'narration') {
    return `NARRATION: ${block.text}`;
  }
  if (block.type === 'sfx') {
    return `SFX: ${block.text}`;
  }
  return block.text;
}
