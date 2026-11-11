import { act, renderHook } from '@testing-library/react-native';

import { useTableRead } from '../src/features/studio/useTableRead';
import { playFile, stopPlayback } from '../src/native/audio';
import { speak, speechAvailable, speechVoices, stopSpeech } from '../src/native/speech';
import { useDubClips } from '../src/state/useDubClips';
import { useStory } from '../src/state/useStory';
import type { Bubble } from '../src/core/model/types';

jest.mock('../src/native/speech', () => ({
  speak: jest.fn(),
  speechAvailable: jest.fn(),
  speechVoices: jest.fn(),
  stopSpeech: jest.fn(),
}));
jest.mock('../src/native/audio', () => ({ playFile: jest.fn(), stopPlayback: jest.fn() }));

const speakMock = speak as jest.Mock;
const playMock = playFile as jest.Mock;

let pending: ((finished: boolean) => void)[] = [];

const bubble = (id: string, text: string, y: number, patch: Partial<Bubble> = {}): Bubble => ({
  id, type: 'speak', text, x: 100, y, w: 200, h: 100, rotation: 0, tail: null, fontSize: 28, font: 'hand', bold: false, ...patch,
});

beforeEach(() => {
  pending = [];
  jest.clearAllMocks();
  const wait = () => new Promise<boolean>(resolve => pending.push(resolve));
  speakMock.mockImplementation(wait);
  playMock.mockImplementation(wait);
  (speechAvailable as jest.Mock).mockResolvedValue(true);
  (speechVoices as jest.Mock).mockResolvedValue([]);
  useStory.setState({
    projects: {
      p: { id: 'p', title: 'T', genres: [], logline: '', format: 'webtoon', pageSize: 'B5', style: 'shounen', color: false, done: false, acts: [], createdAt: 0, updatedAt: 0 },
    },
    chapters: {
      c1: { id: 'c1', projectId: 'p', title: '', summary: '', goal: '', characterIds: [], sceneIds: ['s1'], pageIds: ['pg'], createdAt: 0, updatedAt: 0 },
    },
    scenes: { s1: { id: 's1', chapterId: 'c1', description: '', blocks: [{ id: 'b1', type: 'dialogue', text: 'Script only line' }] } },
    characters: {},
    pages: {
      pg: {
        id: 'pg', chapterId: 'c1', layout: { kind: 'panel', id: 'P' }, panels: { P: { id: 'P', bleed: false, borderless: false, description: '', blockIds: [] } },
        gutterH: 22, gutterV: 12, done: false, effects: [], artRev: 0, updatedAt: 0,
        bubbles: [bubble('top', 'Recorded line', 100), bubble('low', 'Not recorded', 600), bubble('fx', 'BAM', 900, { type: 'sfx' })],
      },
    },
  });
  useDubClips.setState({ clips: { c1: { top: { file: '/voices/top.m4a', ms: 1500, by: 'Mai', text: 'Recorded line', at: 1 } } } });
});

describe('listening with recorded voices', () => {
  it('offers voices, plays the clip where there is one and the device voice elsewhere', async () => {
    const { result } = await renderHook(() => useTableRead('c1', true, {}, true));
    await act(async () => {});
    expect(result.current.canVoice).toBe(true);
    expect(result.current.lines.map(line => line.text)).toEqual(['Recorded line', 'Not recorded']);
    await act(async () => result.current.toggle());
    expect(playMock).toHaveBeenCalledWith('/voices/top.m4a', 1);
    expect(speakMock).not.toHaveBeenCalled();
    await act(async () => pending[0](true));
    expect(speakMock).toHaveBeenLastCalledWith('Not recorded', expect.anything());
    await act(async () => result.current.toggle());
    expect(stopPlayback).toHaveBeenCalled();
    expect(stopSpeech).toHaveBeenCalled();
  });

  it('plays a chapter recorded end to end on a phone with no device voice, at the chosen speed', async () => {
    (speechAvailable as jest.Mock).mockResolvedValue(false);
    useDubClips.setState({
      clips: {
        c1: {
          top: { file: '/voices/top.m4a', ms: 1500, by: 'Mai', text: 'Recorded line', at: 1 },
          low: { file: '/voices/low.m4a', ms: 1500, by: 'Ken', text: 'Not recorded', at: 1 },
        },
      },
    });
    const { result } = await renderHook(() => useTableRead('c1', true, {}, true));
    await act(async () => {});
    expect(result.current.status).toBe('ready');
    await act(async () => result.current.setSpeed(1.25));
    await act(async () => result.current.toggle());
    expect(playMock).toHaveBeenLastCalledWith('/voices/top.m4a', 1.25);
    await act(async () => pending[pending.length - 1](true));
    expect(playMock).toHaveBeenLastCalledWith('/voices/low.m4a', 1.25);
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('still asks for a device voice when some line has no clip', async () => {
    (speechAvailable as jest.Mock).mockResolvedValue(false);
    const { result } = await renderHook(() => useTableRead('c1', true, {}, true));
    await act(async () => {});
    expect(result.current.status).toBe('noVoice');
  });

  it('reads the script as before when voices are off or the chapter has none', async () => {
    useDubClips.setState({ clips: {} });
    const { result } = await renderHook(() => useTableRead('c1', true, {}, true));
    await act(async () => {});
    expect(result.current.canVoice).toBe(false);
    expect(result.current.lines.map(line => line.text)).toEqual(['Script only line']);
  });
});
