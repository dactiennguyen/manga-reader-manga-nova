import { WORLD_TYPE_LABEL, WORLD_TYPES } from '../model/constants';
import type { Chapter, Character, ID, Scene, WorldEntry } from '../model/types';

export const UNTITLED = 'Untitled';

export type TimelineGroup = { key: string; label: string; items: WorldEntry[] };

export type Mention = { chapterId: ID; label: string; blockId: ID; count: number };

export function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) ?? ''
  );
}

export function anchorLabel(anchor: WorldEntry['anchor'], chapters: Pick<Chapter, 'id' | 'title'>[]): string {
  if (anchor === 'before') {
    return 'Before the story';
  }
  if (anchor === 'after') {
    return 'After the story';
  }
  const index = anchor ? chapters.findIndex(chapter => chapter.id === anchor) : -1;
  if (index < 0) {
    return 'No time anchor';
  }
  const title = chapters[index].title.trim();
  return title ? `Chapter ${index + 1} · ${title}` : `Chapter ${index + 1}`;
}

export function matchesQuery(entry: Pick<WorldEntry, 'title' | 'body'>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return entry.title.toLowerCase().includes(needle) || entry.body.toLowerCase().includes(needle);
}

export function wikiText(
  projectTitle: string,
  entries: WorldEntry[],
  chapters: Chapter[],
  characters: Record<ID, Character>,
): string {
  const lines: string[] = [`${projectTitle.trim() || 'Untitled story'} — World wiki`, ''];
  const nameOf = (id: ID | undefined) => (id ? characters[id]?.name.trim() : '') || '';
  for (const type of WORLD_TYPES) {
    const group = entries.filter(entry => entry.type === type);
    if (group.length === 0) {
      continue;
    }
    lines.push(`== ${WORLD_TYPE_LABEL[type].toUpperCase()} ==`, '');
    for (const entry of group) {
      lines.push(`# ${entry.title.trim() || UNTITLED}`);
      if (type === 'term' && entry.reading?.trim()) {
        lines.push(`Reading: ${entry.reading.trim()}`);
      }
      if (type === 'event') {
        lines.push(`Time anchor: ${anchorLabel(entry.anchor, chapters)}`);
      }
      if (type === 'faction' && nameOf(entry.leaderId)) {
        lines.push(`Leader: ${nameOf(entry.leaderId)}`);
      }
      const related = entry.characterIds.map(nameOf).filter(Boolean);
      if (related.length > 0) {
        lines.push(`Related characters: ${related.join(', ')}`);
      }
      if (entry.body.trim()) {
        lines.push(entry.body.trim());
      }
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

export function timelineGroups(events: WorldEntry[], chapters: Chapter[]): TimelineGroup[] {
  const chapterIds = new Set(chapters.map(chapter => chapter.id));
  const keyOf = (entry: WorldEntry) =>
    entry.anchor === 'before' || entry.anchor === 'after' || (entry.anchor && chapterIds.has(entry.anchor))
      ? entry.anchor
      : 'none';
  const keys: string[] = ['before', ...chapters.map(chapter => chapter.id), 'after', 'none'];
  return keys
    .map(key => ({
      key,
      label: anchorLabel(key === 'none' ? undefined : key, chapters),
      items: events.filter(entry => keyOf(entry) === key).sort((a, b) => a.order - b.order),
    }))
    .filter(group => group.items.length > 0);
}

/** Swaps two neighbours. Orders may be equal, so they are spread out first. */
export function timelineSwap(items: WorldEntry[], index: number, delta: -1 | 1): { id: ID; order: number }[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) {
    return [];
  }
  const orders = items.map(item => item.order);
  for (let i = 1; i < orders.length; i += 1) {
    if (orders[i] <= orders[i - 1]) {
      orders[i] = orders[i - 1] + 0.001;
    }
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next.flatMap((item, i) => (item.order !== orders[i] ? [{ id: item.id, order: orders[i] }] : []));
}

export function entryMentions(title: string, chapters: Chapter[], scenes: Record<ID, Scene | undefined>): Mention[] {
  const needle = title.trim().toLowerCase();
  if (needle.length < 2) {
    return [];
  }
  const result: Mention[] = [];
  chapters.forEach((chapter, index) => {
    let count = 0;
    let blockId: ID | undefined;
    for (const sceneId of chapter.sceneIds) {
      for (const block of scenes[sceneId]?.blocks ?? []) {
        if (block.text.toLowerCase().includes(needle)) {
          count += 1;
          blockId = blockId ?? block.id;
        }
      }
    }
    if (blockId) {
      const name = chapter.title.trim();
      result.push({
        chapterId: chapter.id,
        label: name ? `Chapter ${index + 1} · ${name}` : `Chapter ${index + 1}`,
        blockId,
        count,
      });
    }
  });
  return result;
}
