import 'react-native-gesture-handler/jestSetup';
import 'react-native-gesture-handler/jest-setup/disableRootViewCheck';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { NEARBY_RULES_VERSION } from '../src/core/nearby/safety';
import { NearbyRulesGate, afterNearbyRules } from '../src/features/nearby/safety/NearbyRules';
import { AiServerSheet } from '../src/features/profile/AiServerSheet';
import { DEFAULT_SETTINGS, useSettings } from '../src/state/useSettings';

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
  return {
    __esModule: true,
    default: { View, ScrollView, createAnimatedComponent: (component: unknown) => component },
    Easing: { in: () => () => {}, inOut: () => () => {}, out: () => () => {}, cubic: () => {} },
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
jest.mock('@shopify/react-native-skia', () => ({}));
jest.mock('../src/state/services', () => ({ appServices: () => ({ testAiConnection: jest.fn(() => Promise.resolve('ready')) }) }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, addListener: jest.fn(() => () => {}) };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('Play together rules', () => {
  it('show instead of Play together until the person agrees, then run what was waiting', async () => {
    const join = jest.fn();
    afterNearbyRules(join, false);
    await render(
      <NearbyRulesGate>
        <Text>the hub</Text>
      </NearbyRulesGate>,
    );
    expect(screen.queryByText('the hub')).toBeNull();
    expect(screen.getByText('Play together rules')).toBeTruthy();
    expect(screen.getByText('Reports sent to the developer at mangamarker@gmail.com are reviewed within 24 hours.')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('I agree')));
    expect(useSettings.getState().nearbyRulesAccepted).toBe(NEARBY_RULES_VERSION);
    expect(join).toHaveBeenCalledTimes(1);
    expect(screen.getByText('the hub')).toBeTruthy();
  });

  it('go back on "Not now" and drop what was waiting', async () => {
    const join = jest.fn();
    afterNearbyRules(join, false);
    await render(
      <NearbyRulesGate>
        <Text>the hub</Text>
      </NearbyRulesGate>,
    );
    await act(async () => fireEvent.press(screen.getByText('Not now')));
    expect(mockNav.goBack).toHaveBeenCalled();
    expect(useSettings.getState().nearbyRulesAccepted).toBe(0);
    await act(async () => fireEvent.press(screen.getByText('I agree')));
    expect(join).not.toHaveBeenCalled();
  });
});

describe('AI server consent', () => {
  it('needs the switch on to save an address, and keeps consent with that address', async () => {
    const onClose = jest.fn();
    await render(<AiServerSheet visible onClose={onClose} />);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Server address'), 'ai.example.com'));
    expect(screen.getByText('What is sent to ai.example.com')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Save')));
    expect(useSettings.getState().aiBaseUrl).toBe('');

    await act(async () => fireEvent(screen.getByRole('switch'), 'valueChange', true));
    await act(async () => fireEvent.press(screen.getByText('Save')));
    expect(useSettings.getState()).toMatchObject({ aiBaseUrl: 'ai.example.com', aiConsentFor: 'https://ai.example.com/v1' });
    expect(onClose).toHaveBeenCalled();
  });

  it('asks again when the address changes', async () => {
    useSettings.setState({ aiBaseUrl: 'ai.example.com', aiConsentFor: 'https://ai.example.com/v1' });
    await render(<AiServerSheet visible onClose={jest.fn()} />);
    expect(screen.getByRole('switch', { checked: true })).toBeTruthy();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Server address'), 'other.example.com'));
    expect(screen.getByRole('switch', { checked: false })).toBeTruthy();
  });
});
