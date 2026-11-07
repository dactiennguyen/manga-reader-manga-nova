import type { UndoScope } from '../ports';
import type { ID, Page, StoryData } from '../model/types';
import type { StoryActions } from './actions';

export type ActionName = keyof StoryActions;

export type ActionMeta = { undoScope?: UndoScope; coalesceKey?: string; typing?: boolean };

/** These never change story content, or they already have their own recovery (Trash). */
const NO_HISTORY = new Set<ActionName>([
  'createProject',
  'setLastOpened',
  'trashProject',
  'restoreProject',
  'deleteProjectForever',
  'duplicateProject',
  'purgeTrash',
  'bumpArt',
  'mergeEntities',
]);

/** Rows these write are not edits worth a project timestamp. */
export const NO_TOUCH = new Set<ActionName>(['setLastOpened', 'trashProject', 'restoreProject', 'purgeTrash']);

function projectOf(state: StoryData, action: ActionName, id: ID): ID | undefined {
  switch (action) {
    case 'updateChapter':
    case 'moveChapter':
    case 'duplicateChapter':
    case 'removeChapter':
    case 'addPage':
    case 'movePage':
    case 'applyPagination':
      return state.chapters[id]?.projectId;
    case 'updateCharacter':
    case 'duplicateCharacter':
    case 'removeCharacter':
      return state.characters[id]?.projectId;
    case 'updateRelation':
    case 'removeRelation':
      return state.relations[id]?.projectId;
    case 'updateWorldEntry':
    case 'removeWorldEntry':
      return state.world[id]?.projectId;
    case 'duplicatePage':
    case 'removePage': {
      const page: Page | undefined = state.pages[id];
      return page ? state.chapters[page.chapterId]?.projectId : undefined;
    }
    default:
      return id;
  }
}

export function metaOf(state: StoryData, action: ActionName, args: unknown[]): ActionMeta {
  const id = args[0] as ID;
  if (NO_HISTORY.has(action)) {
    return {};
  }
  switch (action) {
    case 'addScene':
    case 'moveScene':
    case 'replaceScript':
      return { undoScope: `script:${id}` };
    case 'removeScene':
      return { undoScope: `script:${state.scenes[id]?.chapterId}` };
    case 'updateScene':
      return { undoScope: `script:${state.scenes[id]?.chapterId}`, coalesceKey: `scene:${id}`, typing: true };
    case 'updatePage':
    case 'updatePanel':
    case 'applyTemplate':
      return { undoScope: `page:${id}` };
  }
  const projectId = projectOf(state, action, id);
  if (!projectId) {
    return {};
  }
  const typing =
    action === 'updateProject' ||
    action === 'updateChapter' ||
    action === 'updateCharacter' ||
    action === 'updateRelation' ||
    action === 'updateWorldEntry';
  return {
    undoScope: `project:${projectId}`,
    coalesceKey: typing ? `${action}:${id}` : undefined,
    typing,
  };
}
