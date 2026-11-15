import { create } from 'zustand';

import { EMPTY_PRESETS, parsePresets, serializePresets, type ArtPresets } from '../core/art/presets';
import type { MetaRepo } from '../core/ports';

export * from '../core/art/presets';

const KEY = 'artPresets';

let repo: MetaRepo | null = null;

type ArtPresetsStore = ArtPresets & {
  /** Applies one of the pure changes in core/art/presets and saves the result. */
  update: (change: (presets: ArtPresets) => ArtPresets) => void;
};

function pick(state: ArtPresets): ArtPresets {
  return { brushes: state.brushes, tones: state.tones, active: state.active };
}

/** The person's brushes and tones, shared by every story. */
export const useArtPresets = create<ArtPresetsStore>()((set, get) => ({
  ...EMPTY_PRESETS,
  update: change => {
    const before = pick(get());
    const next = change(before);
    if (next === before) {
      return;
    }
    set(pick(next));
    repo?.set(KEY, serializePresets(pick(next)));
  },
}));

export function connectArtPresets(next: MetaRepo | null): void {
  repo = next;
  useArtPresets.setState(parsePresets(next?.get(KEY)));
}
