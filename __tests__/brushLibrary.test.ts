import { BUILTIN_BRUSHES, type BrushPreset } from '../src/core/art/brushes';
import {
  BRUSH_FILE_FORMAT,
  BRUSH_FILE_MAX_CHARS,
  brushFileForSet,
  brushFileName,
  importBrushFile,
  isBrushFileName,
  looksLikeBrushFile,
  parseBrushFile,
  planImport,
  serializeBrushFile,
  type BrushFile,
} from '../src/core/art/brushFile';
import {
  DEFAULT_SET_ID,
  EMPTY_PRESETS,
  PRESETS_MAX,
  SETS_MAX,
  chooseBrush,
  duplicateBrush,
  moveBrush,
  parsePresets,
  presetsNeedMigration,
  saveBrush,
  saveTone,
  serializePresets,
  type ArtPresets,
} from '../src/core/art/presets';
import {
  addSet,
  addToSet,
  matchesSearch,
  moveSet,
  moveToSet,
  removeSet,
  renameSet,
  roomLeft,
  setContents,
} from '../src/core/art/presetSets';
import { BUILTIN_TONES, type TonePreset } from '../src/core/art/tone';
import type { MetaRepo } from '../src/core/ports';
import { connectArtPresets, useArtPresets } from '../src/state/useArtPresets';

const brush = (id: string, patch: Partial<BrushPreset> = {}): BrushPreset => ({ ...BUILTIN_BRUSHES[0], id, name: id, ...patch });
const tone = (id: string, patch: Partial<TonePreset> = {}): TonePreset => ({ ...BUILTIN_TONES[0], id, name: id, ...patch });

let ids = 0;
const newId = () => `n${++ids}`;

function library(): ArtPresets {
  let p = addSet(EMPTY_PRESETS, 'ink', 'Inking');
  p = addSet(p, 'bg', 'Backgrounds');
  p = saveBrush(p, brush('a', { set: 'ink', name: 'G-pen fine' }));
  p = saveBrush(p, brush('b', { set: 'bg', name: 'Leaves' }));
  p = saveBrush(p, brush('c', { set: 'ink', name: 'Bold' }));
  p = saveTone(p, tone('t1', { set: 'bg', name: 'Sky' }));
  p = saveTone(p, tone('t2', { name: 'Dots' }));
  return p;
}

describe('stored presets and sets', () => {
  it('puts presets saved before sets into the default set', () => {
    const v1 = JSON.stringify({ version: 1, brushes: [brush('a'), brush('b')], tones: [tone('t')], active: { gpen: 'a' } });
    const p = parsePresets(v1);
    expect(p.sets).toEqual([{ id: DEFAULT_SET_ID, name: '' }]);
    expect(p.brushes.map(item => item.set)).toEqual([DEFAULT_SET_ID, DEFAULT_SET_ID]);
    expect(p.tones[0].set).toBe(DEFAULT_SET_ID);
    expect(p.active).toEqual({ gpen: 'a' });
    expect(presetsNeedMigration(v1)).toBe(true);
    expect(presetsNeedMigration(serializePresets(p))).toBe(false);
    expect(presetsNeedMigration(null)).toBe(false);
    expect(presetsNeedMigration('{oops')).toBe(false);
  });

  it('writes an old record once in the new form when the app starts', () => {
    const data: Record<string, string> = { artPresets: JSON.stringify({ version: 1, brushes: [brush('a')], tones: [], active: {} }) };
    const repo: MetaRepo = { get: key => data[key] ?? null, set: (key, value) => (data[key] = value), remove: key => delete data[key] };
    connectArtPresets(repo);
    expect(useArtPresets.getState().brushes[0].set).toBe(DEFAULT_SET_ID);
    expect(JSON.parse(data.artPresets)).toMatchObject({ version: 2, sets: [{ id: DEFAULT_SET_ID }] });
    const written = data.artPresets;
    connectArtPresets(repo);
    expect(data.artPresets).toBe(written);
    connectArtPresets(null);
  });

  it('keeps sets through a round trip, and fixes presets in a set that is gone', () => {
    const p = library();
    expect(parsePresets(serializePresets(p))).toEqual(p);
    const broken = JSON.parse(serializePresets(p));
    broken.sets = broken.sets.filter((set: { id: string }) => set.id !== 'bg' && set.id !== DEFAULT_SET_ID);
    broken.sets.push({ id: 'builtin', name: 'Sneaky' }, { id: 'ink', name: 'Twice' }, { name: 'no id' });
    const fixed = parsePresets(JSON.stringify(broken));
    expect(fixed.sets.map(set => set.id)).toEqual([DEFAULT_SET_ID, 'ink']);
    expect(fixed.sets[1].name).toBe('Inking');
    expect(fixed.brushes.find(item => item.id === 'b')?.set).toBe(DEFAULT_SET_ID);
  });

  it('caps the number of sets it reads', () => {
    const sets = Array.from({ length: SETS_MAX + 5 }, (_, i) => ({ id: `s${i}`, name: `Set ${i}` }));
    const p = parsePresets(JSON.stringify({ version: 2, brushes: [], tones: [], active: {}, sets }));
    expect(p.sets).toHaveLength(SETS_MAX);
    expect(p.sets[0].id).toBe(DEFAULT_SET_ID);
  });

  it('gives a new or duplicated preset a set', () => {
    let p = saveBrush(library(), brush('d', { set: 'nowhere' }));
    expect(p.brushes.find(item => item.id === 'd')?.set).toBe(DEFAULT_SET_ID);
    p = duplicateBrush(p, p.brushes[0], 'copy', 'G-pen fine');
    expect(p.brushes.find(item => item.id === 'copy')?.set).toBe('ink');
    p = duplicateBrush(p, BUILTIN_BRUSHES[2], 'bi', 'Soft pencil', 'bg');
    expect(p.brushes.find(item => item.id === 'bi')?.set).toBe('bg');
    p = duplicateBrush(p, BUILTIN_BRUSHES[2], 'bi2', 'Soft pencil');
    expect(p.brushes.find(item => item.id === 'bi2')?.set).toBe(DEFAULT_SET_ID);
  });
});

describe('set operations', () => {
  it('adds, renames and reorders sets, within the limit', () => {
    let p = library();
    expect(addSet(p, 'x', '   ')).toBe(p);
    expect(addSet(p, 'ink', 'Again')).toBe(p);
    p = renameSet(p, 'ink', '  Lines  ');
    expect(p.sets.find(set => set.id === 'ink')?.name).toBe('Lines');
    expect(renameSet(p, 'ink', 'Lines')).toBe(p);
    expect(renameSet(p, 'ink', ' ')).toBe(p);
    p = moveSet(p, 'bg', -2);
    expect(p.sets.map(set => set.id)).toEqual(['bg', DEFAULT_SET_ID, 'ink']);
    expect(moveSet(p, 'bg', -1)).toBe(p);
    let full = EMPTY_PRESETS;
    for (let i = 1; i < SETS_MAX + 3; i++) {
      full = addSet(full, `s${i}`, `Set ${i}`);
    }
    expect(full.sets).toHaveLength(SETS_MAX);
    expect(roomLeft(full).sets).toBe(0);
  });

  it('deletes a set with its presets, but never the default set', () => {
    let p = chooseBrush(library(), 'gpen', 'a');
    p = chooseBrush(p, 'pencil', BUILTIN_BRUSHES[1].id);
    expect(removeSet(p, DEFAULT_SET_ID)).toBe(p);
    expect(removeSet(p, 'missing')).toBe(p);
    p = removeSet(p, 'ink');
    expect(p.sets.map(set => set.id)).toEqual([DEFAULT_SET_ID, 'bg']);
    expect(p.brushes.map(item => item.id)).toEqual(['b']);
    // The deleted brush stops being chosen; a built-in choice stays.
    expect(p.active).toEqual({ pencil: BUILTIN_BRUSHES[1].id });
  });

  it('moves presets between sets, landing last in the new set', () => {
    let p = library();
    p = moveToSet(p, 'brush', 'b', 'ink');
    expect(setContents(p, 'ink').brushes.map(item => item.id)).toEqual(['a', 'c', 'b']);
    expect(setContents(p, 'bg').brushes).toEqual([]);
    expect(moveToSet(p, 'brush', 'b', 'ink')).toBe(p);
    expect(moveToSet(p, 'brush', 'b', 'nowhere')).toBe(p);
    p = moveToSet(p, 'tone', 't2', 'bg');
    expect(setContents(p, 'bg').tones.map(item => item.id)).toEqual(['t1', 't2']);
  });

  it('reorders a preset among the others in its set', () => {
    let p = library();
    // Brushes in order: a (ink), b (bg), c (ink). Moving c up passes over b to sit before a.
    p = moveBrush(p, 'c', -1);
    expect(setContents(p, 'ink').brushes.map(item => item.id)).toEqual(['c', 'a']);
    expect(moveBrush(p, 'c', -1)).toBe(p);
    expect(moveBrush(p, 'b', 1)).toBe(p);
    p = moveBrush(p, 'c', 1);
    expect(setContents(p, 'ink').brushes.map(item => item.id)).toEqual(['a', 'c']);
  });

  it('adds copies with new ids and free names, or nothing when they do not fit', () => {
    const p = library();
    const result = addToSet(p, { brushes: [brush('x', { name: 'Bold' }), brush('y', { name: 'Bold' })], tones: [] }, 'bg', newId);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const added = result.presets.brushes.slice(-2);
    expect(added.map(item => item.name)).toEqual(['Bold (2)', 'Bold (3)']);
    expect(added.every(item => item.set === 'bg' && item.id.startsWith('n'))).toBe(true);
    expect(result.presets.brushes.find(item => item.id === 'c')?.name).toBe('Bold');

    let crowded = p;
    for (let i = crowded.brushes.length; i < PRESETS_MAX - 1; i++) {
      crowded = saveBrush(crowded, brush(`f${i}`));
    }
    const two = { brushes: [brush('x'), brush('y')], tones: [] };
    expect(addToSet(crowded, two, 'bg', newId)).toEqual({ ok: false, reason: 'full', room: { brushes: 1, tones: PRESETS_MAX - 2 } });
    expect(addToSet(crowded, { brushes: [], tones: [] }, 'bg', newId)).toMatchObject({ ok: false, reason: 'nothing' });
  });

  it('searches without case or accents', () => {
    expect(matchesSearch('Bút mực', 'but')).toBe(true);
    expect(matchesSearch('Đổ bóng', 'do bong')).toBe(true);
    expect(matchesSearch('Inking', 'INK')).toBe(true);
    expect(matchesSearch('Inking', 'tone')).toBe(false);
    expect(matchesSearch('Anything', '  ')).toBe(true);
  });
});

describe('the .mnbrush file', () => {
  it('round-trips a set, with new file ids and no set ids', () => {
    const p = library();
    const file = brushFileForSet(p, 'ink', 'Inking')!;
    const text = serializeBrushFile(file);
    expect(JSON.parse(text)).toMatchObject({ format: BRUSH_FILE_FORMAT, version: 1, name: 'Inking' });
    expect(text).not.toContain('"set"');
    expect(text).not.toContain('"id"');
    const parsed = parseBrushFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.dropped).toBe(0);
    expect(parsed.file.name).toBe('Inking');
    expect(parsed.file.brushes.map(item => item.id)).toEqual(['b0', 'b1']);
    const strip = ({ id: _id, set: _set, ...rest }: BrushPreset) => rest;
    expect(parsed.file.brushes.map(strip)).toEqual(file.brushes.map(strip));
    expect(brushFileForSet(p, 'missing', 'x')).toBeNull();
  });

  it('refuses what is not a brush file, and says when it is from a newer app', () => {
    expect(parseBrushFile('{oops')).toEqual({ ok: false, reason: 'json' });
    expect(parseBrushFile('[1,2]')).toEqual({ ok: false, reason: 'format' });
    expect(parseBrushFile(JSON.stringify({ format: 'other', version: 1, brushes: [brush('a')] }))).toEqual({ ok: false, reason: 'format' });
    expect(parseBrushFile(JSON.stringify({ format: BRUSH_FILE_FORMAT, version: '1', brushes: [] }))).toEqual({
      ok: false,
      reason: 'format',
    });
    expect(parseBrushFile(JSON.stringify({ format: BRUSH_FILE_FORMAT, version: 2, brushes: [brush('a')] }))).toEqual({
      ok: false,
      reason: 'newer',
    });
    expect(parseBrushFile(JSON.stringify({ format: BRUSH_FILE_FORMAT, version: 1, brushes: [], tones: [] }))).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(parseBrushFile(' '.repeat(BRUSH_FILE_MAX_CHARS + 1))).toEqual({ ok: false, reason: 'size' });
  });

  it('drops broken presets and clamps wild numbers, so drawing never sees them', () => {
    const text = JSON.stringify({
      format: BRUSH_FILE_FORMAT,
      version: 1,
      name: 'x'.repeat(200),
      brushes: [
        {
          name: 'Wild',
          base: 'gpen',
          size: 1e9,
          sizeMin: -5,
          sizeMax: 'big',
          opacity: NaN,
          brush: { hardness: 99, taperStart: -1, grain: 'glitter' },
        },
        { name: 'No tool', base: 'laser' },
        { name: '', base: 'gpen' },
        null,
        'text',
      ],
      tones: [
        { name: 'Dense', kind: 'dots', density: 50, pitch: 0, angle: 9999 },
        { name: 'Plaid', kind: 'plaid' },
      ],
    });
    const parsed = parseBrushFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.dropped).toBe(5);
    expect(parsed.file.name).toHaveLength(40);
    const [wild] = parsed.file.brushes;
    expect(wild).toMatchObject({ name: 'Wild', base: 'gpen', sizeMin: 1, sizeMax: 40, size: 40, opacity: 1 });
    expect(wild.brush).toMatchObject({ hardness: 1, taperStart: 0, grain: 'none' });
    expect(parsed.file.tones[0]).toMatchObject({ density: 0.75, pitch: 3 });
    expect(parsed.file.tones[0].angle).toBeGreaterThanOrEqual(0);
    expect(parsed.file.tones[0].angle).toBeLessThan(180);
  });

  it('reads at most the preset limit from a file', () => {
    const many = Array.from({ length: PRESETS_MAX + 4 }, (_, i) => ({ ...brush(`x${i}`), name: `B${i}` }));
    const parsed = parseBrushFile(JSON.stringify({ format: BRUSH_FILE_FORMAT, version: 1, name: 'Big', brushes: many }));
    expect(parsed.ok && parsed.file.brushes.length).toBe(PRESETS_MAX);
    expect(parsed.ok && parsed.dropped).toBe(4);
  });

  it('names files and tells a brush file from a story', () => {
    expect(brushFileName('Bút mực đẹp')).toBe('but-muc-dep.mnbrush');
    expect(isBrushFileName('Inking.MNBRUSH')).toBe(true);
    expect(isBrushFileName('story.manganova')).toBe(false);
    expect(looksLikeBrushFile('  {"format"')).toBe(true);
    expect(looksLikeBrushFile('PK\u0003\u0004')).toBe(false);
  });
});

describe('importing a set', () => {
  const incoming = (): BrushFile => {
    const parsed = parseBrushFile(
      serializeBrushFile({
        name: 'Inking',
        brushes: [brush('x', { name: 'Bold' }), brush('y', { name: 'Fresh' }), brush('z', { name: 'Bold' })],
        tones: [tone('u', { name: 'Sky' })],
      }),
    );
    if (!parsed.ok) {
      throw new Error('bad file');
    }
    return parsed.file;
  };

  it('shows which names are taken and what they will be called', () => {
    const plan = planImport(library(), incoming(), new Set(['b0', 'b1', 'b2', 't0']));
    expect(plan.rows.map(row => [row.id, row.conflict, row.finalName])).toEqual([
      ['b0', true, 'Bold (2)'],
      ['b1', false, 'Fresh'],
      ['b2', true, 'Bold (3)'],
      ['t0', true, 'Sky (2)'],
    ]);
    // Leaving the first one out frees its number for the next.
    expect(planImport(library(), incoming(), new Set(['b2'])).rows[2].finalName).toBe('Bold (2)');
  });

  it('imports the chosen presets into a new set named after the file, never overwriting', () => {
    const p = library();
    const result = importBrushFile(p, incoming(), new Set(['b0', 'b1', 't0']), { newSet: { id: 'new', name: '' } }, newId);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.added).toEqual({ brushes: 2, tones: 1 });
    expect(result.presets.sets.find(set => set.id === 'new')?.name).toBe('Inking (2)');
    const inNew = setContents(result.presets, 'new');
    expect(inNew.brushes.map(item => item.name)).toEqual(['Bold (2)', 'Fresh']);
    expect(inNew.tones.map(item => item.name)).toEqual(['Sky (2)']);
    expect(result.presets.brushes.find(item => item.id === 'c')).toEqual(p.brushes.find(item => item.id === 'c'));
    expect(new Set(result.presets.brushes.map(item => item.id)).size).toBe(result.presets.brushes.length);
  });

  it('imports into a set that exists', () => {
    const result = importBrushFile(library(), incoming(), new Set(['b1']), { setId: 'bg' }, newId);
    expect(result.ok && setContents(result.presets, 'bg').brushes.map(item => item.name)).toEqual(['Leaves', 'Fresh']);
  });

  it('imports nothing past the limit, and says how much room is left', () => {
    let p = library();
    for (let i = p.brushes.length; i < PRESETS_MAX - 1; i++) {
      p = saveBrush(p, brush(`f${i}`));
    }
    const result = importBrushFile(p, incoming(), new Set(['b0', 'b1']), { newSet: { id: 'new', name: 'More' } }, newId);
    expect(result).toEqual({ ok: false, reason: 'full', room: { brushes: 1, tones: PRESETS_MAX - 2 } });
    let sets = library();
    for (let i = sets.sets.length; i < SETS_MAX; i++) {
      sets = addSet(sets, `s${i}`, `Set ${i}`);
    }
    expect(importBrushFile(sets, incoming(), new Set(['b1']), { newSet: { id: 'new', name: 'More' } }, newId)).toMatchObject({
      ok: false,
      reason: 'sets',
    });
    expect(importBrushFile(sets, incoming(), new Set(['b1']), { setId: 'bg' }, newId).ok).toBe(true);
    expect(importBrushFile(library(), incoming(), new Set(), { setId: 'bg' }, newId)).toMatchObject({ ok: false, reason: 'nothing' });
  });
});
