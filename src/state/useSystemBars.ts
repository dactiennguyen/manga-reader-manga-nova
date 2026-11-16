import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { create } from 'zustand';

/** How many focused screens are dark in both themes right now (normally 0 or 1). */
const useDarkScreens = create<{ count: number }>(() => ({ count: 0 }));

/**
 * For a screen that stays dark in the light theme too (the canvas and every screen built on it, lesson
 * practice): while it is focused, AppRoot gives the status bar light text and the system bars light icons,
 * and leaves out the light strip behind the navigation bar. A screen pushed on top takes the focus, so its
 * own theme decides again.
 */
export function useDarkSystemBars(): void {
  const navigation = useNavigation();
  useEffect(() => {
    let on = false;
    const set = (next: boolean) => {
      if (next !== on) {
        on = next;
        useDarkScreens.setState(state => ({ count: Math.max(0, state.count + (next ? 1 : -1)) }));
      }
    };
    set(typeof navigation.isFocused === 'function' ? navigation.isFocused() : true);
    const offFocus = navigation.addListener('focus', () => set(true));
    const offBlur = navigation.addListener('blur', () => set(false));
    return () => {
      offFocus();
      offBlur();
      set(false);
    };
  }, [navigation]);
}

/** True while a dark screen is focused. */
export function useDarkScreenFocused(): boolean {
  return useDarkScreens(state => state.count > 0);
}

/** Whether the status bar text and system bar icons should be light. Dark theme: always. */
export function lightSystemBars(darkTheme: boolean, darkScreen: boolean): boolean {
  return darkTheme || darkScreen;
}

/** The same, outside React. */
export function darkScreenFocused(): boolean {
  return useDarkScreens.getState().count > 0;
}
