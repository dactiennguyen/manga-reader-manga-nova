/**
 * A story that arrives from someone else in Play together (Read together, Send a story) has its words
 * masked like every other text from the room (textFilter.ts): titles, the script, character and world
 * notes, panel notes and the text in bubbles. Only what changed is returned, ready to merge into the store.
 */
import type { ID, StoryData } from '../model/types';
import { maskText } from './textFilter';

type Entity = { id: ID };

/** The entity with these text fields masked, or null when none of them changes. */
function masked<T extends Entity>(item: T, fields: readonly (keyof T)[], extra?: (item: T) => Partial<T> | null): T | null {
  const patch: Partial<T> = {};
  let changed = false;
  for (const field of fields) {
    const value = item[field];
    if (typeof value === 'string') {
      const next = maskText(value);
      if (next !== value) {
        patch[field] = next as T[keyof T];
        changed = true;
      }
    } else if (Array.isArray(value) && value.every(entry => typeof entry === 'string')) {
      const next = (value as string[]).map(maskText);
      if (next.some((entry, index) => entry !== (value as string[])[index])) {
        patch[field] = next as T[keyof T];
        changed = true;
      }
    }
  }
  const more = extra?.(item);
  if (more) {
    Object.assign(patch, more);
    changed = true;
  }
  return changed ? { ...item, ...patch } : null;
}

function table<T extends Entity>(items: Record<ID, T>, belongs: (item: T) => boolean, mask: (item: T) => T | null): Record<ID, T> {
  const out: Record<ID, T> = {};
  for (const item of Object.values(items)) {
    if (belongs(item)) {
      const next = mask(item);
      if (next) {
        out[item.id] = next;
      }
    }
  }
  return out;
}

/** The entities of one story whose text has offensive words, masked. Empty tables when there are none. */
export function maskStoryText(data: StoryData, projectId: ID): Partial<StoryData> {
  const project = data.projects[projectId];
  if (!project) {
    return {};
  }
  const chapterIds = new Set(Object.values(data.chapters).filter(chapter => chapter.projectId === projectId).map(chapter => chapter.id));
  const ofProject = (item: { projectId: ID }) => item.projectId === projectId;
  const ofChapter = (item: { chapterId: ID }) => chapterIds.has(item.chapterId);
  const nextProject = masked(project, ['title', 'logline'], item => {
    const acts = item.acts.map(act => ({ ...act, title: maskText(act.title) }));
    return acts.some((act, index) => act.title !== item.acts[index].title) ? { acts } : null;
  });
  return {
    projects: nextProject ? { [projectId]: nextProject } : {},
    chapters: table(data.chapters, ofProject, item => masked(item, ['title', 'summary', 'goal'])),
    scenes: table(data.scenes, ofChapter, item =>
      masked(item, ['description'], scene => {
        const blocks = scene.blocks.map(block => ({ ...block, text: maskText(block.text) }));
        return blocks.some((block, index) => block.text !== scene.blocks[index].text) ? { blocks } : null;
      }),
    ),
    characters: table(data.characters, ofProject, item =>
      masked(item, ['name', 'age', 'gender', 'traits', 'goal', 'weakness', 'voice', 'bio', 'notes', 'appearance']),
    ),
    relations: table(data.relations, ofProject, item => masked(item, ['label', 'note'])),
    world: table(data.world, ofProject, item => masked(item, ['title', 'body', 'reading'])),
    pages: table(data.pages, ofChapter, item =>
      masked(item, [], page => {
        const bubbles = page.bubbles.map(bubble => ({ ...bubble, text: maskText(bubble.text) }));
        const bubblesChanged = bubbles.some((bubble, index) => bubble.text !== page.bubbles[index].text);
        const panels = Object.fromEntries(Object.entries(page.panels).map(([id, panel]) => [id, { ...panel, description: maskText(panel.description) }]));
        const panelsChanged = Object.entries(panels).some(([id, panel]) => panel.description !== page.panels[id].description);
        if (!bubblesChanged && !panelsChanged) {
          return null;
        }
        return { ...(bubblesChanged ? { bubbles } : null), ...(panelsChanged ? { panels } : null) };
      }),
    ),
  };
}
