import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BUILTIN_BRUSHES } from '../src/core/art/brushes';
import { serializeBrushFile } from '../src/core/art/brushFile';
import { EMPTY_PRESETS, PRESETS_MAX, saveBrush, type ArtPresets } from '../src/core/art/presets';
import { addSet, setContents } from '../src/core/art/presetSets';
import { BUILTIN_TONES } from '../src/core/art/tone';
import { setLocale } from '../src/core/i18n';
import { BrushImportScreen } from '../src/features/brushLibrary/BrushImportScreen';
import { BrushLibraryScreen } from '../src/features/brushLibrary/BrushLibraryScreen';
import { useArtPresets } from '../src/state/useArtPresets';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() };
let mockParams: object | undefined;

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
    isSharedValue: () => false,
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
jest.mock('@shopify/react-native-skia', () => ({}));
jest.mock('react-native-svg', () => new Proxy({ __esModule: true }, { get: () => () => null }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('../src/native/files', () => ({
  MIME: { archive: 'application/octet-stream' },
  RNFS: {},
  shareFile: jest.fn(),
  pickToCache: jest.fn(),
  pickerTypes: {},
}));
// Previews draw with Skia; the screens only need them to be there.
jest.mock('../src/features/canvas/presetThumbs', () => ({
  BrushThumb: () => null,
  ToneThumb: () => null,
  SettingSlider: () => null,
  EditorSection: ({ children }: { children: unknown }) => children,
  percent: (value: number) => `${Math.round(value * 100)}%`,
  oneDecimal: (value: number) => `${value}`,
}));

function mine(): ArtPresets {
  let p = addSet(EMPTY_PRESETS, 'ink', 'Inking');
  p = saveBrush(p, { ...BUILTIN_BRUSHES[0], id: 'a', name: 'Bold', set: 'ink' });
  return p;
}

const FILE = serializeBrushFile({
  name: 'From Mai',
  brushes: [
    { ...BUILTIN_BRUSHES[0], id: 'x', name: 'Bold' },
    { ...BUILTIN_BRUSHES[1], id: 'y', name: 'Wet' },
  ],
  tones: [{ ...BUILTIN_TONES[0], id: 't', name: 'Sky' }],
});

beforeEach(() => {
  setLocale('en');
  jest.clearAllMocks();
  useArtPresets.setState(mine());
});

describe('the import screen', () => {
  it('shows taken names, imports only what is ticked into a new set and never overwrites', async () => {
    mockParams = { text: FILE };
    await render(<BrushImportScreen />);
    expect(screen.getByText('You have one with this name. Added as “Bold (2)”.')).toBeTruthy();
    expect(screen.getByText('3 of 3 chosen')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Sky, Dots · 30%')));
    expect(screen.getByText('2 of 3 chosen')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Import 2 brushes')));

    const state = useArtPresets.getState();
    const added = state.sets.find(set => set.name === 'From Mai');
    expect(added).toBeTruthy();
    expect(setContents(state, added!.id).brushes.map(item => item.name)).toEqual(['Bold (2)', 'Wet']);
    expect(state.tones).toEqual([]);
    expect(state.brushes.find(item => item.id === 'a')?.name).toBe('Bold');
    expect(mockNav.replace).toHaveBeenCalledWith('BrushSet', { setId: added!.id });
  });

  it('blocks an import that would go over the limit and says why', async () => {
    let p = mine();
    for (let i = p.brushes.length; i < PRESETS_MAX - 1; i++) {
      p = saveBrush(p, { ...BUILTIN_BRUSHES[0], id: `f${i}`, name: `F${i}` });
    }
    useArtPresets.setState(p);
    mockParams = { text: FILE };
    await render(<BrushImportScreen />);
    expect(screen.getByText('You have room for 1 more brush. Pick fewer, or delete some first.')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Import 2 brushes · 1 tone')));
    expect(useArtPresets.getState().brushes).toHaveLength(PRESETS_MAX - 1);
    expect(mockNav.replace).not.toHaveBeenCalled();
  });

  it('explains a file it cannot read', async () => {
    mockParams = { text: JSON.stringify({ format: 'manganova.brushes', version: 9, brushes: [] }) };
    await render(<BrushImportScreen />);
    expect(screen.getByText('This brush file was made by a newer Manganova. Update the app to open it.')).toBeTruthy();
  });
});

describe('the library', () => {
  it('lists my sets with counts and the built-in set, and searches by name', async () => {
    mockParams = undefined;
    await render(<BrushLibraryScreen />);
    expect(screen.getByText('Inking')).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
    // The app bar counts everything; the set row counts its own.
    expect(screen.getAllByText('1 brush')).toHaveLength(2);
    expect(screen.getByText('Read only')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Inking, 1 brush')));
    expect(mockNav.navigate).toHaveBeenCalledWith('BrushSet', { setId: 'ink' });

    await act(async () => fireEvent.changeText(screen.getByPlaceholderText('Search brushes and tones'), 'bol'));
    expect(screen.getByText('Bold')).toBeTruthy();
    expect(screen.queryByText('Inking')).toBeNull();
  });
});
