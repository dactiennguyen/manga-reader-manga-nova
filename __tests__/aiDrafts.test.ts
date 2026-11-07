import {
  actionAvailability,
  applyTexts,
  draftToBlock,
  findBlock,
  insertDrafts,
  nextBlockId,
  pairRewrite,
  rewriteTargets,
} from '../src/core/script/aiDrafts';
import type { BlockDraft } from '../src/core/ai/writing';
import type { Block, BlockType, Scene } from '../src/core/model/types';

let counter = 0;
const block = (type: BlockType, text: string, extra: Partial<Block> = {}): Block => ({
  id: `b${counter++}`,
  type,
  text,
  ...extra,
});
const scene = (blocks: Block[]): Scene => ({ id: `s${counter++}`, chapterId: 'c', description: '', blocks });

const sample = (): Scene[] => [
  scene([
    block('setting', 'Rooftop, night'),
    block('dialogue', 'This city never sleeps.', { characterId: 'aki', kind: 'speak' }),
    block('action', 'Aki jumps.'),
  ]),
  scene([block('setting', 'Street'), block('action', '')]),
];

const ids = () => {
  let n = 0;
  return () => `new${n++}`;
};

const drafts: BlockDraft[] = [
  { type: 'action', text: 'The wind picks up.' },
  { type: 'dialogue', text: 'Wait for me!', characterName: 'Ren', characterId: 'ren', kind: 'shout' },
  { type: 'dialogue', text: 'Who is there?', characterName: 'Ghost' },
];

describe('locating blocks', () => {
  it('finds a block and the block after it across scenes', () => {
    const scenes = sample();
    const last = scenes[0].blocks[2];
    expect(findBlock(scenes, last.id)).toEqual({ scene: scenes[0], index: 2, block: last });
    expect(findBlock(scenes, null)).toBeUndefined();
    expect(findBlock(scenes, 'missing')).toBeUndefined();
    expect(nextBlockId(scenes, scenes[0].blocks[0].id)).toBe(scenes[0].blocks[1].id);
    expect(nextBlockId(scenes, last.id)).toBe(scenes[1].blocks[0].id);
    expect(nextBlockId(scenes, scenes[1].blocks[1].id)).toBeUndefined();
  });
});

describe('inserting drafts', () => {
  it('turns drafts into blocks without inventing characters', () => {
    expect(draftToBlock(drafts[0], 'x')).toEqual({ id: 'x', type: 'action', text: 'The wind picks up.' });
    expect(draftToBlock(drafts[1], 'y')).toEqual({
      id: 'y',
      type: 'dialogue',
      text: 'Wait for me!',
      kind: 'shout',
      characterId: 'ren',
    });
    expect(draftToBlock(drafts[2], 'z')).toEqual({ id: 'z', type: 'dialogue', text: 'Who is there?', kind: 'speak' });
  });

  it('inserts after the focused block', () => {
    const scenes = sample();
    const anchor = scenes[0].blocks[1];
    const result = insertDrafts(scenes, drafts, anchor.id, ids());
    expect(result.blockIds).toEqual(['new0', 'new1', 'new2']);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].sceneId).toBe(scenes[0].id);
    expect(result.changes[0].blocks.map(item => item.id)).toEqual([
      scenes[0].blocks[0].id,
      anchor.id,
      'new0',
      'new1',
      'new2',
      scenes[0].blocks[2].id,
    ]);
    expect(scenes[0].blocks).toHaveLength(3);
  });

  it('replaces a blank anchor and appends to the last scene when nothing is focused', () => {
    const scenes = sample();
    const result = insertDrafts(scenes, drafts.slice(0, 1), null, ids());
    expect(result.changes[0].sceneId).toBe(scenes[1].id);
    expect(result.changes[0].blocks.map(item => item.text)).toEqual(['Street', 'The wind picks up.']);
    const focusedBlank = insertDrafts(scenes, drafts.slice(0, 1), scenes[1].blocks[1].id, ids());
    expect(focusedBlank.changes[0].blocks.map(item => item.text)).toEqual(['Street', 'The wind picks up.']);
    expect(insertDrafts([], drafts, null, ids()).changes).toEqual([]);
    expect(insertDrafts(scenes, [], null, ids()).changes).toEqual([]);
  });

  it('handles an empty scene', () => {
    const empty = scene([]);
    const result = insertDrafts([empty], drafts.slice(0, 2), null, ids());
    expect(result.changes[0].blocks.map(item => item.id)).toEqual(['new0', 'new1']);
  });
});

describe('rewriting', () => {
  it('targets the block or the whole scene when it is small enough', () => {
    const scenes = sample();
    const location = findBlock(scenes, scenes[0].blocks[1].id);
    if (!location) {
      throw new Error('block not found');
    }
    expect(rewriteTargets(location, 'block')).toEqual([location.block]);
    expect(rewriteTargets(location, 'scene')).toEqual(scenes[0].blocks);
    const big = scene(Array.from({ length: 13 }, (_, i) => block('action', `Line ${i}`)));
    const bigLocation = { scene: big, index: 0, block: big.blocks[0] };
    expect(rewriteTargets(bigLocation, 'scene')).toEqual([big.blocks[0]]);
    const withBlank = scene([block('action', 'Go'), block('action', '  ')]);
    expect(rewriteTargets({ scene: withBlank, index: 0, block: withBlank.blocks[0] }, 'scene')).toEqual([
      withBlank.blocks[0],
    ]);
  });

  it('pairs drafts with targets by position and skips blanks', () => {
    const targets = [block('action', 'a'), block('dialogue', 'b'), block('action', 'c')];
    const pairs = pairRewrite(targets, [
      { type: 'action', text: ' A ' },
      { type: 'dialogue', text: '' },
      { type: 'action', text: 'C' },
      { type: 'action', text: 'extra' },
    ]);
    expect(pairs).toEqual([
      { id: targets[0].id, text: 'A' },
      { id: targets[2].id, text: 'C' },
    ]);
    expect(pairRewrite(targets, [{ type: 'action', text: 'only' }])).toEqual([{ id: targets[0].id, text: 'only' }]);
  });

  it('writes texts into the same blocks and keeps everything else', () => {
    const scenes = sample();
    const target = scenes[0].blocks[1];
    const changes = applyTexts(scenes, [
      { id: target.id, text: 'The city is awake.' },
      { id: scenes[0].blocks[0].id, text: 'Rooftop, night' },
      { id: 'missing', text: 'nothing' },
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0].sceneId).toBe(scenes[0].id);
    expect(changes[0].blocks[1]).toEqual({ ...target, text: 'The city is awake.' });
    expect(changes[0].blocks[0]).toBe(scenes[0].blocks[0]);
    expect(applyTexts(scenes, [{ id: target.id, text: target.text }])).toEqual([]);
  });
});

describe('action availability', () => {
  it('depends on the focused block', () => {
    const scenes = sample();
    expect(actionAvailability(undefined, false)).toEqual({
      continue: true,
      rewrite: false,
      voice: false,
      shorten: false,
      sfx: false,
    });
    const dialogue = findBlock(scenes, scenes[0].blocks[1].id);
    expect(actionAvailability(dialogue, true)).toEqual({
      continue: true,
      rewrite: true,
      voice: true,
      shorten: true,
      sfx: false,
    });
    expect(actionAvailability(dialogue, false).voice).toBe(false);
    const action = findBlock(scenes, scenes[0].blocks[2].id);
    expect(actionAvailability(action, false)).toEqual({
      continue: true,
      rewrite: true,
      voice: false,
      shorten: false,
      sfx: true,
    });
    const blank = findBlock(scenes, scenes[1].blocks[1].id);
    expect(actionAvailability(blank, false)).toEqual({
      continue: true,
      rewrite: true,
      voice: false,
      shorten: false,
      sfx: false,
    });
    const lonely = findBlock([scene([block('action', '')])], 'b999');
    expect(lonely).toBeUndefined();
  });
});
