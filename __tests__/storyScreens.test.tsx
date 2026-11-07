import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';
import '@shopify/flash-list/jestSetup';

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { CharacterScreen } from '../src/features/characters/CharacterScreen';
import { OutlineScreen } from '../src/features/outline/OutlineScreen';
import { ScriptScreen } from '../src/features/script/ScriptScreen';
import { useScriptController, type ScriptHandlers } from '../src/features/script/useScriptController';
import { WorldEntryScreen } from '../src/features/world/WorldEntryScreen';
import { WorldScreen } from '../src/features/world/WorldScreen';
import { chapterIdsOf } from '../src/core/model/selectors';
import type { Block, ID } from '../src/core/model/types';
import { useHistory, useStory } from '../src/state/useStory';

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
    modify(change: (current: T) => T) {
      this.value = change(this.value);
    },
  });
  const noop = () => {};
  return {
    __esModule: true,
    default: { View, ScrollView, createAnimatedComponent: (component: unknown) => component },
    Easing: { in: () => noop, cubic: noop },
    isSharedValue: () => false,
    measure: () => null,
    scrollTo: noop,
    useAnimatedReaction: noop,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => noop,
    useAnimatedStyle: (style: () => object) => style(),
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
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#000000' }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('../src/native/files', () => ({ MIME: { text: 'text/plain' }, RNFS: {}, pickImage: jest.fn(), shareFile: jest.fn() }));

const story = () => useStory.getState();

const NAV = { navigate: jest.fn(), goBack: jest.fn(), push: jest.fn() };

const props = (params: object) => ({ route: { params }, navigation: NAV } as any);

function setup(blocks: Block[]) {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
  useHistory.setState({ history: {} });
  const projectId = story().createProject({
    title: 'Story',
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
  });
  const chapterId = chapterIdsOf(story().projects[projectId])[0];
  const sceneId = story().addScene(chapterId, { blocks });
  useHistory.setState({ history: {} });
  return { projectId, chapterId, sceneId };
}

const HANDLERS: ScriptHandlers = {
  pickCharacter: jest.fn(),
  shorten: jest.fn(),
  openSceneMenu: jest.fn(),
  openPanel: jest.fn(),
};

const steps = (chapterId: ID) => useHistory.getState().history[`script:${chapterId}`]?.past.length ?? 0;

describe('script controller', () => {
  const start = async (blocks: Block[]) => {
    const ids = setup(blocks);
    const { result } = await renderHook(() => useScriptController(ids.chapterId, undefined, HANDLERS));
    return { ...ids, result };
  };

  const texts = (sceneId: ID) => story().scenes[sceneId].blocks.map(block => block.text);

  it('keeps consecutive typing in one block as one undo step', async () => {
    const { chapterId, sceneId, result } = await start([{ id: 'a', type: 'action', text: '' }]);
    for (const text of ['h', 'he', 'hel']) {
      await act(async () => result.current.api.text('a', text));
    }
    expect(steps(chapterId)).toBe(1);
    await act(async () => result.current.undo());
    expect(texts(sceneId)).toEqual(['']);
    await act(async () => result.current.redo());
    expect(texts(sceneId)).toEqual(['hel']);
  });

  it('starts a new step when typing moves to another block', async () => {
    const { chapterId, result } = await start([
      { id: 'a', type: 'action', text: '' },
      { id: 'b', type: 'action', text: '' },
    ]);
    await act(async () => result.current.api.text('a', 'x'));
    await act(async () => result.current.api.text('b', 'y'));
    await act(async () => result.current.api.text('a', 'xx'));
    expect(steps(chapterId)).toBe(3);
  });

  it('Enter after Setting creates Action as its own step', async () => {
    const { chapterId, sceneId, result } = await start([{ id: 'a', type: 'setting', text: 'Rooftop' }]);
    await act(async () => result.current.api.enter('a', 'Roof', 'top'));
    expect(story().scenes[sceneId].blocks.map(block => [block.type, block.text])).toEqual([
      ['setting', 'Roof'],
      ['action', 'top'],
    ]);
    expect(steps(chapterId)).toBe(1);
    await act(async () => result.current.undo());
    expect(texts(sceneId)).toEqual(['Rooftop']);
  });

  it('moves a block to another scene in one undo step', async () => {
    const { chapterId, sceneId, result } = await start([
      { id: 'a', type: 'action', text: 'one' },
      { id: 'b', type: 'action', text: 'two' },
    ]);
    const other = story().addScene(chapterId, { blocks: [{ id: 'c', type: 'action', text: 'three' }] });
    useHistory.setState({ history: {} });
    await act(async () => result.current.moveToScene('a', other));
    expect(texts(other)).toEqual(['three', 'one']);
    expect(steps(chapterId)).toBe(1);
    await act(async () => result.current.undo());
    expect(texts(sceneId)).toEqual(['one', 'two']);
  });

  it('leaves collapsing a scene out of undo', async () => {
    const { chapterId, sceneId, result } = await start([{ id: 'a', type: 'action', text: 'one' }]);
    await act(async () => result.current.sceneApi.toggle(sceneId));
    expect(story().scenes[sceneId].collapsed).toBe(true);
    expect(steps(chapterId)).toBe(0);
  });

  it('inserts AI drafts as one undo step, and only when asked', async () => {
    const { chapterId, sceneId, result } = await start([{ id: 'a', type: 'action', text: 'one' }]);
    expect(steps(chapterId)).toBe(0);
    await act(async () =>
      result.current.insertAiDrafts('a', [
        { type: 'action', text: 'two' },
        { type: 'sfx', text: 'BOOM' },
      ]),
    );
    expect(texts(sceneId)).toEqual(['one', 'two', 'BOOM']);
    expect(steps(chapterId)).toBe(1);
    await act(async () => result.current.undo());
    expect(texts(sceneId)).toEqual(['one']);
  });
});

describe('screens mount', () => {
  const block: Block = { id: 'a', type: 'dialogue', text: 'x'.repeat(90) };

  it('Script shows the long line warning and the editor', async () => {
    const { chapterId } = setup([block]);
    await render(<ScriptScreen {...props({ chapterId })} />);
    expect(await screen.findByText('Too long to fit a bubble')).toBeTruthy();
    expect(screen.getByLabelText('Shorten with AI')).toBeTruthy();
  });

  it('Script shows the toolbar for the focused block and changes its type', async () => {
    const { chapterId, sceneId } = setup([{ id: 'a', type: 'action', text: 'One' }]);
    await render(<ScriptScreen {...props({ chapterId })} />);
    const input = await screen.findByDisplayValue('One');
    await fireEvent(input, 'focus');
    await fireEvent.press(screen.getByLabelText('Dialogue'));
    expect(story().scenes[sceneId].blocks[0]).toMatchObject({ type: 'dialogue', kind: 'speak' });
    expect(steps(chapterId)).toBe(1);
  });

  it('Script replaces all through the menu, and Undo brings the text back', async () => {
    const { chapterId, sceneId } = setup([
      { id: 'a', type: 'action', text: 'cat and cat' },
      { id: 'b', type: 'action', text: 'a cat' },
    ]);
    await render(<ScriptScreen {...props({ chapterId })} />);
    await screen.findByDisplayValue('a cat');
    await fireEvent.press(screen.getByLabelText('More'));
    await fireEvent.press(await screen.findByLabelText('Find and replace'));
    await fireEvent.changeText(await screen.findByLabelText('Find in script'), 'cat');
    await fireEvent.changeText(screen.getByLabelText('Replace with'), 'dog');
    await fireEvent.press(screen.getByLabelText('All'));
    expect(story().scenes[sceneId].blocks.map(item => item.text)).toEqual(['dog and dog', 'a dog']);
    expect(steps(chapterId)).toBe(1);
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(story().scenes[sceneId].blocks.map(item => item.text)).toEqual(['cat and cat', 'a cat']);
  });

  it('Script adds a first scene to an empty chapter without an undo step', async () => {
    const { chapterId, sceneId } = setup([]);
    await act(async () => story().removeScene(sceneId));
    useHistory.setState({ history: {} });
    await render(<ScriptScreen {...props({ chapterId })} />);
    expect(story().chapters[chapterId].sceneIds).toHaveLength(1);
    expect(steps(chapterId)).toBe(0);
  });

  it('Outline, Character and World render their content', async () => {
    const { projectId } = setup([block]);
    const characterId = story().addCharacter(projectId, { name: 'Kai' });
    const entryId = story().addWorldEntry(projectId, 'event', { title: 'The Fall' });
    await render(<OutlineScreen {...props({ projectId })} />);
    expect(screen.getByText('Outline')).toBeTruthy();
    await render(<CharacterScreen {...props({ characterId })} />);
    expect(screen.getByDisplayValue('Kai')).toBeTruthy();
    await render(<WorldScreen {...props({ projectId })} />);
    expect(screen.getByText('The Fall')).toBeTruthy();
    await render(<WorldEntryScreen {...props({ entryId })} />);
    expect(screen.getByDisplayValue('The Fall')).toBeTruthy();
  });

  it('a missing record shows a message, not a crash', async () => {
    setup([]);
    await render(<ScriptScreen {...props({ chapterId: 'gone' })} />);
    expect(screen.getByText('Chapter not found')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(NAV.goBack).toHaveBeenCalled();
  });
});
