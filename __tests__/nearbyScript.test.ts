import { parseEnvelope } from '../src/core/nearby/schema';
import {
  INITIAL_SCRIPT,
  SCRIPT_TEXT_MAX,
  SCRIPT_DOC_BYTES_MAX,
  blockKey,
  docBytes,
  fitsAfter,
  isScriptOp,
  makeIdMaker,
  reduceScript,
  sceneKey,
  scriptText,
  type ScriptContext,
  type ScriptDoc,
  type ScriptState,
} from '../src/core/nearby/scriptTogether';
import type { Message } from '../src/core/nearby/types';

const HOST = 'h';
const context: ScriptContext = { host: HOST, present: [HOST, 'a', 'b'] };

const doc: ScriptDoc = {
  chapterId: 'c1',
  title: 'Chapter 1',
  characters: [
    { id: 'k1', name: 'Mai' },
    { id: 'k2', name: 'Ken' },
  ],
  scenes: [
    {
      id: 's1',
      description: 'Rooftop at dusk',
      blocks: [
        { id: 'b1', type: 'action', text: 'Mai looks at the city.' },
        { id: 'b2', type: 'dialogue', text: 'It is so quiet.', characterId: 'k1', kind: 'speak' },
      ],
    },
  ],
};

/** Changes are applied the way the host hands them on: wrapped in script.apply, with the author named. */
function run(messages: [Message, string][], start: ScriptState = INITIAL_SCRIPT, ctx = context): ScriptState {
  return messages.reduce(
    (state, [message, from]) => (isScriptOp(message) ? reduceScript(state, { t: 'script.apply', by: from, op: message }, HOST, ctx) : reduceScript(state, message, from, ctx)),
    start,
  );
}

const opened = () => run([[{ t: 'script.doc', doc, rev: 0, locks: {} }, HOST]]);
const textOf = (state: ScriptState, id: string) => state.doc!.scenes.flatMap(scene => scene.blocks).find(block => block.id === id)?.text;

describe('writing a script together', () => {
  it('takes the doc only from the host', () => {
    expect(run([[{ t: 'script.doc', doc, rev: 0, locks: {} }, 'a']]).doc).toBeNull();
    expect(opened().doc).toBe(doc);
  });

  it('applies a change only when the host hands it on', () => {
    const state = opened();
    expect(reduceScript(state, { t: 'script.focus', key: blockKey('b1') }, 'a', context)).toBe(state);
    expect(reduceScript(state, { t: 'script.apply', by: 'a', op: { t: 'script.focus', key: blockKey('b1') } }, 'b', context)).toBe(state);
    expect(reduceScript(state, { t: 'script.apply', by: 'a', op: { t: 'script.focus', key: blockKey('b1') } }, HOST, context).locks).toEqual({ 'b:b1': 'a' });
  });

  it('lets only the person holding a line change its text', () => {
    let state = run([[{ t: 'script.focus', key: blockKey('b1') }, 'a']], opened());
    expect(state.locks).toEqual({ 'b:b1': 'a' });
    state = run(
      [
        [{ t: 'script.edit', key: blockKey('b1'), text: 'Mai stares at the city.' }, 'a'],
        [{ t: 'script.edit', key: blockKey('b1'), text: 'hijacked' }, 'b'],
      ],
      state,
    );
    expect(textOf(state, 'b1')).toBe('Mai stares at the city.');
    expect(state.rev).toBe(1);
  });

  it('gives a line to the first claim the host passes on, and frees it when its holder moves or leaves', () => {
    let state = run(
      [
        [{ t: 'script.focus', key: blockKey('b1') }, 'a'],
        [{ t: 'script.focus', key: blockKey('b1') }, 'b'],
      ],
      opened(),
    );
    expect(state.locks).toEqual({ 'b:b1': 'a' });
    state = run([[{ t: 'script.focus', key: sceneKey('s1') }, 'a']], state);
    expect(state.locks).toEqual({ 's:s1': 'a' });
    state = run([[{ t: 'script.focus', key: blockKey('b1') }, 'b']], state);
    expect(state.locks).toEqual({ 's:s1': 'a', 'b:b1': 'b' });
    state = run([[{ t: 'bye', from: 'b' }, 'b']], state);
    expect(state.locks).toEqual({ 's:s1': 'a' });
    expect(run([[{ t: 'script.focus', key: null }, 'a']], state).locks).toEqual({});
  });

  it('treats a line held by someone who already left as free', () => {
    const state = run([[{ t: 'script.focus', key: blockKey('b1') }, 'a']], opened());
    const after = run([[{ t: 'script.focus', key: blockKey('b1') }, 'b']], state, { host: HOST, present: [HOST, 'b'] });
    expect(after.locks).toEqual({ 'b:b1': 'b' });
  });

  it('ignores claims on lines that do not exist', () => {
    expect(run([[{ t: 'script.focus', key: blockKey('nope') }, 'a']], opened()).locks).toEqual({});
  });

  it('edits a scene heading through its own claim', () => {
    const state = run(
      [
        [{ t: 'script.focus', key: sceneKey('s1') }, 'b'],
        [{ t: 'script.edit', key: sceneKey('s1'), text: 'Rooftop, night' }, 'b'],
      ],
      opened(),
    );
    expect(state.doc!.scenes[0].description).toBe('Rooftop, night');
  });

  it('adds a line where asked and hands it to whoever added it', () => {
    const state = run(
      [
        [{ t: 'script.add', sceneId: 's1', afterId: 'b1', block: { id: 'n1', type: 'dialogue', text: '', characterId: 'k2' } }, 'b'],
        [{ t: 'script.add', sceneId: 's1', afterId: null, block: { id: 'n2', type: 'setting', text: 'Wind.' } }, 'a'],
        [{ t: 'script.add', sceneId: 's1', afterId: null, block: { id: 'b1', type: 'action', text: 'dup' } }, 'a'],
        [{ t: 'script.add', sceneId: 's1', afterId: 'missing', block: { id: 'n3', type: 'action', text: '' } }, 'a'],
      ],
      opened(),
    );
    expect(state.doc!.scenes[0].blocks.map(block => block.id)).toEqual(['n2', 'b1', 'n1', 'b2']);
    expect(state.doc!.scenes[0].blocks[2]).toEqual({ id: 'n1', type: 'dialogue', text: '', characterId: 'k2', kind: 'speak' });
    expect(state.locks).toEqual({ 'b:n1': 'b', 'b:n2': 'a' });
  });

  it('changes a line type and speaker, dropping a speaker who is not in the cast', () => {
    let state = run([[{ t: 'script.set', blockId: 'b1', type: 'dialogue', characterId: 'k2', kind: 'shout' }, 'a']], opened());
    expect(state.doc!.scenes[0].blocks[0]).toEqual({ id: 'b1', type: 'dialogue', text: 'Mai looks at the city.', characterId: 'k2', kind: 'shout' });
    state = run([[{ t: 'script.set', blockId: 'b1', type: 'dialogue', characterId: 'stranger' }, 'a']], state);
    expect(state.doc!.scenes[0].blocks[0].characterId).toBeUndefined();
    state = run([[{ t: 'script.set', blockId: 'b1', type: 'narration', characterId: 'k1' }, 'a']], state);
    expect(state.doc!.scenes[0].blocks[0]).toEqual({ id: 'b1', type: 'narration', text: 'Mai looks at the city.' });
  });

  it('will not delete or retype a line someone else is writing', () => {
    const held = run([[{ t: 'script.focus', key: blockKey('b2') }, 'a']], opened());
    expect(run([[{ t: 'script.remove', blockId: 'b2' }, 'b']], held)).toBe(held);
    expect(run([[{ t: 'script.set', blockId: 'b2', type: 'sfx' }, 'b']], held)).toBe(held);
    const removed = run([[{ t: 'script.remove', blockId: 'b2' }, 'a']], held);
    expect(removed.doc!.scenes[0].blocks.map(block => block.id)).toEqual(['b1']);
    expect(removed.locks).toEqual({});
  });

  it('adds scenes after another or at the end', () => {
    const state = run(
      [
        [{ t: 'script.scene', sceneId: 's3', afterId: null }, 'a'],
        [{ t: 'script.scene', sceneId: 's2', afterId: 's1' }, 'b'],
      ],
      opened(),
    );
    expect(state.doc!.scenes.map(scene => scene.id)).toEqual(['s1', 's2', 's3']);
    expect(state.locks).toEqual({ 's:s3': 'a', 's:s2': 'b' });
  });

  it('cuts text that is too long and stops changes after the host ends', () => {
    let state = run(
      [
        [{ t: 'script.focus', key: blockKey('b1') }, 'a'],
        [{ t: 'script.edit', key: blockKey('b1'), text: 'x'.repeat(SCRIPT_TEXT_MAX + 5) }, 'a'],
      ],
      opened(),
    );
    expect(textOf(state, 'b1')).toHaveLength(SCRIPT_TEXT_MAX);
    state = run([[{ t: 'script.end' }, 'a']], state);
    expect(state.ended).toBe(false);
    state = run([[{ t: 'script.end' }, HOST]], state);
    expect(state.ended).toBe(true);
    expect(run([[{ t: 'script.scene', sceneId: 's9', afterId: null }, HOST]], state)).toBe(state);
  });

  it('measures the chapter in bytes, so kanji count three times', () => {
    const ascii = { ...doc, title: 'a'.repeat(1000) };
    const kanji = { ...doc, title: '漢'.repeat(1000) };
    expect(docBytes(kanji) - docBytes(ascii)).toBe(2000);
  });

  it('refuses a change that would make the chapter too big to send whole', () => {
    const edit = { t: 'script.edit' as const, key: blockKey('b1'), text: '漢'.repeat(1000) };
    expect(fitsAfter(doc, 1000, edit)).toBe(true);
    expect(fitsAfter(doc, SCRIPT_DOC_BYTES_MAX - 2000, edit)).toBe(false);
    expect(fitsAfter(doc, SCRIPT_DOC_BYTES_MAX, { t: 'script.focus', key: null })).toBe(true);
  });

  it('keeps how a line is said when only its speaker changes', () => {
    const state = run([[{ t: 'script.set', blockId: 'b2', type: 'dialogue', characterId: 'k2', kind: 'shout' }, 'a']], opened());
    const after = run([[{ t: 'script.set', blockId: 'b2', type: 'dialogue', characterId: 'k1', kind: state.doc!.scenes[0].blocks[1].kind }, 'a']], state);
    expect(after.doc!.scenes[0].blocks[1]).toMatchObject({ characterId: 'k1', kind: 'shout' });
  });

  it('makes ids that differ between phones', () => {
    const a = makeIdMaker('memberA', 5);
    const b = makeIdMaker('memberB', 5);
    expect(new Set([a(), a(), b(), b()]).size).toBe(4);
  });

  it('writes the script as text', () => {
    const text = scriptText(doc, { scene: n => `Scene ${n}`, type: type => type });
    expect(text).toBe('Scene 1: Rooftop at dusk\n[action] Mai looks at the city.\nMai: It is so quiet.');
  });
});

describe('script messages on the wire', () => {
  const line = (m: unknown) => JSON.stringify({ m, from: 'a' });

  it('accepts every script message', () => {
    const messages: Message[] = [
      { t: 'script.doc', doc, rev: 3, locks: { 'b:b1': 'a' } },
      { t: 'script.want' },
      { t: 'script.focus', key: 'b:b1' },
      { t: 'script.focus', key: null },
      { t: 'script.edit', key: 's:s1', text: 'x' },
      { t: 'script.add', sceneId: 's1', afterId: null, block: { id: 'n', type: 'sfx', text: 'BOOM' } },
      { t: 'script.set', blockId: 'b1', type: 'dialogue', characterId: 'k1', kind: 'think' },
      { t: 'script.remove', blockId: 'b1' },
      { t: 'script.scene', sceneId: 's2', afterId: 's1' },
      { t: 'script.end' },
      { t: 'script.apply', by: 'b', op: { t: 'script.edit', key: 'b:b1', text: 'hi' } },
    ];
    messages.forEach(m => expect(parseEnvelope(line(m))).toEqual({ ok: true, envelope: { m, from: 'a' } }));
  });

  it('refuses a bad key, an unknown line type and oversized text', () => {
    expect(parseEnvelope(line({ t: 'script.focus', key: 'x:b1' })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'script.set', blockId: 'b1', type: 'poem' })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'script.apply', by: 'b', op: { t: 'script.end' } })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'script.edit', key: 'b:b1', text: 'x'.repeat(SCRIPT_TEXT_MAX + 1) })).ok).toBe(false);
  });
});
