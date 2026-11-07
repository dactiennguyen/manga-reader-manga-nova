import {
  blockAfter,
  blockEdges,
  enterBlock,
  findContext,
  hasScriptText,
  insertBlockAfter,
  moveInScene,
  nextDialogueKind,
  pagesText,
  panelRefs,
  removeBlockAt,
  transferBlock,
  withBlockType,
} from '../src/core/script/blockOps';
import { findBlock } from '../src/core/script/aiDrafts';
import type { Block, BlockType, Page, Scene } from '../src/core/model/types';

const block = (id: string, type: BlockType, text = '', extra: Partial<Block> = {}): Block => ({ id, type, text, ...extra });

const scene = (id: string, blocks: Block[]): Scene => ({ id, chapterId: 'c', description: '', blocks });

const at = (target: Scene, blockId: string) => {
  const found = findBlock([target], blockId);
  if (!found) {
    throw new Error('missing block');
  }
  return found;
};

const makeId = () => 'new';

describe('blockAfter', () => {
  it('follows Setting with Action', () => {
    expect(blockAfter(block('a', 'setting', 'x'), 'n', '').type).toBe('action');
  });

  it('keeps the type and kind of dialogue, not the speaker', () => {
    const next = blockAfter(block('a', 'dialogue', 'x', { kind: 'shout', characterId: 'k' }), 'n', 'y');
    expect(next).toEqual({ id: 'n', type: 'dialogue', text: 'y', kind: 'shout' });
  });
});

describe('enterBlock', () => {
  it('splits the text at the caret', () => {
    const target = scene('s', [block('a', 'action', 'onetwo'), block('b', 'action', 'z')]);
    const result = enterBlock(at(target, 'a'), 'one', 'two', makeId);
    expect(result.kind).toBe('split');
    if (result.kind === 'split') {
      expect(result.blocks.map(item => item.text)).toEqual(['one', 'two', 'z']);
      expect(result.createdId).toBe('new');
    }
  });

  it('turns an empty non-action block into Action', () => {
    const target = scene('s', [block('a', 'dialogue', '', { kind: 'think', characterId: 'k' })]);
    const result = enterBlock(at(target, 'a'), '', '', makeId);
    expect(result).toEqual({ kind: 'reset', blocks: [{ id: 'a', type: 'action', text: '' }] });
  });

  it('removes an empty Action block', () => {
    const target = scene('s', [block('a', 'setting', 'x'), block('b', 'action')]);
    expect(enterBlock(at(target, 'b'), '', '', makeId)).toEqual({ kind: 'remove' });
  });
});

describe('removeBlockAt', () => {
  it('keeps the last block of a scene', () => {
    expect(removeBlockAt(at(scene('s', [block('a', 'action')]), 'a'))).toBeNull();
  });

  it('points at the block before, or after for the first one', () => {
    const target = scene('s', [block('a', 'action'), block('b', 'action'), block('c', 'action')]);
    expect(removeBlockAt(at(target, 'b'))?.neighborId).toBe('a');
    expect(removeBlockAt(at(target, 'a'))?.neighborId).toBe('b');
  });
});

describe('moving blocks', () => {
  it('moves inside a scene and stops at the edges', () => {
    const target = scene('s', [block('a', 'action'), block('b', 'action')]);
    expect(moveInScene(at(target, 'a'), 1)?.map(item => item.id)).toEqual(['b', 'a']);
    expect(moveInScene(at(target, 'a'), -1)).toBeNull();
  });

  it('transfers to another scene and leaves an empty block behind', () => {
    const from = scene('s1', [block('a', 'action', 'x')]);
    const to = scene('s2', [block('b', 'action')]);
    const changes = transferBlock(at(from, 'a'), to, true, makeId);
    expect(changes?.[0]).toEqual({ sceneId: 's1', blocks: [{ id: 'new', type: 'action', text: '' }] });
    expect(changes?.[1].blocks.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('refuses a transfer to the same scene', () => {
    const from = scene('s1', [block('a', 'action'), block('b', 'action')]);
    expect(transferBlock(at(from, 'a'), from, false, makeId)).toBeNull();
  });

  it('reports the first and last block of the chapter', () => {
    const one = scene('s1', [block('a', 'action'), block('b', 'action')]);
    const two = scene('s2', [block('c', 'action')]);
    expect(blockEdges(['s1', 's2'], at(one, 'a'))).toEqual({ first: true, last: false });
    expect(blockEdges(['s1', 's2'], at(one, 'b'))).toEqual({ first: false, last: false });
    expect(blockEdges(['s1', 's2'], at(two, 'c'))).toEqual({ first: false, last: true });
    expect(blockEdges(['s1', 's2'], undefined)).toEqual({ first: true, last: true });
  });
});

describe('block edits', () => {
  it('insertBlockAfter puts the new block right after', () => {
    const target = scene('s', [block('a', 'setting', 'x'), block('b', 'action')]);
    const result = insertBlockAfter(at(target, 'a'), '', makeId);
    expect(result.blocks.map(item => item.id)).toEqual(['a', 'new', 'b']);
    expect(result.blocks[1].type).toBe('action');
  });

  it('drops dialogue fields when the type changes and restores a kind going back', () => {
    const line = block('a', 'dialogue', 'x', { kind: 'think', characterId: 'k' });
    expect(withBlockType(line, 'action')).toEqual({ id: 'a', type: 'action', text: 'x' });
    expect(withBlockType(block('a', 'action', 'x'), 'dialogue').kind).toBe('speak');
  });

  it('cycles dialogue kinds', () => {
    expect(nextDialogueKind(block('a', 'dialogue')).kind).toBe('think');
    expect(nextDialogueKind(block('a', 'dialogue', '', { kind: 'whisper' })).kind).toBe('speak');
  });
});

describe('labels', () => {
  it('formats page estimates', () => {
    expect(pagesText(1)).toBe('~1 page');
    expect(pagesText(2.5)).toBe('~2.5 pages');
  });

  it('builds the find context around a match', () => {
    const text = 'a'.repeat(20) + 'hit' + '\nrest';
    const match = { sceneId: 's', blockId: 'b', start: 20, end: 23 };
    expect(findContext(text, match)).toEqual({ before: `…${'a'.repeat(16)}`, match: 'hit', after: ' rest' });
    expect(findContext(undefined, match)).toBeUndefined();
  });

  it('finds whether any block has text', () => {
    expect(hasScriptText([scene('s', [block('a', 'action', '  ')])])).toBe(false);
    expect(hasScriptText([scene('s', [block('a', 'action', 'x')])])).toBe(true);
  });
});

describe('panelRefs', () => {
  it('labels blocks by page and panel', () => {
    const page = {
      layout: { kind: 'panel', id: 'p1' },
      order: ['p1'],
      panels: { p1: { id: 'p1', blockIds: ['a'] } },
    } as unknown as Page;
    expect(panelRefs(['g'], { g: page }, true).get('a')).toEqual({ label: 'P1·1', pageId: 'g' });
  });
});
