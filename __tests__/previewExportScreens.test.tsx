import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { exportHistoryKey, type ExportRecord } from '../src/core/export/history';
import type { Chapter, Page, Project } from '../src/core/model/types';
import { ExportScreen } from '../src/features/export/ExportScreen';
import { removeProjectExports } from '../src/features/export/exportFiles';
import { runExport } from '../src/features/export/runExport';
import { PreviewScreen } from '../src/features/preview/PreviewScreen';
import { RNFS, removeFile, shareFile } from '../src/native/files';
import { connectSettings } from '../src/state/useSettings';
import { useStory } from '../src/state/useStory';
import { ConfirmHost } from '../src/ui';

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
    Easing: { in: () => noop, cubic: noop },
    cancelAnimation: noop,
    isSharedValue: () => false,
    useAnimatedReaction: noop,
    useAnimatedStyle: (style: () => object) => style(),
    useComposedEventHandler: () => noop,
    useReducedMotion: () => false,
    useSharedValue: shared,
    withDecay: () => 0,
    withSpring: <T,>(value: T) => value,
    withTiming: <T,>(value: T, _config?: object, done?: (finished: boolean) => void) => {
      done?.(true);
      return value;
    },
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => run(...args),
}));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#000000' }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const actual = jest.requireActual('react-native/Libraries/Lists/FlatList');
  const Base = actual.default ?? actual;
  class SpyList extends Base {
    render() {
      mockList.current = this;
      return super.render();
    }
  }
  return { __esModule: true, default: SpyList };
});
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../src/render/PageView', () => ({ PageView: () => null }));
jest.mock('../src/render/drawPage', () => ({}));
jest.mock('../src/render/thumbs', () => ({ useThumb: () => null }));
jest.mock('../src/native/screen', () => ({
  orientationSupported: true,
  setKeepAwake: jest.fn(),
  setOrientationLock: jest.fn(),
}));
jest.mock('../src/features/export/runExport', () => ({
  ExportCancelled: class extends Error {},
  runExport: jest.fn(),
}));
jest.mock('../src/native/files', () => ({
  DIRS: { exports: '/files/exports' },
  RNFS: { exists: jest.fn(async () => true) },
  ensureDirs: jest.fn(async () => {}),
  removeFile: jest.fn(async () => {}),
  saveToDevice: jest.fn(async () => true),
  shareFile: jest.fn(async () => {}),
}));

const mockList: { current: unknown } = { current: null };
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
let mockParams: { projectId: string; chapterId?: string } = { projectId: 'p1' };

const dimensions = useWindowDimensions as jest.Mock;

const page = (id: string, patch: Partial<Page> = {}) =>
  ({ id, chapterId: 'c1', panels: { x: {}, y: {} }, bubbles: [], effects: [], done: true, ...patch } as unknown as Page);

function story(format: Project['format'] = 'manga', count = 5, patch: Partial<Project> = {}) {
  const ids = Array.from({ length: count }, (_, i) => `g${i + 1}`);
  const project = {
    id: 'p1',
    title: 'My Story',
    format,
    pageSize: 'B5',
    acts: [{ id: 'a1', title: '', chapterIds: ['c1'] }],
    ...patch,
  } as unknown as Project;
  const chapter = { id: 'c1', projectId: 'p1', title: '', pageIds: ids, sceneIds: [] } as unknown as Chapter;
  useStory.setState({
    projects: { p1: project },
    chapters: { c1: chapter },
    pages: Object.fromEntries(ids.map(id => [id, page(id)])),
  });
}

const list = () => mockList.current as { props: any; scrollToIndex: (params: object) => void };

const record = (name: string): ExportRecord => ({
  path: `exports/p1/${name}`,
  fileName: name,
  mime: 'application/pdf',
  size: 2048,
  pages: 3,
  format: 'pdf',
  createdAt: 1,
});

function meta(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const repo = {
    get: (key: string) => store.get(key) ?? null,
    set: (key: string, value: string) => void store.set(key, value),
    remove: (key: string) => void store.delete(key),
  };
  connectSettings(repo);
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { projectId: 'p1' };
  dimensions.mockReturnValue({ width: 400, height: 800, scale: 2, fontScale: 1 });
  (RNFS.exists as jest.Mock).mockImplementation(async () => true);
  connectSettings(null);
});

describe('PreviewScreen', () => {
  it('reads manga as an inverted horizontal pager with fixed item layout', async () => {
    story('manga', 5);
    await render(<PreviewScreen />);
    const { props } = list();
    expect(props).toMatchObject({ horizontal: true, inverted: true, pagingEnabled: true });
    expect(props.data).toHaveLength(6);
    expect(props.getItemLayout(null, 2)).toEqual({ length: 400, offset: 800, index: 2 });
  });

  it('reads a webtoon as a vertical list', async () => {
    story('webtoon', 3);
    await render(<PreviewScreen />);
    const { props } = list();
    expect(props.horizontal).toBe(false);
    expect(props.inverted).toBe(false);
    expect(props.pagingEnabled).toBe(false);
    expect(props.scrollEnabled).toBe(true);
  });

  it('pairs pages into spreads in landscape', async () => {
    story('manga', 5);
    dimensions.mockReturnValue({ width: 800, height: 400, scale: 2, fontScale: 1 });
    await render(<PreviewScreen />);
    expect(list().props.data.map((item: { pageIds?: string[] }) => item.pageIds)).toEqual([
      ['g1'],
      ['g2', 'g3'],
      ['g4', 'g5'],
      undefined,
    ]);
  });

  it('keeps the page being read when the device rotates', async () => {
    story('manga', 7);
    await render(<PreviewScreen />);
    await act(async () => {
      list().props.onViewableItemsChanged({ viewableItems: [{ index: 3 }], changed: [] });
    });

    dimensions.mockReturnValue({ width: 800, height: 400, scale: 2, fontScale: 1 });
    await screen.rerender(<PreviewScreen />);

    const { props } = list();
    // Page 4 sits in the spread [g4, g5], the third item in landscape.
    expect(props.data[props.initialScrollIndex].pageIds).toEqual(['g4', 'g5']);
  });

  it('labels the page for a screen reader and turns pages through its actions', async () => {
    story('manga', 3);
    await render(<PreviewScreen />);
    const scroll = jest.spyOn(list(), 'scrollToIndex').mockImplementation(() => {});
    const pageView = screen.getByLabelText('Page 1, 2 panels, done');

    await act(async () => {
      fireEvent(pageView, 'accessibilityAction', { nativeEvent: { actionName: 'nextPage' } });
    });
    expect(scroll).toHaveBeenLastCalledWith({ index: 1, animated: true });
  });

  it('shows the controls and hides the page counter on a middle tap', async () => {
    story('manga', 3);
    await render(<PreviewScreen />);
    expect(screen.queryByLabelText('Close preview')).toBeNull();
    expect(screen.getByText('1 / 3')).toBeTruthy();

    await act(async () => {
      fireEvent(screen.getByLabelText('Page 1, 2 panels, done'), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
    });
    expect(screen.getByLabelText('Close preview')).toBeTruthy();
    // The bottom bar carries the same label, so there is exactly one left once the counter has gone.
    expect(screen.getAllByText('1 / 3')).toHaveLength(1);
    expect(screen.getByLabelText('Flag this page')).toBeTruthy();
    expect(screen.getByLabelText('Edit this page')).toBeTruthy();
  });

  it('offers the storyboard when the chapter has no pages', async () => {
    story('manga', 0);
    await render(<PreviewScreen />);
    fireEvent.press(screen.getByLabelText('Go to storyboard'));
    expect(mockNav.replace).toHaveBeenCalledWith('Storyboard', { chapterId: 'c1' });
  });
});

describe('ExportScreen', () => {
  it('starts on PDF for manga and the long image for webtoon', async () => {
    story('manga', 2);
    const first = await render(<ExportScreen />);
    expect(screen.getByLabelText('PDF. For printing or sending to beta readers.').props.accessibilityState.selected).toBe(true);
    await first.unmount();

    story('webtoon', 2);
    await render(<ExportScreen />);
    expect(screen.getByText('Auto-cut every 4000 px')).toBeTruthy();
  });

  it('asks before exporting unfinished pages', async () => {
    story('manga', 2);
    useStory.setState(state => ({ pages: { ...state.pages, g2: { ...state.pages.g2, done: false } } }));
    await render(
      <>
        <ExportScreen />
        <ConfirmHost />
      </>,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Export file'));
    });
    expect(screen.getByText('1 page is not done and will still be exported.')).toBeTruthy();
    expect(runExport).not.toHaveBeenCalled();
  });

  it('shows the result, records it and shares it', async () => {
    story('manga', 2);
    const store = meta();
    (runExport as jest.Mock).mockResolvedValue(record('out.pdf'));
    await render(<ExportScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Export file'));
    });

    expect(screen.getByText('Export complete')).toBeTruthy();
    expect(JSON.parse(store.get(exportHistoryKey('p1')) as string)).toEqual([record('out.pdf')]);

    fireEvent.press(screen.getByLabelText('Share'));
    expect(shareFile).toHaveBeenCalledWith('exports/p1/out.pdf', 'application/pdf', 'My Story');
  });

  it('deletes a history entry and its file after confirming', async () => {
    story('manga', 2);
    const store = meta({ [exportHistoryKey('p1')]: JSON.stringify([record('a.pdf'), record('b.pdf')]) });
    await render(
      <>
        <ExportScreen />
        <ConfirmHost />
      </>,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Delete a.pdf'));
    });
    expect(removeFile).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Delete'));
    });
    expect(removeFile).toHaveBeenCalledWith('exports/p1/a.pdf');
    expect(screen.queryByText('a.pdf')).toBeNull();
    expect(screen.getByText('b.pdf')).toBeTruthy();
    expect(JSON.parse(store.get(exportHistoryKey('p1')) as string)).toEqual([record('b.pdf')]);
  });

  it('drops the result card when the file it points at is deleted', async () => {
    story('manga', 2);
    meta();
    (runExport as jest.Mock).mockResolvedValue(record('out.pdf'));
    await render(
      <>
        <ExportScreen />
        <ConfirmHost />
      </>,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Export file'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Delete out.pdf'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Delete'));
    });
    expect(screen.queryByText('Export complete')).toBeNull();
  });

  it('marks a file that left the device and still lets the row go', async () => {
    story('manga', 2);
    (RNFS.exists as jest.Mock).mockImplementation(async () => false);
    meta({ [exportHistoryKey('p1')]: JSON.stringify([record('a.pdf')]) });
    await render(<ExportScreen />);
    await act(async () => {});
    expect(screen.getByText('File deleted')).toBeTruthy();
    expect(screen.getByLabelText('Delete a.pdf')).toBeTruthy();
  });

  it('explains an empty story', async () => {
    story('manga', 0);
    await render(<ExportScreen />);
    fireEvent.press(screen.getByLabelText('Go to story'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Project', { projectId: 'p1' });
  });
});

describe('removeProjectExports', () => {
  it('takes the story folder and its history together', async () => {
    const store = meta({ [exportHistoryKey('p1')]: '[]', other: 'kept' });
    await removeProjectExports('p1');
    expect(removeFile).toHaveBeenCalledWith('/files/exports/p1');
    expect(store.has(exportHistoryKey('p1'))).toBe(false);
    expect(store.get('other')).toBe('kept');
  });
});
