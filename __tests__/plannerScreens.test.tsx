import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_PLANNER } from '../src/core/planner/data';
import { addDays, weekStartOf } from '../src/core/planner/days';
import { makePlan } from '../src/core/planner/plan';
import { EMPTY_ACTIVITY } from '../src/core/story/activity';
import { dayKey } from '../src/core/util/time';
import { CalendarScreen } from '../src/features/planner/CalendarScreen';
import { ChapterPlanScreen } from '../src/features/planner/ChapterPlanScreen';
import { TodayPlanCard, WeekSummaryCard } from '../src/features/planner/HomePlanCards';
import { WeekSummaryScreen } from '../src/features/planner/WeekSummaryScreen';
import type { HomeData } from '../src/features/home/useHomeData';
import { useActivity } from '../src/state/useActivity';
import { usePlanner } from '../src/state/usePlanner';
import { useStory } from '../src/state/useStory';
import { addChapter, addPage, addProject, emptyStory } from './helpers/studioStory';

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
  return {
    __esModule: true,
    default: { View, ScrollView, createAnimatedComponent: (component: unknown) => component },
    Easing: { in: () => noop, inOut: () => noop, out: () => noop, sin: noop, cubic: noop },
    isSharedValue: () => false,
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
jest.mock('react-native-svg', () => new Proxy({ __esModule: true }, { get: () => () => null }));
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
}));

const mockNav = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() };

function loadStory() {
  const state = emptyStory();
  addProject(state, 'p1', 'Moon Bakery');
  addChapter(state, 'p1', 'c1');
  addChapter(state, 'p1', 'c2', { title: 'The oven' });
  for (let i = 1; i <= 6; i++) {
    addPage(state, 'c1', `a${i}`, { done: i === 1 });
  }
  useStory.setState(state);
  return state;
}

beforeEach(() => {
  jest.clearAllMocks();
  usePlanner.setState({ ...EMPTY_PLANNER });
  useActivity.setState(EMPTY_ACTIVITY, true);
});

describe('chapter plan', () => {
  it("starts a plan from the chapter's pages and shows where it stands", async () => {
    loadStory();
    mockParams = { chapterId: 'c1' };
    await render(<ChapterPlanScreen />);
    expect(screen.getByText('Set a deadline')).toBeTruthy();
    // Five pages left over the next two weeks, every day.
    expect(screen.getByText('1 page a day over 15 work days.')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByLabelText('Skip weekends')));
    await act(async () => fireEvent.press(screen.getByLabelText('Start the plan')));
    const plan = usePlanner.getState().plans.c1;
    expect(plan).toMatchObject({ target: 6, workdays: [1, 2, 3, 4, 5], deadline: addDays(dayKey(), 14), startDone: 1 });
    expect(screen.getByText('Change the plan')).toBeTruthy();
    expect(screen.getByText('On track')).toBeTruthy();
    expect(screen.getByLabelText('Save changes')).toBeTruthy();
  });

  it('says so when the chapter is gone', async () => {
    loadStory();
    mockParams = { chapterId: 'nope' };
    await render(<ChapterPlanScreen />);
    expect(screen.getByText('This chapter was deleted.')).toBeTruthy();
  });
});

describe('calendar', () => {
  it('invites a first plan, then lists plans and the day', async () => {
    loadStory();
    await render(<CalendarScreen />);
    expect(screen.getByText('No deadlines yet')).toBeTruthy();

    const today = dayKey();
    await act(async () => {
      usePlanner.getState().setPlan(makePlan({ chapterId: 'c1', target: 6, deadline: addDays(today, 4), workdays: [0, 1, 2, 3, 4, 5, 6] }, 1, today));
    });
    expect(screen.queryByText('No deadlines yet')).toBeNull();
    expect(screen.getAllByText('Chapter 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 page today').length).toBeGreaterThan(0);

    await act(async () => fireEvent.press(screen.getByLabelText('Agenda')));
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
  });

  it('flags an overdue chapter', async () => {
    loadStory();
    const today = dayKey();
    usePlanner.setState({
      plans: {
        c1: { chapterId: 'c1', target: 6, deadline: addDays(today, -2), workdays: [0, 1, 2, 3, 4, 5, 6], start: addDays(today, -9), startDone: 0 },
      },
    });
    await render(<CalendarScreen />);
    expect(screen.getByText('Chapter 1 is past its deadline.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Change plan'));
    expect(mockNav.navigate).toHaveBeenCalledWith('ChapterPlan', { chapterId: 'c1' });
  });
});

describe('week summary', () => {
  it('sums the week and marks the summary seen', async () => {
    loadStory();
    const today = dayKey();
    useActivity.setState({ days: { [today]: 30 }, total: 30 }, true);
    mockParams = undefined;
    await render(<WeekSummaryScreen />);
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('1/7')).toBeTruthy();
    expect(usePlanner.getState().summarySeen).toBe(weekStartOf(today));
  });
});

describe('home cards', () => {
  it("shows today's plan and last week's summary once", async () => {
    const state = loadStory();
    const today = dayKey();
    const lastWeek = addDays(weekStartOf(today), -7);
    useActivity.setState({ days: { [lastWeek]: 50 }, total: 50 }, true);
    usePlanner.getState().setPlan(makePlan({ chapterId: 'c1', target: 6, deadline: addDays(today, 4), workdays: [0, 1, 2, 3, 4, 5, 6] }, 1, today));
    const data = { state, activity: useActivity.getState(), today } as HomeData;
    await render(
      <>
        <WeekSummaryCard data={data} />
        <TodayPlanCard data={data} />
      </>,
    );
    expect(screen.getByText("Today's plan")).toBeTruthy();
    expect(screen.getByText('1 page today')).toBeTruthy();
    expect(screen.getByText('Your week in review')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Put away until next week')));
    expect(screen.queryByText('Your week in review')).toBeNull();
  });
});
