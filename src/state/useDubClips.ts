import { create } from 'zustand';

import {
  parseClipIndex,
  withClip,
  withoutClip,
  type ClipEntry,
  type ClipIndex,
} from '../core/nearby/dubClips';
import type { ID } from '../core/model/types';
import type { MetaRepo } from '../core/ports';

const KEY = 'dubClips';

let repo: MetaRepo | null = null;

const EMPTY: Record<ID, ClipEntry> = {};

type DubClipsStore = {
  clips: ClipIndex;
  /** Adds or replaces a take. Returns the file of the replaced take, which the caller deletes. */
  put: (chapterId: ID, bubbleId: ID, entry: ClipEntry) => string | undefined;
  /** Returns the removed file, which the caller deletes. */
  remove: (chapterId: ID, bubbleId: ID) => string | undefined;
};

/** Which recorded file voices which bubble. The files themselves are handled by features/nearby/dub/clipFiles. */
export const useDubClips = create<DubClipsStore>()((set, get) => {
  const save = (clips: ClipIndex) => {
    set({ clips });
    repo?.set(KEY, JSON.stringify(clips));
  };
  return {
    clips: {},
    put: (chapterId, bubbleId, entry) => {
      const next = withClip(get().clips, chapterId, bubbleId, entry);
      save(next.index);
      return next.replaced;
    },
    remove: (chapterId, bubbleId) => {
      const next = withoutClip(get().clips, chapterId, bubbleId);
      if (next.removed) {
        save(next.index);
      }
      return next.removed;
    },
  };
});

/** A chapter's clips, stable while nothing changes so screens do not re-render for other chapters. */
export function useChapterClips(chapterId: ID | null | undefined): Record<ID, ClipEntry> {
  return useDubClips(state => (chapterId ? state.clips[chapterId] ?? EMPTY : EMPTY));
}

export function connectDubClips(next: MetaRepo | null): void {
  repo = next;
  useDubClips.setState({ clips: parseClipIndex(next?.get(KEY)) });
}
