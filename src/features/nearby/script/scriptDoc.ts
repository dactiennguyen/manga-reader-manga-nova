/**
 * Between the host's chapter and the copy the room writes in: the copy carries the scenes, their lines
 * (with their own ids, so lettered bubbles keep their link) and the story's cast for picking speakers.
 */
import { chapterLabel, charactersOf } from '../../../core/model/selectors';
import type { Block, ID } from '../../../core/model/types';
import { SCRIPT_BLOCKS_MAX, SCRIPT_CAST_MAX, SCRIPT_DOC_BYTES_MAX, SCRIPT_SCENES_MAX, SCRIPT_TEXT_MAX, docBytes, type ScriptDoc } from '../../../core/nearby/scriptTogether';
import { snapshotScript } from '../../../state/scriptHistory';
import { useStory } from '../../../state/useStory';

/**
 * The chapter as the room will see it, or null when it is gone or too big to share. Nothing is ever cut
 * to fit: saving replaces the whole chapter, so a shortened copy would lose the rest.
 */
export function chapterDoc(chapterId: ID): ScriptDoc | null {
  const state = useStory.getState();
  const chapter = state.chapters[chapterId];
  if (!chapter) {
    return null;
  }
  const scenes = chapter.sceneIds.map(id => state.scenes[id]).filter(Boolean);
  const tooBig =
    scenes.length > SCRIPT_SCENES_MAX ||
    scenes.some(scene => scene.description.length > SCRIPT_TEXT_MAX || scene.blocks.length > SCRIPT_BLOCKS_MAX || scene.blocks.some(block => block.text.length > SCRIPT_TEXT_MAX));
  if (tooBig) {
    return null;
  }
  const doc: ScriptDoc = {
    chapterId,
    title: chapterLabel(state, chapterId).slice(0, 200),
    characters: charactersOf(state, chapter.projectId)
      .slice(0, SCRIPT_CAST_MAX)
      .map(character => ({ id: character.id, name: character.name.slice(0, 80) })),
    scenes: scenes.map(scene => ({
        id: scene.id,
        description: scene.description,
        blocks: scene.blocks.map(block => {
          const shared: ScriptDoc['scenes'][number]['blocks'][number] = { id: block.id, type: block.type, text: block.text };
          if (block.characterId) {
            shared.characterId = block.characterId;
          }
          if (block.kind) {
            shared.kind = block.kind;
          }
          return shared;
        }),
      })),
  };
  // An empty chapter still gets a first scene, so there is somewhere to write.
  if (!doc.scenes.length) {
    doc.scenes.push({ id: `${chapterId}-s1`, description: '', blocks: [] });
  }
  return docBytes(doc) <= SCRIPT_DOC_BYTES_MAX ? doc : null;
}

/** Writes the room's copy into the host's chapter; the script it had is kept as a version first. */
export function saveDoc(doc: ScriptDoc): boolean {
  const state = useStory.getState();
  if (!state.chapters[doc.chapterId]) {
    return false;
  }
  snapshotScript(doc.chapterId);
  state.replaceScript(
    doc.chapterId,
    doc.scenes.map(scene => ({
      description: scene.description,
      blocks: scene.blocks.map(block => {
        const saved: Block = { id: block.id, type: block.type, text: block.text };
        if (block.characterId) {
          saved.characterId = block.characterId;
        }
        if (block.kind) {
          saved.kind = block.kind;
        }
        return saved;
      }),
    })),
  );
  return true;
}
