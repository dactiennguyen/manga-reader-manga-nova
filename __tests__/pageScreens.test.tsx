import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { RefObject } from 'react';

import { collectPanelIds, computeDividers, pageSize } from '../src/core/layout/layout';
import { handlePoints } from '../src/core/layout/pageEdit';
import { createBubble } from '../src/core/lettering/bubbles';
import { gridSpecOf } from '../src/core/reorder/storyboardGrid';
import { chapterIdsOf } from '../src/core/model/selectors';
import type { Bubble, ID, ProjectFormat } from '../src/core/model/types';
import { LetteringScreen } from '../src/features/lettering/LetteringScreen';
import type { LetteringGestureHandlers } from '../src/features/lettering/LetteringGestures';
import { PanelLayoutScreen } from '../src/features/page/PanelLayoutScreen';
import type { PanelGestureHandlers } from '../src/features/page/PanelGestures';
import { StoryboardScreen } from '../src/features/storyboard/StoryboardScreen';
import { useGridDrag } from '../src/features/storyboard/useGridDrag';
import { useHistory, useStory } from '../src/state/useStory';
import { ConfirmHost, ToastHost } from '../src/ui';

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
  const { computePanels, isRtl, pageSize: sizeOf } = require('../src/core/layout/layout');
  return {
    buildPageContext: (page: object, project: { format: string }) => {
      const size = sizeOf(project, page);
      const rtl = isRtl(project);
      return { page, project, size, rtl, shapes: computePanels(page, size, { rtl }) };
    },
  };
});
jest.mock('../src/render/drawBubble', () => ({ bubbleMeasure: () => () => 0, drawBubble: () => {} }));
jest.mock('../src/render/fonts', () => ({ FONT_LABEL: { hand: 'Hand', sans: 'Sans' }, useEngineFonts: () => null }));
jest.mock('../src/render/thumbs', () => ({ useThumb: () => null }));
jest.mock('../src/native/files', () => ({ MIME: { text: 'text/plain' }, RNFS: {}, pickImage: jest.fn(), shareFile: jest.fn() }));
// The real gesture layers still mount. This only keeps hold of the ref they read, to drive it as touches would.
jest.mock('../src/features/page/PanelGestures', () => {
  const actual = jest.requireActual('../src/features/page/PanelGestures');
  return {
    ...actual,
    PanelGestureLayer: (props: { live: RefObject<PanelGestureHandlers> }) => {
      mockTouch.panel = props.live;
      return require('react').createElement(actual.PanelGestureLayer, props);
    },
  };
});
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

const mockTouch: {
  panel?: RefObject<PanelGestureHandlers>;
  lettering?: RefObject<LetteringGestureHandlers>;
} = {};

const mockNav = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => true,
};

const BOX = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } } };

const story = () => useStory.getState();
const page = (id: ID) => story().pages[id];

function setup(format: ProjectFormat = 'manga', templateId = 'g3-rows') {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
  useHistory.setState({ history: {} });
  const projectId = story().createProject({
    title: 'Story',
    genres: [],
    logline: '',
    format,
    pageSize: 'B5',
    style: 'shounen',
    color: false,
  });
  const chapterId = chapterIdsOf(story().projects[projectId])[0];
  const pageId = story().addPage(chapterId, { templateId });
  const nextId = story().addPage(chapterId, { templateId });
  useHistory.setState({ history: {} });
  return { projectId, chapterId, pageId, nextId };
}

const props = (params: object) => ({ route: { params }, navigation: mockNav } as any);

const pan = (x: number, y: number, translationX = 0, translationY = 0) => ({ x, y, translationX, translationY });

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

async function touch(run: () => void) {
  await act(async () => run());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('panel layout', () => {
  async function open(pageId: ID, mode: 'panels' | 'art' = 'panels') {
    await render(
      <>
        <PanelLayoutScreen {...props({ pageId, mode })} />
        <ConfirmHost />
      </>,
    );
    await act(async () => fireEvent(screen.getByTestId('page-workspace'), 'layout', BOX));
    return mockTouch.panel as RefObject<PanelGestureHandlers>;
  }

  it('undoes Extend, which the old app kept out of history', async () => {
    const { pageId } = setup('webtoon', 's2');
    await open(pageId);
    const start = page(pageId).height as number;
    await press('Extend strip');
    expect(page(pageId).height).toBe(start + 800);
    await press('Shorten');
    expect(page(pageId).height).toBe(start);
    await press('Undo');
    await press('Undo');
    expect(page(pageId).height).toBe(start);
  });

  it('warns how many panels a template drops, and Undo brings them back', async () => {
    const { pageId } = setup();
    const before = collectPanelIds(page(pageId).layout);
    await open(pageId);
    await press('Templates');
    await act(async () => {
      fireEvent.press(screen.getAllByLabelText(/^1-panel template/)[0]);
    });
    expect(screen.getByText('2 panels are dropped. Undo restores them with their art.')).toBeTruthy();
    await press('Change');
    expect(collectPanelIds(page(pageId).layout)).toHaveLength(1);
    await press('Undo');
    expect(collectPanelIds(page(pageId).layout)).toEqual(before);
  });

  it('commits a divider drag as one step, and catches the handle 24dp away on screen', async () => {
    const { pageId } = setup();
    const before = page(pageId).layout;
    const live = await open(pageId);
    const project = Object.values(story().projects)[0];
    const size = pageSize(project, page(pageId));
    const divider = computeDividers(page(pageId), size, { rtl: true })[0];
    const handle = handlePoints(divider).mid;
    const k = (400 - 32) / size.w;
    const ox = 16;
    const oy = (600 - size.h * k) / 2;
    const x = ox + handle.x * k + 23;
    const y = oy + handle.y * k;
    await touch(() => live.current.panStart(pan(x + 5, y + 40, 5, 40)));
    await touch(() => live.current.panMove(pan(x + 5, y + 40, 5, 40)));
    await touch(() => live.current.panEnd(pan(x + 5, y + 40, 5, 40)));
    await touch(() => live.current.panFinish());
    expect(page(pageId).layout).not.toEqual(before);
    expect(useHistory.getState().history[`page:${pageId}`]?.past).toHaveLength(1);
    await press('Undo');
    expect(page(pageId).layout).toEqual(before);
  });

  it('swipes outside the page along the reading direction', async () => {
    const { pageId, nextId } = setup();
    const live = await open(pageId);
    await touch(() => live.current.panStart(pan(102, 3, 100, 0)));
    await touch(() => live.current.panEnd(pan(102, 3, 100, 0)));
    expect(mockNav.replace).toHaveBeenCalledWith('PanelLayout', { pageId: nextId, mode: 'panels' });
  });

  it('swipes the other way on a left-to-right strip', async () => {
    const { pageId, nextId } = setup('webtoon', 's2');
    const live = await open(pageId);
    await touch(() => live.current.panStart(pan(1, 3, -100, 0)));
    await touch(() => live.current.panEnd(pan(1, 3, -100, 0)));
    expect(mockNav.replace).toHaveBeenCalledWith('PanelLayout', { pageId: nextId, mode: 'panels' });
  });

  it('opens Canvas on a double tap in Art mode', async () => {
    const { pageId } = setup();
    const live = await open(pageId, 'art');
    await touch(() => live.current.doubleTap(200, 300));
    expect(mockNav.navigate).toHaveBeenCalledWith('Canvas', { pageId, panelId: expect.any(String) });
  });

  it('keeps Mark done out of the page history', async () => {
    const { pageId } = setup();
    await open(pageId);
    await press('Mark page done');
    expect(page(pageId).done).toBe(true);
    expect(useHistory.getState().history[`page:${pageId}`]).toBeUndefined();
  });
});

describe('lettering', () => {
  async function open(pageId: ID, bubble: Partial<Bubble> = {}) {
    const made = createBubble('speak', { x: 500, y: 500 }, { w: 200, h: 120, text: 'Hi', ...bubble });
    story().updatePage(pageId, { bubbles: [made] });
    useHistory.setState({ history: {} });
    await render(<LetteringScreen {...props({ pageId })} />);
    await act(async () => fireEvent(screen.getByTestId('lettering-stage'), 'layout', BOX));
    return { live: mockTouch.lettering as RefObject<LetteringGestureHandlers>, made };
  }

  /** Stage coordinates of a page point at the fitted view. */
  function toStage(pageId: ID, p: { x: number; y: number }) {
    const size = pageSize(Object.values(story().projects)[0], page(pageId));
    const bw = Math.min(400 - 24, ((600 - 24) * size.w) / size.h);
    const scale = bw / size.w;
    return { x: (400 - bw) / 2 + p.x * scale, y: (600 - size.h * scale) / 2 + p.y * scale, scale };
  }

  it('removes a tail dropped inside the bubble, and Undo returns it', async () => {
    const { pageId } = setup();
    const { live, made } = await open(pageId);
    const center = toStage(pageId, { x: 500, y: 500 });
    await touch(() => live.current.tap(center.x, center.y));
    const tip = toStage(pageId, made.tail as { x: number; y: number });
    await touch(() => live.current.begin(tip.x, tip.y));
    await touch(() => live.current.start());
    await touch(() => live.current.move(center.x - tip.x, center.y - tip.y));
    await touch(() => live.current.end(true));
    expect(page(pageId).bubbles[0].tail).toBeNull();
    await press('Undo');
    expect(page(pageId).bubbles[0].tail).toEqual(made.tail);
  });

  it('folds repeated size taps into one undo step', async () => {
    const { pageId } = setup();
    const { live, made } = await open(pageId);
    const center = toStage(pageId, { x: 500, y: 500 });
    await touch(() => live.current.tap(center.x, center.y));
    await press('Increase font size');
    await press('Increase font size');
    await press('Increase font size');
    expect(page(pageId).bubbles[0].fontSize).toBe(made.fontSize + 6);
    expect(useHistory.getState().history[`page:${pageId}`]?.past).toHaveLength(1);
    await press('Undo');
    expect(page(pageId).bubbles[0].fontSize).toBe(made.fontSize);
  });

  it('sends edited text back to the script when the editor closes', async () => {
    const { pageId, chapterId } = setup();
    const sceneId = story().addScene(chapterId, { blocks: [{ id: 'b', type: 'dialogue', text: 'Hi' }] });
    useHistory.setState({ history: {} });
    const { live } = await open(pageId, { blockId: 'b' });
    const center = toStage(pageId, { x: 500, y: 500 });
    await touch(() => live.current.tap(center.x, center.y));
    await press('Edit text');
    await act(async () => {
      fireEvent.changeText(screen.getByDisplayValue('Hi'), 'Hello there');
    });
    expect(story().scenes[sceneId].blocks[0].text).toBe('Hi');
    await press('Done');
    expect(story().scenes[sceneId].blocks[0].text).toBe('Hello there');
  });

  it('shares the page history with panel layout', async () => {
    const { pageId } = setup();
    story().updatePage(pageId, { gutterH: 40 });
    const before = useHistory.getState().history[`page:${pageId}`]?.past.length;
    expect(before).toBe(1);
    const made = createBubble('speak', { x: 500, y: 500 });
    await render(<LetteringScreen {...props({ pageId })} />);
    await act(async () => story().updatePage(pageId, { bubbles: [made] }));
    await press('Undo');
    expect(page(pageId).bubbles).toHaveLength(0);
    await press('Undo');
    expect(page(pageId).gutterH).not.toBe(40);
  });
});

describe('storyboard drag', () => {
  const pageIds = ['a', 'b', 'c'];
  const sizes = pageIds.map(() => ({ w: 100, h: 140 }));
  const spec = gridSpecOf(360, 2, false, true);

  async function start() {
    const onMenu = jest.fn();
    const onMove = jest.fn();
    const hook = await renderHook(() => useGridDrag({ pageIds, sizes, spec, onMenu, onMove }));
    return { grid: hook.result.current.grid, onMenu, onMove };
  }

  it('opens the menu when a lifted page is let go without moving', async () => {
    const { grid, onMenu, onMove } = await start();
    await act(async () => {
      grid.lift(1);
      grid.release(false);
    });
    expect(onMenu).toHaveBeenCalledWith('b');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('drops on the slot under the page', async () => {
    const { grid, onMenu, onMove } = await start();
    await act(async () => {
      grid.lift(1);
      grid.drag.moved.value = true;
      // Right to left: page b sits right of page c, so dragging left reaches c's slot.
      grid.drag.tx.value = -100;
      grid.change();
      grid.release(true);
    });
    expect(onMove).toHaveBeenCalledWith(1, 2);
    expect(onMenu).not.toHaveBeenCalled();
  });

  it('leaves the order alone when the page lands where it started', async () => {
    const { grid, onMove } = await start();
    await act(async () => {
      grid.lift(0);
      grid.drag.moved.value = true;
      grid.change();
      grid.release(true);
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('storyboard', () => {
  async function open(chapterId: ID) {
    await render(
      <>
        <StoryboardScreen {...props({ chapterId })} />
        <ConfirmHost />
        <ToastHost />
      </>,
    );
  }

  it('reads each page to a screen reader', async () => {
    const { chapterId, pageId } = setup();
    await act(async () => {
      story().updatePage(pageId, { done: true });
    });
    await open(chapterId);
    await act(async () => fireEvent(screen.getByTestId('storyboard-grid'), 'layout', BOX));
    expect(screen.getByLabelText('Page 1, 3 panels, done')).toBeTruthy();
    expect(screen.getByLabelText('Page 2, 3 panels, paneled')).toBeTruthy();
  });

  it('opens the page menu from the action a screen reader offers, and deletes with an Undo', async () => {
    const { chapterId, pageId } = setup();
    await open(chapterId);
    await act(async () => fireEvent(screen.getByTestId('storyboard-grid'), 'layout', BOX));
    await act(async () => {
      fireEvent(screen.getByLabelText('Page 1, 3 panels, paneled'), 'accessibilityAction', { nativeEvent: { actionName: 'menu' } });
    });
    expect(screen.getByLabelText('Move later')).toBeTruthy();
    await press('Delete');
    await press('Delete');
    expect(page(pageId)).toBeUndefined();
    await press('Undo');
    expect(page(pageId)).toBeDefined();
  });
});
