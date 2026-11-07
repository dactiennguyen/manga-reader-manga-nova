import type { Block, ID } from '../core/model/types';
import { useStory } from './useStory';

export type ScriptVersion = { at: number; scenes: { description: string; blocks: Block[] }[] };

export interface ScriptVersionRepo {
  list(chapterId: ID): ScriptVersion[];
  add(chapterId: ID, version: ScriptVersion): void;
  clear(chapterId: ID): void;
}

let repo: ScriptVersionRepo | null = null;

export function connectScriptHistory(next: ScriptVersionRepo | null): void {
  repo = next;
}

export function listScriptVersions(chapterId: ID): ScriptVersion[] {
  return repo?.list(chapterId) ?? [];
}

export function snapshotScript(chapterId: ID): void {
  const state = useStory.getState();
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return;
  }
  const scenes = chapter.sceneIds
    .map(id => state.scenes[id])
    .filter(Boolean)
    .map(scene => ({ description: scene.description, blocks: scene.blocks }));
  if (!scenes.some(scene => scene.blocks.some(block => block.text.trim()))) {
    return;
  }
  const versions = listScriptVersions(chapterId);
  if (versions.length && JSON.stringify(versions[0].scenes) === JSON.stringify(scenes)) {
    return;
  }
  repo?.add(chapterId, { at: Date.now(), scenes });
}

export function restoreScriptVersion(chapterId: ID, version: ScriptVersion): void {
  snapshotScript(chapterId);
  useStory.getState().replaceScript(
    chapterId,
    version.scenes.map(scene => ({
      description: scene.description,
      blocks: scene.blocks.map(block => ({ ...block })),
    })),
  );
}

export function clearScriptHistory(chapterId: ID): void {
  repo?.clear(chapterId);
}
