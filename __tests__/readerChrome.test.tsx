import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';

import { useReaderChrome } from '../src/features/preview/useReaderChrome';
import { setKeepAwake, setOrientationLock } from '../src/native/screen';

jest.mock('../src/native/screen', () => ({ setKeepAwake: jest.fn(), setOrientationLock: jest.fn() }));

type Routes = { Reader: undefined; Edit: undefined };

const Stack = createNativeStackNavigator<Routes>();

let chrome: ReturnType<typeof useReaderChrome>;

function Reader() {
  const value = useReaderChrome();
  useEffect(() => {
    chrome = value;
  });
  return null;
}

const Edit = () => null;

const statusBar = jest.spyOn(StatusBar, 'setHidden');
const lock = setOrientationLock as jest.Mock;
const awake = setKeepAwake as jest.Mock;

async function open() {
  const nav = createNavigationContainerRef<Routes>();
  const view = await render(
    <NavigationContainer ref={nav}>
      <Stack.Navigator>
        <Stack.Screen name="Reader" component={Reader} />
        <Stack.Screen name="Edit" component={Edit} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  return { nav, view };
}

const leave = (nav: ReturnType<typeof createNavigationContainerRef<Routes>>) => act(async () => nav.navigate('Edit'));
const back = (nav: ReturnType<typeof createNavigationContainerRef<Routes>>) => act(async () => nav.goBack());

beforeEach(() => {
  statusBar.mockClear();
  lock.mockClear();
  awake.mockClear();
});

describe('reader chrome follows focus, not mount', () => {
  it('hides the status bar only while the screen is focused', async () => {
    const { nav } = await open();
    expect(statusBar).toHaveBeenLastCalledWith(true);

    await leave(nav);
    expect(statusBar).toHaveBeenLastCalledWith(false);

    await back(nav);
    expect(statusBar).toHaveBeenLastCalledWith(true);
  });

  it('touches the rotation lock only after the reader asked for one', async () => {
    const { nav } = await open();
    await leave(nav);
    await back(nav);
    expect(lock).not.toHaveBeenCalled();
  });

  it('releases a rotation lock on blur and puts it back on return', async () => {
    const { nav } = await open();
    await act(async () => chrome.rotateTo('landscape'));
    expect(lock).toHaveBeenLastCalledWith('landscape');

    await leave(nav);
    expect(lock).toHaveBeenLastCalledWith('auto');

    await back(nav);
    expect(lock).toHaveBeenLastCalledWith('landscape');
  });

  it('never passes through auto when the lock changes while focused', async () => {
    await open();
    await act(async () => chrome.rotateTo('landscape'));
    await act(async () => chrome.rotateTo('portrait'));
    expect(lock.mock.calls).toEqual([['landscape'], ['portrait']]);
  });

  it('keeps the screen awake only while focused', async () => {
    const { nav } = await open();
    expect(awake).not.toHaveBeenCalled();

    await act(async () => chrome.setAwake(true));
    expect(awake).toHaveBeenLastCalledWith(true);

    await leave(nav);
    expect(awake).toHaveBeenLastCalledWith(false);

    await back(nav);
    expect(awake).toHaveBeenLastCalledWith(true);
  });

  it('undoes everything when the screen goes away while focused', async () => {
    const { view } = await open();
    await act(async () => chrome.rotateTo('landscape'));
    await act(async () => chrome.setAwake(true));

    await view.unmount();
    expect(statusBar).toHaveBeenLastCalledWith(false);
    expect(lock).toHaveBeenLastCalledWith('auto');
    expect(awake).toHaveBeenLastCalledWith(false);
  });
});
