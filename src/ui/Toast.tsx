import { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { POPOVER_SHADOW } from './shadows';
import { Text } from './Text';
import { DOCK_GAP } from './tokens';

const TOAST_BOX = { minHeight: 48, boxShadow: POPOVER_SHADOW };

export type SnackbarOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

type ToastEntry = SnackbarOptions & { key: number };

let entry: ToastEntry | null = null;
let nextKey = 0;
const toastListeners = new Set<() => void>();

function setEntry(next: ToastEntry | null): void {
  entry = next;
  toastListeners.forEach(listener => listener());
}

function subscribeToast(listener: () => void): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function snackbar(options: SnackbarOptions): void {
  setEntry({ ...options, key: ++nextKey });
}

export function toast(message: string): void {
  snackbar({ message });
}

export function dismissSnackbar(): void {
  setEntry(null);
}

export function ToastHost({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const insets = useSafeAreaInsets();
  const current = useSyncExternalStore(subscribeToast, () => entry);
  useEffect(() => {
    if (!current) {
      return;
    }
    const wait = current.duration ?? (current.actionLabel ? 6000 : 3000);
    const timer = setTimeout(() => {
      if (entry?.key === current.key) {
        setEntry(null);
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [current]);
  if (!current) {
    return null;
  }
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center px-4"
      style={{ bottom: bottomOffset + insets.bottom + DOCK_GAP }}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        className="w-full max-w-[560px] flex-row items-center gap-2 rounded-md bg-overlay py-1 pl-4 pr-2"
        style={TOAST_BOX}
      >
        <Text variant="bodySmall" className="flex-1 py-2">
          {current.message}
        </Text>
        {!!current.actionLabel && (
          <Button
            title={current.actionLabel}
            variant="ghost"
            small
            onPress={() => {
              setEntry(null);
              current.onAction?.();
            }}
          />
        )}
      </View>
    </View>
  );
}
