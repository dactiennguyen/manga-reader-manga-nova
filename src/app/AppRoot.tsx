import '../../global.css';

import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationState,
  type Theme,
} from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Uniwind, useUniwind } from 'uniwind';

import { t } from '../core/i18n';
import { copyUriToCache, removeFile, stripFileScheme } from '../native/files';
import { hideSplash, setSystemBarsDarkIcons } from '../native/screen';
import type { RootStackParamList } from '../state/navigation';
import { appServices } from '../state/services';
import { useAppLocale, useSettings } from '../state/useSettings';
import { flushStory } from '../state/useStory';
import { Button, ConfirmHost, DOCK_GAP, DOCK_HEIGHT, ErrorBoundary, Text, ToastHost, toast, useColor } from '../ui';
import { boot } from './boot';
import { RootNavigator } from './navigation';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function rootRoute(state: NavigationState | undefined): string | undefined {
  return state?.routes[state.index]?.name;
}

async function openArchive(url: string | null | undefined): Promise<void> {
  if (!url || !/^(content|file):/.test(url)) {
    return;
  }
  try {
    const path = await copyUriToCache(url, 'incoming.manganova');
    const projectId = await appServices().importProject(path);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Project', { projectId });
    }
    toast(t('Story imported'));
  } catch (error) {
    toast(error instanceof Error ? error.message : t("This file can't be read."));
  } finally {
    // iOS copies a file opened from another app into Documents/Inbox and leaves it there.
    if (url.startsWith('file://') && url.includes('/Documents/Inbox/')) {
      removeFile(stripFileScheme(url)).catch(() => undefined);
    }
  }
}

function useBoot() {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    boot().then(
      () => setState('ready'),
      error => {
        console.error(error);
        setState('failed');
        hideSplash();
      },
    );
  }, [attempt]);
  return {
    state,
    retry: () => {
      setState('loading');
      setAttempt(n => n + 1);
    },
  };
}

function useThemeMode() {
  const mode = useSettings(s => s.themeMode);
  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);
}

function Shell() {
  const locale = useAppLocale();
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const [route, setRoute] = useState<string | undefined>();
  const dockShown = route === 'Tabs';
  // The canvas stays dark in both themes, so the system bars have to follow it.
  const darkBars = dark || route === 'Canvas';
  const bg = useColor('bg');
  const surface = useColor('surface');
  const text = useColor('text');
  const accent = useColor('accent');
  const divider = useColor('divider');

  const navigationTheme = useMemo<Theme>(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: accent, background: bg, card: surface, text, border: divider, notification: accent },
    };
  }, [accent, bg, dark, divider, surface, text]);

  useEffect(() => {
    const flush = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        flushStory();
      }
    });
    Linking.getInitialURL().then(openArchive);
    const link = Linking.addEventListener('url', (event: { url: string }) => {
      openArchive(event.url);
    });
    return () => {
      flush.remove();
      link.remove();
      flushStory();
    };
  }, []);

  useEffect(() => {
    setSystemBarsDarkIcons(!darkBars);
  }, [darkBars]);

  return (
    <>
      <StatusBar barStyle={darkBars ? 'light-content' : 'dark-content'} />
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => {
          setRoute(rootRoute(navigationRef.getRootState()));
          hideSplash();
        }}
        onStateChange={state => setRoute(rootRoute(state))}
      >
        {/* The key redraws every screen when the language changes. The navigation state lives in the container. */}
        <RootNavigator key={locale} />
      </NavigationContainer>
      {route === 'Canvas' ? null : <NavBarBacking />}
      <ToastHost bottomOffset={dockShown ? DOCK_HEIGHT + DOCK_GAP : 0} />
      <ConfirmHost />
    </>
  );
}

/** Pages scroll under the system bar, and three-button navigation would vanish against white paper. */
function NavBarBacking() {
  const { bottom } = useSafeAreaInsets();
  return <View pointerEvents="none" className="absolute inset-x-0 bottom-0 bg-bg" style={{ height: bottom }} />;
}

export function AppRoot() {
  const { state, retry } = useBoot();
  useThemeMode();
  return (
    <GestureHandlerRootView className="flex-1 bg-bg">
      <SafeAreaProvider>
        <KeyboardProvider>
          <ErrorBoundary>
            {state === 'ready' ? (
              <Shell />
            ) : state === 'failed' ? (
              <View className="flex-1 items-center justify-center gap-3 p-6">
                <Text variant="title" className="text-center">
                  {t("Couldn't open your stories")}
                </Text>
                <Text tone="secondary" className="text-center">
                  {t('Your data was not changed.')}
                </Text>
                <Button title={t('Try again')} onPress={retry} />
              </View>
            ) : null}
          </ErrorBoundary>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
