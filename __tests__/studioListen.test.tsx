import { act, renderHook } from '@testing-library/react-native';

import { useTableRead } from '../src/features/studio/useTableRead';
import { speak, speechAvailable, speechVoices, stopSpeech } from '../src/native/speech';
import { useStory } from '../src/state/useStory';

jest.mock('../src/native/speech', () => ({
  speak: jest.fn(),
  speechAvailable: jest.fn(),
  speechVoices: jest.fn(),
  stopSpeech: jest.fn(),
}));

const speakMock = speak as jest.Mock;
const available = speechAvailable as jest.Mock;
const voices = speechVoices as jest.Mock;
const stop = stopSpeech as jest.Mock;

/** Each spoken line waits here until the test finishes it. */
let pending: ((finished: boolean) => void)[] = [];

beforeEach(() => {
  pending = [];
  jest.clearAllMocks();
  speakMock.mockImplementation(() => new Promise<boolean>(resolve => pending.push(resolve)));
  available.mockResolvedValue(true);
  voices.mockResolvedValue([{ id: 'v-f', name: 'F', language: 'en-US', quality: 300, gender: 'female' }]);
  useStory.setState({
    chapters: {
      c1: { id: 'c1', projectId: 'p', title: '', summary: '', goal: '', characterIds: [], sceneIds: ['s1'], pageIds: [], createdAt: 0, updatedAt: 0 },
    },
    scenes: {
      s1: {
        id: 's1',
        chapterId: 'c1',
        description: '',
        blocks: [
          { id: 'b1', type: 'narration', text: 'Night fell.' },
          { id: 'b2', type: 'dialogue', text: 'Who goes there?', characterId: 'aki' },
        ],
      },
    },
    characters: {
      aki: {
        id: 'aki', projectId: 'p', name: 'Aki', role: 'main', age: '16', gender: 'girl', traits: [], goal: '', weakness: '', voice: '',
        bio: '', notes: '', appearance: '', sheet: { expressions: {} }, locked: false, createdAt: 0, updatedAt: 0,
      },
    },
  });
});

async function setup() {
  const hook = await renderHook(() => useTableRead('c1', true, {}));
  // Lets the voice check resolve.
  await act(async () => {});
  return hook;
}

describe('listening to a chapter', () => {
  it('reads the lines in turn with each speaker\'s voice, then stops at the end', async () => {
    const { result } = await setup();
    expect(result.current.status).toBe('ready');
    expect(result.current.language).toBe('en');
    await act(async () => result.current.toggle());
    expect(speakMock).toHaveBeenLastCalledWith('Night fell.', expect.objectContaining({ language: 'en', voiceId: null }));
    await act(async () => pending[0](true));
    expect(result.current.index).toBe(1);
    expect(speakMock).toHaveBeenLastCalledWith('Who goes there?', expect.objectContaining({ voiceId: 'v-f' }));
    // Moving on by itself does not stop the engine.
    expect(stop).not.toHaveBeenCalled();
    await act(async () => pending[1](true));
    expect(result.current.playing).toBe(false);
    // Play again starts from the top.
    await act(async () => result.current.toggle());
    expect(result.current.index).toBe(0);
  });

  it('stops the voice on pause and when a line is skipped', async () => {
    const { result } = await setup();
    await act(async () => result.current.toggle());
    await act(async () => result.current.next());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.index).toBe(1);
    // The cut-off line settles false and must not move the reader on.
    await act(async () => pending[0](false));
    expect(result.current.index).toBe(1);
    await act(async () => result.current.toggle());
    expect(stop).toHaveBeenCalledTimes(2);
    expect(result.current.playing).toBe(false);
  });

  it('says so when the device has no voice', async () => {
    available.mockResolvedValue(false);
    const { result } = await setup();
    expect(result.current.status).toBe('noVoice');
  });

  it('applies the speed to every line', async () => {
    const { result } = await setup();
    await act(async () => result.current.setSpeed(1.25));
    await act(async () => result.current.toggle());
    expect(speakMock.mock.calls[0][1].rate).toBeCloseTo(1.25);
  });
});
