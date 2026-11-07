import { createArtRepo } from '../../src/data/artRepo';
import { migrate } from '../../src/data/migrations';
import { createStoryRepo } from '../../src/data/storyRepo';
import type { Db } from '../../src/core/ports';
import { connectArt } from '../../src/state/artStore';
import { connectStory, flushStory } from '../../src/state/useStory';
import { createNodeDb } from './nodeDb';

/** A fresh database behind the real stores. */
export function connectTestStorage(db: Db = createNodeDb()): Db {
  migrate(db);
  connectArt(createArtRepo(db));
  connectStory(createStoryRepo(db));
  return db;
}

/** Throws away everything in memory and reads from disk, as a cold start does. */
export function restart(db: Db): void {
  flushStory();
  connectArt(createArtRepo(db));
  connectStory(createStoryRepo(db));
}
