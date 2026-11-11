import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { characterCard } from '../src/core/studio/cards';
import { parseStudio } from '../src/core/studio/studioState';
import { EMPTY_STUDIO } from '../src/core/studio/types';
import { CardsScreen } from '../src/features/studio/CardsScreen';
import { ClubScreen } from '../src/features/studio/ClubScreen';
import { JourneyScreen } from '../src/features/studio/JourneyScreen';
import { MagazineScreen } from '../src/features/studio/MagazineScreen';
import { MailboxScreen } from '../src/features/studio/MailboxScreen';
import { missingProfileParts, nextRarity } from '../src/features/studio/cards/cardProfile';
import { useStory } from '../src/state/useStory';
import { useStudio } from '../src/state/useStudio';
import { addCharacter, addProject, emptyStory, sampleStory } from './helpers/studioStory';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const shared = <T,>(value: T) => ({
    value,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  });
  const noop = () => {};
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    Easing: { in: () => noop, inOut: () => noop, cubic: noop },
    isSharedValue: () => false,
    useAnimatedReaction: noop,
    useDerivedValue: <T,>(value: () => T) => shared(value()),
    useAnimatedStyle: (style: () => object) => style(),
    useReducedMotion: () => true,
    useSharedValue: shared,
    withSpring: <T,>(value: T) => value,
    withTiming: <T,>(value: T, _config?: object, done?: (finished: boolean) => void) => {
      done?.(true);
      return value;
    },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => run(...args) }));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#000000' }));
const mockNavigate = jest.fn();
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('../src/render/thumbs', () => ({ useThumb: () => null }));
jest.mock('../src/features/studio/cards/shareCard', () => ({ shareCardImage: jest.fn() }));

const STORY_KEYS = ['projects', 'chapters', 'scenes', 'characters', 'relations', 'world', 'pages'] as const;

function useData(state = emptyStory()) {
  useStory.setState(Object.fromEntries(STORY_KEYS.map(key => [key, state[key]])));
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockParams = undefined;
  useStudio.setState({ ...EMPTY_STUDIO });
  useData();
});

describe('card frames', () => {
  it('keeps a chosen frame only while it is won', () => {
    const state = sampleStory();
    const id = Object.keys(state.characters)[0];
    expect(characterCard(state, id, { unlocked: [], cardFrames: { [id]: 'gold' } }).frame).toBe('plain');
    expect(characterCard(state, id, { unlocked: ['frame:gold', 'frame:ink'], cardFrames: { [id]: 'gold' } }).frame).toBe('gold');
    // Without a choice, the newest won frame.
    expect(characterCard(state, id, { unlocked: ['frame:gold', 'frame:ink'] }).frame).toBe('ink');
    expect(characterCard(state, id, { unlocked: ['frame:ink'], cardFrames: { [id]: 'plain' } }).frame).toBe('plain');
  });

  it('parses saved frames and drops junk', () => {
    const raw = JSON.stringify({ cardFrames: { a: 'gold', b: 7, c: 'NOT A FRAME', '': 'ink' } });
    expect(parseStudio(raw).cardFrames).toEqual({ a: 'gold' });
    expect(parseStudio('{}').cardFrames).toEqual({});
  });

  it('refuses a frame that was not won', () => {
    useStudio.getState().setCardFrame('a', 'gold');
    expect(useStudio.getState().cardFrames).toEqual({});
    useStudio.setState({ unlocked: ['frame:gold'] });
    useStudio.getState().setCardFrame('a', 'gold');
    useStudio.getState().setCardFrame('b', 'plain');
    expect(useStudio.getState().cardFrames).toEqual({ a: 'gold', b: 'plain' });
  });
});

describe('card profile', () => {
  it('lists what is missing and how far the next rarity is', () => {
    const state = emptyStory();
    addProject(state, 'p', 'Story');
    const empty = addCharacter(state, 'p', 'x', { name: 'X' });
    expect(missingProfileParts(state, empty)).toHaveLength(11);
    expect(nextRarity(state, empty)).toEqual({ rarity: 'rare', parts: expect.any(Number) });
    const full = addCharacter(state, 'p', 'y', {
      name: 'Y',
      age: '16',
      gender: 'girl',
      appearance: 'tall',
      goal: 'win',
      weakness: 'pride',
      voice: 'loud',
      bio: 'grew up by the sea',
      traits: ['brave', 'kind'],
      sheet: { face: 'face.png', expressions: { happy: 'a.png', sad: 'b.png', angry: 'c.png' } },
    });
    expect(missingProfileParts(state, full)).toEqual(['A relationship with another character']);
    expect(nextRarity(state, full)).toBeNull();
  });
});

describe('studio screens', () => {
  it('introduces the club once, then shows an empty state with a next step', async () => {
    await render(<ClubScreen />);
    expect(screen.getByText('The Manganova reading club')).toBeTruthy();
    expect(screen.getByText('Tetsu')).toBeTruthy();
    await fireEvent.press(screen.getByText('See what they think'));
    expect(useStudio.getState().clubIntroSeen).toBe(true);
    expect(await screen.findByText('Nothing for the club to read yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Start a story'));
    expect(mockNavigate).toHaveBeenCalledWith('NewProject');
  });

  it('ranks chapters and opens one with every member vote', async () => {
    useData(sampleStory());
    useStudio.setState({ clubIntroSeen: true });
    await render(<ClubScreen />);
    const first = await screen.findByLabelText(/^Rank 1: /);
    await fireEvent.press(first);
    expect(screen.getByText('Open storyboard')).toBeTruthy();
    expect(screen.getAllByLabelText(/out of 5 stars$/).length).toBeGreaterThanOrEqual(13);
  });

  it('shows a card per character and opens the big card', async () => {
    const state = emptyStory();
    addProject(state, 'p', 'Moon Bakery');
    addCharacter(state, 'p', 'aki', { name: 'Aki', role: 'main' });
    useData(state);
    await render(<CardsScreen />);
    expect(screen.getByText('Moon Bakery')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText(/^Aki, /)[0]);
    expect(await screen.findByText('Turn over')).toBeTruthy();
    expect(screen.getByText('Plain frame')).toBeTruthy();
  });

  it('shows empty states for cards, letters and the magazine', async () => {
    await render(<CardsScreen />);
    expect(screen.getByText('No cards yet')).toBeTruthy();
    await render(<MailboxScreen />);
    expect(screen.getByText('No letters yet')).toBeTruthy();
    await render(<MagazineScreen />);
    expect(screen.getByText('Your magazine starts with your first story')).toBeTruthy();
  });

  it('marks the level and earned badges as seen on the journey', async () => {
    useData(sampleStory());
    await render(<JourneyScreen />);
    expect(screen.getByText('Mangaka journey')).toBeTruthy();
    expect(useStudio.getState().badgesSeen.length).toBeGreaterThan(0);
  });

  it('opens a letter and marks it read', async () => {
    useData(sampleStory());
    await render(<MailboxScreen />);
    const letters = screen.getAllByLabelText(/^Unread\. From /);
    await fireEvent.press(letters[0]);
    expect(useStudio.getState().mailRead).toHaveLength(1);
  });
});
