import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HomeScreen } from '../src/features/home/HomeScreen';
import { EMPTY_ACTIVITY } from '../src/core/story/activity';
import { EMPTY_STUDIO } from '../src/core/studio/types';
import { DAY_MS, dayKey } from '../src/core/util/time';
import { useActivity } from '../src/state/useActivity';
import { useStory } from '../src/state/useStory';
import { useStudio } from '../src/state/useStudio';
import { emptyStory, sampleStory } from './helpers/studioStory';

jest.mock('react-native-reanimated', () => {
  const { ScrollView, View } = require('react-native');
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
  const animation = { duration: () => animation, springify: () => animation };
  return {
    __esModule: true,
    default: { View, ScrollView, createAnimatedComponent: (component: unknown) => component },
    Easing: { in: () => noop, inOut: () => noop, out: () => noop, sin: noop, cubic: noop },
    FadeIn: animation,
    ZoomIn: animation,
    cancelAnimation: noop,
    useAnimatedStyle: (style: () => object) => style(),
    useDerivedValue: <T,>(value: () => T) => shared(value()),
    useReducedMotion: () => true,
    useSharedValue: shared,
    withRepeat: <T,>(value: T) => value,
    withSpring: <T,>(value: T) => value,
    withTiming: <T,>(value: T) => value,
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => run(...args) }));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#000000' }));
jest.mock('@shopify/react-native-skia', () => ({}));
jest.mock('react-native-svg', () => new Proxy({ __esModule: true }, { get: () => () => null }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useNavigation: () => mockNav,
}));
jest.mock('../src/native/files', () => ({ MIME: { text: 'text/plain' }, RNFS: {}, pickImage: jest.fn(), shareFile: jest.fn() }));
jest.mock('../src/render/thumbs', () => ({ useThumb: () => null }));
jest.mock('../src/render/drawPage', () => ({}));
jest.mock('../src/render/fonts', () => ({ useEngineFonts: () => null }));
jest.mock('../src/render/images', () => ({ loadImage: jest.fn(), useImageCacheRev: () => 0 }));
// The sheets have their own tests; here they only need to open.
jest.mock('../src/features/studio/TrailerSheet', () => ({ TrailerSheet: () => null }));
jest.mock('../src/features/studio/ListenSheet', () => ({
  ListenSheet: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>listen sheet</Text> : null;
  },
}));

const mockNav = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() };

/** Drawing on each of the last `days` days, today included. */
function streakOf(days: number) {
  const today = new Date();
  today.setHours(12);
  const out: Record<string, number> = {};
  for (let index = 0; index < days; index++) {
    out[dayKey(today.getTime() - index * DAY_MS)] = 120;
  }
  return { days: out, total: days * 120 };
}

beforeEach(() => {
  jest.clearAllMocks();
  useStudio.setState({ ...EMPTY_STUDIO });
  useActivity.setState(EMPTY_ACTIVITY, true);
});

describe('Home', () => {
  it('greets someone with no story yet and offers a way to start everywhere', async () => {
    useStory.setState(emptyStory());
    await render(<HomeScreen />);

    expect(screen.getByText('Hi there')).toBeTruthy();
    expect(screen.getByText('Mori')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('New story'));
    expect(mockNav.navigate).toHaveBeenCalledWith('NewProject');
    expect(screen.getByText('Start creating')).toBeTruthy();
    expect(screen.getByText('Open the sample story')).toBeTruthy();
    expect(screen.getByText("Today's prompt")).toBeTruthy();
    expect(screen.getByText('Rookie')).toBeTruthy();
    expect(screen.getByText('Next badges')).toBeTruthy();
    // Nothing that needs a story shows as an empty box.
    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.queryByText('Letters')).toBeNull();
    expect(screen.queryByText('My magazine')).toBeNull();
    expect(screen.queryByText('Your progress')).toBeNull();
  });

  it('shows the studio around a real story', async () => {
    useStory.setState(sampleStory());
    useActivity.setState(streakOf(3), true);
    await render(<HomeScreen />);

    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.getByText('Character cards')).toBeTruthy();
    expect(screen.getByText('Letters')).toBeTruthy();
    expect(screen.getAllByText('My magazine').length).toBeGreaterThan(0);
    expect(screen.getByText('Club ranking')).toBeTruthy();
    expect(screen.getByText('3 days')).toBeTruthy();
    expect(screen.queryByText('Open the sample story')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Listen to the chapter')));
    expect(screen.getByText('listen sheet')).toBeTruthy();
  });

  it('marks the prompt done, hides the editor for the day and opens a gift in place', async () => {
    useStory.setState(sampleStory());
    useActivity.setState(streakOf(3), true);
    await render(<HomeScreen />);

    await act(async () => fireEvent.press(screen.getByLabelText('Done')));
    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(Object.keys(useStudio.getState().promptDays)).toEqual([dayKey()]);

    await act(async () => fireEvent.press(screen.getByLabelText('Hide the note for today')));
    expect(screen.queryByText('Mori')).toBeNull();

    expect(screen.getByText('For a 3-day streak')).toBeTruthy();
    const open = screen.getByLabelText('Open');
    const openGift = jest.spyOn(useStudio.getState(), 'openGift');
    // A double tap: both presses land before the card re-renders, so both see the same gift.
    const click = open.props.onClick as (event: object) => void;
    await act(async () => {
      click({ nativeEvent: {}, persist: () => {} });
      click({ nativeEvent: {}, persist: () => {} });
    });
    expect(screen.getByText('You unlocked')).toBeTruthy();
    expect(openGift).toHaveBeenCalledTimes(1);
    expect(useStudio.getState().giftsOpened).toEqual(['streak-3']);
    expect(useStudio.getState().unlocked).toEqual([useStudio.getState().giftRewards['streak-3']]);
  });

  it('keeps the prompt done for the day after the story changes', async () => {
    useStory.setState(sampleStory());
    useStudio.setState({ promptDays: { [dayKey()]: 'prompt-from-before-an-edit' } });
    await render(<HomeScreen />);

    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(screen.queryByLabelText('Done')).toBeNull();
  });
});
