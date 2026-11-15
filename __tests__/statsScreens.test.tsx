import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_PROGRESS } from '../src/core/stats/progress';
import { shiftDay } from '../src/core/story/activity';
import { dayKey } from '../src/core/util/time';
import { StatsMetricScreen } from '../src/features/stats/StatsMetricScreen';
import { StatsScreen } from '../src/features/stats/StatsScreen';
import { useActivity } from '../src/state/useActivity';
import { useStats } from '../src/state/useStats';
import { useStory } from '../src/state/useStory';
import { addChapter, addCharacter, addPage, addProject, addScene, emptyStory } from './helpers/studioStory';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const shared = <T,>(value: T) => ({ value, get: () => value, set: () => {} });
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
    withTiming: <T,>(value: T) => value,
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

const STORY_KEYS = ['projects', 'chapters', 'scenes', 'characters', 'relations', 'world', 'pages'] as const;

function useData(state = emptyStory()) {
  useStory.setState(Object.fromEntries(STORY_KEYS.map(key => [key, state[key]])));
}

const today = dayKey();

beforeEach(() => {
  mockNavigate.mockClear();
  mockParams = undefined;
  useData();
  useActivity.setState({ days: {}, total: 0 }, true);
  useStats.setState({ progress: { ...EMPTY_PROGRESS, since: today }, sessions: [] }, true);
});

describe('statistics screen', () => {
  it('shows an empty account without breaking, and says the heatmap is collecting', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText('Statistics')).toBeTruthy();
    expect(screen.getByText('Collecting data')).toBeTruthy();
    expect(screen.getByText('No one has spoken yet')).toBeTruthy();
    expect(screen.getAllByText('Not yet').length).toBeGreaterThan(0);
  });

  it('shows strokes, who appears most, and opens a metric', async () => {
    useActivity.setState({ days: { [today]: 120, [shiftDay(today, -1)]: 30 }, total: 4000 }, true);
    useStats.setState({ progress: { since: shiftDay(today, -3), days: { [today]: { pagesDone: 2, words: 50 } } } });
    const state = emptyStory();
    addProject(state, 'p1', 'One');
    addCharacter(state, 'p1', 'aki', { name: 'Aki' });
    addChapter(state, 'p1', 'c1');
    addScene(state, 'c1', 's1', [{ type: 'dialogue', text: 'Hello there', characterId: 'aki' }]);
    addPage(state, 'c1', 'pg1', { done: true });
    useData(state);

    await render(<StatsScreen />);
    expect(screen.getByText('1. Aki')).toBeTruthy();
    expect(screen.getAllByText('2 days').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Pages finished: 2'));
    expect(mockNavigate).toHaveBeenCalledWith('StatsMetric', { metric: 'pagesDone', period: 'week' });

    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));
    // All time counts what the stories hold now: one finished page.
    expect(screen.getByLabelText('Pages finished: 1')).toBeTruthy();
    expect(screen.getByText('4,000')).toBeTruthy();
  });

  it('steps back a period, not past today and not before the first data', async () => {
    useActivity.setState({ days: { [shiftDay(today, -8)]: 5 }, total: 5 }, true);
    await render(<StatsScreen />);
    const next = screen.getByLabelText('Next week');
    expect(next.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.press(screen.getByLabelText('Previous week'));
    expect(screen.getByLabelText('Next week').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
    await fireEvent.press(screen.getByLabelText('Previous week'));
    expect(screen.getByLabelText('Previous week').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });
});

describe('metric detail', () => {
  it('shows the total, a word from Mori and the number for each day', async () => {
    mockParams = { metric: 'strokes', period: 'week' };
    useActivity.setState({ days: { [today]: 80 }, total: 80 }, true);
    await render(<StatsMetricScreen />);
    expect(screen.getByText('Strokes drawn')).toBeTruthy();
    expect(screen.getByText('Mori')).toBeTruthy();
    expect(screen.getByText('Each day')).toBeTruthy();
    expect(screen.getAllByText('80').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'Year' }));
    expect(screen.getByText('Each month')).toBeTruthy();
  });

  it('says it only started counting for metrics recorded from now on', async () => {
    mockParams = { metric: 'bubbles', period: 'month' };
    useStats.setState({ progress: { since: today, days: {} } });
    await render(<StatsMetricScreen />);
    expect(screen.getByText('Bubbles lettered')).toBeTruthy();
    expect(
      screen.getByText('I only started keeping this count recently. Give it a few days and the chart will fill in.'),
    ).toBeTruthy();
  });
});
