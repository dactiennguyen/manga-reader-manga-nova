import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { RefObject } from 'react';

import { setLocale } from '../src/core/i18n';
import { computePanels, hitTestPanel, isRtl, pageSize } from '../src/core/layout/layout';
import { bubbleCenter, createBubble } from '../src/core/lettering/bubbles';
import { BUBBLE_FONTS, FONT_NAME } from '../src/core/lettering/fonts';
import { chapterIdsOf } from '../src/core/model/selectors';
import type { ID } from '../src/core/model/types';
import { LetteringScreen } from '../src/features/lettering/LetteringScreen';
import type { LetteringGestureHandlers } from '../src/features/lettering/LetteringGestures';
import { useHistory, useStory } from '../src/state/useStory';

jest.mock('react-native-reanimated', () => {
  const { FlatList, ScrollView, View } = require('react-native');
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
    default: { View, ScrollView, FlatList, createAnimatedComponent: (component: unknown) => component },
    Easing: { in: () => noop, cubic: noop },
    isSharedValue: () => false,
    scrollTo: noop,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => noop,
    useAnimatedStyle: (style: () => object) => style(),
    useComposedEventHandler: () => noop,
    useDerivedValue: <T,>(value: () => T) => shared(value()),
    useFrameCallback: () => ({ setActive: noop }),
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
jest.mock('@shopify/react-native-skia', () => ({}));
jest.mock('react-native-svg', () => new Proxy({ __esModule: true }, { get: () => () => null }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNav,
}));
jest.mock('../src/render/PageView', () => {
  const { useProjectOfPage, usePage } = require('../src/state/hooks');
  const { buildPageContext } = require('../src/render/drawPage');
  return {
    PageView: () => null,
    usePageContext: (id: string) => {
      const page = usePage(id);
      const project = useProjectOfPage(id);
      return page && project ? buildPageContext(page, project) : null;
    },
  };
});
jest.mock('../src/render/drawPage', () => {
  const { computePanels: shapesOf, isRtl: rtlOf, pageSize: sizeOf } = require('../src/core/layout/layout');
  return {
    buildPageContext: (page: object, project: { format: string }) => {
      const size = sizeOf(project, page);
      const rtl = rtlOf(project);
      return { page, project, size, rtl, shapes: shapesOf(page, size, { rtl }) };
    },
  };
});
jest.mock('../src/render/drawBubble', () => ({ bubbleMeasure: () => () => 0, drawBubble: () => {} }));
// No fonts, as in the moment before they load: tiles and font chips fall back to plain text.
jest.mock('../src/render/fonts', () => ({ useEngineFonts: () => null }));
jest.mock('../src/render/thumbs', () => ({ useThumb: () => null }));
jest.mock('../src/native/files', () => ({ MIME: { text: 'text/plain' }, RNFS: {}, pickImage: jest.fn(), shareFile: jest.fn() }));
jest.mock('../src/features/lettering/LetteringGestures', () => {
  const actual = jest.requireActual('../src/features/lettering/LetteringGestures');
  return {
    ...actual,
    LetteringGestureLayer: (props: { live: RefObject<LetteringGestureHandlers> }) => {
      mockTouch.lettering = props.live;
      return require('react').createElement(actual.LetteringGestureLayer, props);
    },
  };
});

const mockTouch: { lettering?: RefObject<LetteringGestureHandlers> } = {};
const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), canGoBack: () => true };

const BOX = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } } };

const story = () => useStory.getState();
const page = (id: ID) => story().pages[id];

function setup(): ID {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
  const projectId = story().createProject({
    title: 'Story',
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
  });
  const pageId = story().addPage(chapterIdsOf(story().projects[projectId])[0], { templateId: 'g3-rows' });
  useHistory.setState({ history: {} });
  return pageId;
}

function panelsOf(pageId: ID) {
  const project = Object.values(story().projects)[0];
  return computePanels(page(pageId), pageSize(project, page(pageId)), { rtl: isRtl(project) });
}

async function open(pageId: ID) {
  await render(<LetteringScreen {...({ route: { params: { pageId } }, navigation: mockNav } as any)} />);
  await act(async () => fireEvent(screen.getByTestId('lettering-stage'), 'layout', BOX));
}

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

/** The add row behind the sheet has a chip with the same name as the tab, so the tab is found by role. */
async function pressTab(name: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole('tab', { name }));
  });
}

afterEach(() => {
  setLocale('en');
});

describe('lettering presets', () => {
  it('drops a ready-made bubble in the first panel, selected, as one undo step', async () => {
    const pageId = setup();
    await open(pageId);
    await press('Presets');
    expect(screen.getByText('Tap one to add it to panel 1')).toBeTruthy();
    await press('Add the Shout preset');

    const [made] = page(pageId).bubbles;
    expect(page(pageId).bubbles).toHaveLength(1);
    expect(made).toMatchObject({ type: 'shout', text: 'Watch out!', font: 'comic' });
    const first = panelsOf(pageId)[0];
    expect(hitTestPanel(panelsOf(pageId), bubbleCenter(made))).toBe(first.id);
    expect(bubbleCenter(made).x).toBeCloseTo(first.bbox.x + first.bbox.w / 2, 5);

    // The sheet is gone, the bubble card is up and the text editor did not open.
    expect(screen.queryByLabelText('Add the Shout preset')).toBeNull();
    expect(screen.getByLabelText('Edit text')).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
    expect(useHistory.getState().history[`page:${pageId}`]?.past).toHaveLength(1);

    await press('Undo');
    expect(page(pageId).bubbles).toHaveLength(0);
  });

  it('adds to the panel of the selected bubble, beside what is already there', async () => {
    const pageId = setup();
    const last = panelsOf(pageId)[2];
    const centre = { x: last.bbox.x + last.bbox.w / 2, y: last.bbox.y + last.bbox.h / 2 };
    const held = createBubble('speak', centre, { w: 200, h: 120, text: 'Hi', tail: null });
    story().updatePage(pageId, { bubbles: [held] });
    await open(pageId);
    const size = pageSize(Object.values(story().projects)[0], page(pageId));
    const scale = Math.min(400 - 24, ((600 - 24) * size.w) / size.h) / size.w;
    await act(async () =>
      (mockTouch.lettering as RefObject<LetteringGestureHandlers>).current.tap(
        (400 - size.w * scale) / 2 + centre.x * scale,
        (600 - size.h * scale) / 2 + centre.y * scale,
      ),
    );
    await press('Presets');
    expect(screen.getByText('Tap one to add it to panel 3')).toBeTruthy();
    await pressTab('Sound effects');
    await press('Add the BOOM preset');

    const made = page(pageId).bubbles[1];
    expect(made).toMatchObject({ type: 'sfx', text: 'BOOM', tail: null });
    expect(hitTestPanel(panelsOf(pageId), bubbleCenter(made))).toBe(last.id);
    expect(bubbleCenter(made)).not.toEqual(bubbleCenter(held));
  });

  it.each([
    ['vi', 'Mẫu có sẵn', 'Tiếng động', 'Thêm mẫu ẦM', 'ẦM'],
    ['ja', 'プリセット', '効果音', 'プリセット「ドキドキ」を追加', 'ドキドキ'],
  ] as const)('offers the sound-effect word of the interface language (%s)', async (locale, presets, tab, tile, word) => {
    const pageId = setup();
    setLocale(locale);
    await open(pageId);
    await press(presets);
    await pressTab(tab);
    await press(tile);
    expect(page(pageId).bubbles[0].text).toBe(word);
  });

  it('lists every font in the bubble card with its languages, and sets the one tapped', async () => {
    const pageId = setup();
    await open(pageId);
    await press('Presets');
    await press('Add the Speech preset');
    expect(page(pageId).bubbles[0].font).toBe('hand');
    for (const font of BUBBLE_FONTS) {
      expect(screen.getByText(FONT_NAME[font])).toBeTruthy();
    }
    expect(screen.getByLabelText('Patrick Hand, Handwritten, Tiếng Việt').props.accessibilityState).toMatchObject({ selected: true });
    await press('Dela Gothic One, Heavy, Tiếng Việt, 日本語');
    expect(page(pageId).bubbles[0].font).toBe('heavy');
    await press('Yusei Magic, Marker, 日本語');
    expect(page(pageId).bubbles[0].font).toBe('marker');
  });
});
