import { createContext, useEffect, useRef, useState } from 'react';

import { MOTION } from './tokens';

/**
 * Inside a Modal: whether its window is on screen yet. Android drops a keyboard request from a window
 * that has no focus, and a new Modal has none while it mounts, so `autoFocus` has to wait for this.
 */
export const ModalShownContext = createContext<boolean | null>(null);

/**
 * Tells fields inside a Modal when its window can open the keyboard. See ModalShownContext. `onShow`
 * alone is too early: it fires before the window manager hands the new window focus, and nothing
 * reports that moment to JS. Waiting out the opening motion covers it.
 */
export function useModalShown(open: boolean): [boolean, () => void] {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) {
      setShown(false);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [open]);
  return [shown, () => (timer.current = setTimeout(() => setShown(true), MOTION.base))];
}
