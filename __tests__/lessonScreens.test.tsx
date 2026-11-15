import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { lessonById } from '../src/core/lessons/catalog';
import { EMPTY_LESSON_PROGRESS } from '../src/core/lessons/progress';
import { EMPTY_ACTIVITY } from '../src/core/story/activity';
import { dayKey } from '../src/core/util/time';
import { CoursesScreen } from '../src/features/lessons/CoursesScreen';
import { PracticeScreen } from '../src/features/lessons/PracticeScreen';
import { ResultScreen } from '../src/features/lessons/ResultScreen';
import { flushActivity, useActivity } from '../src/state/useActivity';
import type { ScreenProps } from '../src/state/navigation';
import { useLessons } from '../src/state/useLessons';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    useAnimatedStyle: (style: () => object) => style(),
    useReducedMotion: () => true,
    useSharedValue: <T,>(value: T) => ({ value }),
    withTiming: <T,>(value: T) => value,
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => run(...args) }));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#000000', ScopedTheme: ({ children }: { children: unknown }) => children }));
jest.mock('@shopify/react-native-skia', () => ({}));
// The drawings are Skia; here only the flow matters.
jest.mock('../src/features/lessons/LessonArt', () => ({ LessonArt: () => null, FULL_PAGE: { x: 0, y: 0, w: 900, h: 1200 } }));
// A pen that traces the guide exactly, one stroke per guide stroke.
jest.mock('../src/features/lessons/PracticePad', () => ({
  PracticePad: ({ guide, onStroke }: { guide: { points: number[] }[]; onStroke: (stroke: object) => void }) => {
    const { Text } = require('react-native');
    return <Text onPress={() => guide.forEach(item => onStroke({ tool: 'gpen', color: '#000000', size: 7, opacity: 1, points: item.points }))}>trace</Text>;
  },
}));
const mockNav = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(() => () => {}),
  getState: () => ({ routes: [] }),
};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
}));

function props<T extends 'LessonPractice' | 'LessonResult'>(name: T, lessonId: string): ScreenProps<T> {
  return { route: { key: 'k', name, params: { lessonId } }, navigation: mockNav } as unknown as ScreenProps<T>;
}

beforeEach(() => {
  jest.clearAllMocks();
  useLessons.setState({ progress: EMPTY_LESSON_PROGRESS, lastRun: null });
  useActivity.setState(EMPTY_ACTIVITY, true);
});

afterEach(() => flushActivity());

async function press(text: string) {
  await act(async () => fireEvent.press(screen.getByText(text)));
}

describe('drawing lessons', () => {
  it('lists the courses with the first lesson up next, all of them open', async () => {
    await render(<CoursesScreen />);
    expect(screen.getAllByText('Lines and pen control').length).toBeGreaterThan(0);
    expect(screen.getByText('Manga effects')).toBeTruthy();
    expect(screen.getByText('0 of 18 lessons done')).toBeTruthy();
    await press('Start lesson');
    expect(mockNav.navigate).toHaveBeenCalledWith('Lesson', { lessonId: 'lines-straight' });
    // Nothing is locked: a later lesson opens too.
    await press('Focus lines');
    expect(mockNav.navigate).toHaveBeenCalledWith('Lesson', { lessonId: 'fx-focus-lines' });
  });

  it('scores a practice run, counts its strokes for today and shows the result', async () => {
    const lesson = lessonById('lines-straight')!;
    await render(<PracticeScreen {...props('LessonPractice', lesson.id)} />);
    await act(async () => fireEvent(screen.getByTestId('practice-area'), 'layout', { nativeEvent: { layout: { width: 360, height: 520 } } }));
    for (const [index, step] of lesson.steps.entries()) {
      expect(screen.getByText(step.text)).toBeTruthy();
      await press('trace');
      await press(index < lesson.steps.length - 1 ? 'Next step' : 'Done');
    }
    expect(mockNav.replace).toHaveBeenCalledWith('LessonResult', { lessonId: lesson.id });
    const strokes = lesson.steps.reduce((sum, step) => sum + step.guide.length, 0);
    expect(useActivity.getState().days[dayKey()]).toBe(strokes);
    expect(useLessons.getState().progress.lessons[lesson.id]).toMatchObject({ best: 100, stars: 3, tries: 1 });

    await render(<ResultScreen {...props('LessonResult', lesson.id)} />);
    expect(screen.getByText('100/100')).toBeTruthy();
    expect(screen.getByText('+20 Studio points')).toBeTruthy();
    await press('Next lesson');
    expect(mockNav.replace).toHaveBeenCalledWith('Lesson', { lessonId: 'lines-curves' });
    await press('Try again');
    expect(mockNav.replace).toHaveBeenCalledWith('LessonPractice', { lessonId: lesson.id });
  });

  it('gives no star for skipped steps, but counts the try', async () => {
    const lesson = lessonById('eyes-simple')!;
    await render(<PracticeScreen {...props('LessonPractice', lesson.id)} />);
    for (const index of lesson.steps.keys()) {
      await press(index < lesson.steps.length - 1 ? 'Next step' : 'Done');
    }
    expect(useLessons.getState().progress.lessons[lesson.id]).toMatchObject({ best: 0, stars: 0, tries: 1 });
    await render(<ResultScreen {...props('LessonResult', lesson.id)} />);
    expect(screen.getByText('Try again slowly, right on the dashed lines.')).toBeTruthy();
    expect(screen.queryByText('+20 Studio points')).toBeNull();
  });
});
