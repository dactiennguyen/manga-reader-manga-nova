import type { ID } from '../../core/model/types';
import { undoable, useStory } from '../../state/useStory';
import { haptic } from '../../ui';

/** Page status is not a page edit: Undo must not silently flip it, so it stays out of the history. */
export function setPagesDone(pageIds: ID[], done: boolean): void {
  undoable({}, () => pageIds.forEach(id => useStory.getState().updatePage(id, { done })));
  if (done) {
    haptic();
  }
}

export function clearPageFlag(pageId: ID): void {
  undoable({}, () => useStory.getState().updatePage(pageId, { flag: undefined }));
}
