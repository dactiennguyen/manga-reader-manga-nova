import {
  NARRATOR_ROLE,
  UNKNOWN_ROLE,
  autoRoles,
  castOf,
  cleanRoles,
  dubLines,
  linesFor,
  parseScript,
  readRows,
  scriptOptions,
  voiceOf,
  type DubSource,
} from '../src/core/nearby/dub';
import {
  MAX_CLIP_MS,
  clampClipMs,
  clipFileName,
  clipsInOrder,
  isStale,
  parseClipIndex,
  playlistText,
  progressOf,
  sourceOf,
  withClip,
  withoutClip,
  type ClipEntry,
} from '../src/core/nearby/dubClips';
import { hasVoices, voicedLines } from '../src/core/nearby/dubPlay';
import type { Bubble, BubbleType, Character, Page } from '../src/core/model/types';

function bubble(id: string, type: BubbleType, text: string, x: number, y: number, patch: Partial<Bubble> = {}): Bubble {
  return { id, type, text, x, y, w: 160, h: 120, rotation: 0, tail: null, fontSize: 28, font: 'hand', bold: false, ...patch };
}

function page(id: string, bubbles: Bubble[], panels: Page['panels'] = { L: panel('L'), R: panel('R') }): Page {
  return {
    id,
    chapterId: 'c1',
    // A vertical cut: L on the left, R on the right.
    layout: { kind: 'split', id: 's', dir: 'v', t0: 0.5, t1: 0.5, a: { kind: 'panel', id: 'L' }, b: { kind: 'panel', id: 'R' } },
    panels,
    gutterH: 22,
    gutterV: 12,
    done: false,
    bubbles,
    effects: [],
    artRev: 0,
    updatedAt: 0,
  };
}

function panel(id: string, blockIds: string[] = []) {
  return { id, bleed: false, borderless: false, description: '', blockIds };
}

function story(pages: Page[], format: 'manga' | 'webtoon' = 'manga'): DubSource {
  return {
    projects: {
      p: {
        id: 'p', title: 'T', genres: [], logline: '', format, pageSize: 'B5', style: 'shounen', color: false, done: false,
        acts: [], createdAt: 0, updatedAt: 0,
      },
    },
    chapters: {
      c1: {
        id: 'c1', projectId: 'p', title: 'One', summary: '', goal: '', characterIds: [], sceneIds: ['sc'],
        pageIds: pages.map(item => item.id), createdAt: 0, updatedAt: 0,
      },
    },
    scenes: {
      sc: { id: 'sc', chapterId: 'c1', description: '', blocks: [{ id: 'blk', type: 'dialogue', text: 'Hi', characterId: 'ren' }] },
    },
    pages: Object.fromEntries(pages.map(item => [item.id, item])),
  };
}

const clip = (file: string, ms = 2000, text = ''): ClipEntry => ({ file, ms, by: 'Mai', text, at: 1 });

describe('dub lines', () => {
  it('reads a manga page right panel first, then right to left within a row, and skips sound effects', () => {
    const lines = dubLines(
      story([
        page('pg1', [
          bubble('left', 'speak', 'Left panel', 100, 200, { characterId: 'aki' }),
          bubble('rowLeft', 'speak', 'Same row, left', 560, 100),
          bubble('rowRight', 'shout', 'Same row, right', 780, 120, { characterId: 'aki' }),
          bubble('boom', 'sfx', 'BOOM', 700, 600),
          bubble('below', 'narration', 'Later that day', 600, 500, { characterId: 'aki' }),
          bubble('empty', 'speak', '  ', 600, 900),
        ]),
        page('pg2', [bubble('next', 'think', 'Hmm', 100, 100)]),
      ]),
      'c1',
    );
    expect(lines.map(line => line.bubbleId)).toEqual(['rowRight', 'rowLeft', 'below', 'left', 'next']);
    expect(lines.map(line => line.role)).toEqual(['aki', UNKNOWN_ROLE, NARRATOR_ROLE, 'aki', UNKNOWN_ROLE]);
    expect(lines[4]).toMatchObject({ pageId: 'pg2', pageIndex: 1, type: 'think' });
  });

  it('reads left to right in a webtoon', () => {
    const lines = dubLines(story([page('pg1', [bubble('b', 'speak', 'B', 780, 100), bubble('a', 'speak', 'A', 100, 100)])], 'webtoon'), 'c1');
    expect(lines.map(line => line.bubbleId)).toEqual(['a', 'b']);
  });

  it('takes the character and panel from the linked script block', () => {
    const lines = dubLines(
      story([
        page('pg1', [bubble('linked', 'speak', 'Hi', 100, 100, { blockId: 'blk' }), bubble('right', 'speak', 'Yo', 700, 600)], {
          L: panel('L'),
          R: panel('R', ['blk']),
        }),
      ]),
      'c1',
    );
    // Drawn over the left panel, but its block belongs to the right one, which a manga reads first.
    expect(lines.map(line => [line.bubbleId, line.characterId])).toEqual([
      ['linked', 'ren'],
      ['right', undefined],
    ]);
  });

  it('groups bubbles into rows by the height of the first one', () => {
    const at = (id: string, x: number, y: number) => ({ id, x, y, w: 100, h: 100 });
    expect(readRows([at('low', 0, 150), at('b', 300, 30), at('a', 0, 0)], false).map(item => item.id)).toEqual(['a', 'b', 'low']);
  });

  it('is empty for a chapter that does not exist', () => {
    expect(dubLines(story([]), 'nope')).toEqual([]);
  });
});

describe('roles', () => {
  const lines = [
    { role: 'aki', characterId: 'aki' },
    { role: 'aki', characterId: 'aki' },
    { role: 'aki', characterId: 'aki' },
    { role: NARRATOR_ROLE },
    { role: 'ren', characterId: 'ren' },
    { role: 'ren', characterId: 'ren' },
  ];

  it('lists the cast in speaking order with line counts', () => {
    expect(castOf(lines)).toEqual([
      { role: 'aki', characterId: 'aki', lines: 3 },
      { role: NARRATOR_ROLE, characterId: undefined, lines: 1 },
      { role: 'ren', characterId: 'ren', lines: 2 },
    ]);
  });

  it('shares roles out fairly, host first', () => {
    expect(autoRoles(castOf(lines), ['host', 'guest'])).toEqual({ aki: 'host', ren: 'guest', [NARRATOR_ROLE]: 'guest' });
    expect(autoRoles(castOf(lines), [])).toEqual({});
  });

  it('gives each person only their lines, and unassigned or departed roles to the host', () => {
    const roles = { aki: 'guest', ren: 'gone' };
    expect(voiceOf(roles, 'aki', 'host')).toBe('guest');
    expect(voiceOf(roles, NARRATOR_ROLE, 'host')).toBe('host');
    expect(voiceOf(roles, 'ren', 'host', ['host', 'guest'])).toBe('host');
    expect(linesFor(lines, roles, 'guest', 'host', ['host', 'guest'])).toHaveLength(3);
    expect(linesFor(lines, roles, 'host', 'host', ['host', 'guest'])).toHaveLength(3);
  });

  it('keeps only known roles for people in the room from the network', () => {
    expect(cleanRoles({ aki: 'guest', ghost: 'guest', ren: 'stranger' }, ['aki', 'ren'], ['host', 'guest'])).toEqual({ aki: 'guest' });
  });

  it('round-trips the script through the room options and rejects a bad one', () => {
    const script = { chapterId: 'c1', title: 'One', names: { aki: 'Aki' }, lines: dubLines(story([page('pg1', [bubble('a', 'speak', 'A', 0, 0)])]), 'c1') };
    expect(parseScript(scriptOptions(script))).toEqual(script);
    expect(parseScript({ dub: { ...script, lines: [{ bubbleId: 'x' }] } })).toBeNull();
    expect(parseScript(undefined)).toBeNull();
  });
});

describe('clip index', () => {
  it('replaces a take and hands back the old file, removes clips and empty chapters', () => {
    const first = withClip({}, 'c1', 'b1', clip('voices/a.m4a'));
    expect(first.replaced).toBeUndefined();
    const second = withClip(first.index, 'c1', 'b1', clip('voices/b.m4a'));
    expect(second.replaced).toBe('voices/a.m4a');
    expect(second.index.c1.b1.file).toBe('voices/b.m4a');
    const gone = withoutClip(second.index, 'c1', 'b1');
    expect(gone.removed).toBe('voices/b.m4a');
    expect(gone.index).toEqual({});
    expect(withoutClip({}, 'c1', 'b1').removed).toBeUndefined();
  });

  it('survives broken storage and drops only the bad entries', () => {
    expect(parseClipIndex(null)).toEqual({});
    expect(parseClipIndex('not json')).toEqual({});
    const parsed = parseClipIndex(JSON.stringify({ c1: { good: clip('a.m4a'), bad: { file: 3 } }, c2: { bad: null } }));
    expect(parsed).toEqual({ c1: { good: clip('a.m4a') } });
  });

  it('flags a clip whose bubble was rewritten, caps length and builds safe file names', () => {
    expect(isStale({ text: 'Hello' }, ' Hello ')).toBe(false);
    expect(isStale({ text: 'Hello' }, 'Bye')).toBe(true);
    expect(clampClipMs(99999)).toBe(MAX_CLIP_MS);
    expect(clampClipMs(Number.NaN)).toBe(0);
    expect(clipFileName('../c1', 'b/1', 1000)).toBe('c1-b1-rs.m4a');
  });
});

describe('playing with voices', () => {
  const aki: Character = {
    id: 'aki', projectId: 'p', name: 'Aki', role: 'main', age: '16', gender: 'girl', traits: [], goal: '', weakness: '', voice: '', bio: '',
    notes: '', appearance: '', sheet: { expressions: {} }, locked: false, createdAt: 0, updatedAt: 0,
  };
  const lines = [
    { bubbleId: 'b1', pageId: 'pg', text: 'Night.', type: 'narration' as const, role: NARRATOR_ROLE, pageIndex: 0 },
    { bubbleId: 'b2', pageId: 'pg', text: 'Who?', type: 'shout' as const, role: 'aki', characterId: 'aki', pageIndex: 0 },
    { bubbleId: 'b3', pageId: 'pg', text: 'Me.', type: 'speak' as const, role: 'zed', characterId: 'zed', pageIndex: 0 },
  ];
  const clips = { b2: clip('voices/b2.m4a', 1800, 'Who?'), b3: clip('voices/b3.m4a', 100) };

  it('plays a recorded clip where there is one and falls back to text-to-speech elsewhere', () => {
    expect(sourceOf('b2', clips)).toEqual({ kind: 'clip', file: 'voices/b2.m4a', ms: 1800 });
    expect(sourceOf('b1', clips)).toEqual({ kind: 'tts' });
    // Too short to be a real take.
    expect(sourceOf('b3', clips)).toEqual({ kind: 'tts' });
    expect(sourceOf(undefined, clips)).toEqual({ kind: 'tts' });
  });

  it('turns the dub into table-read lines with speakers and voices', () => {
    const voiced = voicedLines(lines, { aki }, { zed: 'Zed' }, clips);
    expect(voiced.map(line => [line.blockId, line.narrator, line.speaker, line.source.kind])).toEqual([
      ['b1', true, null, 'tts'],
      ['b2', false, 'Aki', 'clip'],
      ['b3', false, 'Zed', 'tts'],
    ]);
    expect(voiced[1].gender).toBe('female');
    expect(hasVoices(lines, clips)).toBe(true);
    expect(hasVoices(lines, {})).toBe(false);
  });

  it('orders clips for the shared file and writes a playlist that keeps unvoiced lines as comments', () => {
    expect(clipsInOrder(lines, clips).map(entry => entry.file)).toEqual(['voices/b2.m4a']);
    expect(progressOf(lines, clips)).toEqual({ done: 1, total: 3 });
    const text = playlistText('Ch 1', lines, clips, { [NARRATOR_ROLE]: 'Narrator', aki: 'Aki', zed: 'Zed' }, entry => entry.file.split('/')[1]);
    expect(text).toBe('#EXTM3U\n#PLAYLIST:Ch 1\n# Narrator: Night.\n#EXTINF:2,Aki - Who?\nb2.m4a\n# Zed: Me.\n');
  });
});
