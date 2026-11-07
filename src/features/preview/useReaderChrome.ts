import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { StatusBar } from 'react-native';

import { setKeepAwake, setOrientationLock, type OrientationLock } from '../../native/screen';

/**
 * The status bar, the rotation lock and keep-awake belong to the whole window, and a screen under a
 * stack stays mounted. So each one follows focus, not mount, or it leaks into Edit and Export.
 */
export function useReaderChrome() {
  const [awake, setAwake] = useState(false);
  const lock = useRef<OrientationLock | null>(null);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      if (lock.current) {
        setOrientationLock(lock.current);
      }
      return () => {
        StatusBar.setHidden(false);
        if (lock.current) {
          setOrientationLock('auto');
        }
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!awake) {
        return undefined;
      }
      setKeepAwake(true);
      return () => setKeepAwake(false);
    }, [awake]),
  );

  // A ref, so changing the lock does not run the focus effect and pass through 'auto' on the way.
  const rotateTo = useCallback((mode: OrientationLock) => {
    lock.current = mode;
    setOrientationLock(mode);
  }, []);

  return { awake, setAwake, rotateTo };
}
