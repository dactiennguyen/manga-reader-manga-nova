import { useEffect, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable as RNPressable, ScrollView, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { CaretDownIcon, CheckIcon } from './icons';

import { Button, type ButtonVariant } from './Button';
import { Icon, type IconGlyph } from './Icon';
import { ModalShownContext, TextField } from './Inputs';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { haptic } from './haptics';
import { DOCK_GAP, MOTION } from './tokens';

/**
 * Tells fields inside a Modal when its window can open the keyboard. See ModalShownContext. `onShow`
 * alone is too early: it fires before the window manager hands the new window focus, and nothing
 * reports that moment to JS. Waiting out the opening motion covers it.
 */
function useModalShown(open: boolean): [boolean, () => void] {
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

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;

export function Sheet({
  visible,
  onClose,
  onClosed,
  title,
  subtitle,
  right,
  children,
  scroll = true,
  maxHeight = '85%',
}: {
  visible: boolean;
  onClose: () => void;
  /** Runs after the closing animation, so the next sheet or focus change can start safely. */
  onClosed?: () => void;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  maxHeight?: `${number}%` | number;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [shown, onShow] = useModalShown(mounted);
  const height = useSharedValue(600);
  const offset = useSharedValue(600);
  const scrim = useSharedValue(0);
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;

  const finish = () => {
    setMounted(false);
    closedRef.current?.();
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      offset.set(reduced ? 0 : withSpring(0, { damping: 28, stiffness: 280 }));
      scrim.set(withTiming(1, { duration: reduced ? 0 : MOTION.base }));
    } else if (mounted) {
      scrim.set(withTiming(0, { duration: reduced ? 0 : MOTION.fast }));
      offset.set(
        withTiming(height.get(), { duration: reduced ? 0 : MOTION.fast, easing: Easing.in(Easing.cubic) }, done => {
          if (done) {
            scheduleOnRN(finish);
          }
        }),
      );
    }
    // Only the visible flag drives the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const drag = usePanGesture({
    onUpdate: event => {
      'worklet';
      offset.value = Math.max(0, event.translationY);
    },
    onDeactivate: event => {
      'worklet';
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        offset.value = withSpring(0, { damping: 28, stiffness: 280 });
      }
    },
  });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: scrim.value }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView className="flex-1">
        <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
          <Animated.View className="absolute inset-0 bg-scrim" style={backdrop}>
            <RNPressable accessibilityLabel="Close" className="flex-1" onPress={onClose} />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            onLayout={event => height.set(event.nativeEvent.layout.height)}
            className="w-full max-w-[560px] self-center rounded-t-xl bg-raised pt-2"
            style={[panel, { maxHeight, paddingBottom: insets.bottom + 12 }]}
          >
            <GestureDetector gesture={drag}>
              <View accessibilityRole="adjustable" accessibilityLabel="Drag down to close" className="h-6 items-center justify-center">
                <View className="h-1 w-10 rounded-full bg-control-border" />
              </View>
            </GestureDetector>
            {(!!title || !!right) && (
              <View className="flex-row items-center gap-2 px-4 pb-2">
                <View className="flex-1">
                  {!!title && (
                    <Text variant="title" accessibilityRole="header">
                      {title}
                    </Text>
                  )}
                  {!!subtitle && (
                    <Text variant="caption" tone="muted">
                      {subtitle}
                    </Text>
                  )}
                </View>
                {right}
              </View>
            )}
            <ModalShownContext.Provider value={shown}>
              {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}
            </ModalShownContext.Provider>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

export type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
};

export function Dialog({
  visible,
  onClose,
  title,
  message,
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  children?: ReactNode;
  actions?: DialogAction[];
}) {
  const [shown, onShow] = useModalShown(visible);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1 items-center justify-center p-6">
        <RNPressable accessibilityLabel="Close" className="absolute inset-0 bg-scrim" onPress={onClose} />
        <View accessibilityViewIsModal className="max-h-[90%] w-full max-w-[560px] gap-3 rounded-xl bg-overlay p-6" style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}>
          {!!title && (
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
          )}
          {!!message && <Text tone="secondary">{message}</Text>}
          <ModalShownContext.Provider value={shown}>{children}</ModalShownContext.Provider>
          {!!actions?.length && (
            <View className="mt-2 flex-row flex-wrap justify-end gap-2">
              {actions.map(action => (
                <Button
                  key={action.label}
                  title={action.label}
                  onPress={action.onPress}
                  variant={action.variant ?? 'secondary'}
                  disabled={action.disabled}
                  loading={action.loading}
                />
              ))}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function PromptDialog({
  visible,
  onClose,
  onSubmit,
  title,
  message,
  initialValue = '',
  placeholder,
  confirmText = 'Save',
  maxLength,
  multiline,
  allowEmpty,
  inputProps,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  maxLength?: number;
  multiline?: boolean;
  allowEmpty?: boolean;
  inputProps?: TextInputProps;
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);
  const blocked = !allowEmpty && !value.trim();
  const submit = () => {
    if (!blocked) {
      onSubmit(value.trim());
    }
  };
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={title}
      message={message}
      actions={[
        { label: 'Cancel', onPress: onClose, variant: 'ghost' },
        { label: confirmText, onPress: submit, variant: 'primary', disabled: blocked },
      ]}
    >
      <TextField
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        maxLength={maxLength}
        multiline={multiline}
        autoFocus
        onSubmitEditing={multiline ? undefined : submit}
        {...inputProps}
      />
    </Dialog>
  );
}

export type MenuItem = {
  label: string;
  icon?: IconGlyph;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  subtitle?: string;
};

export function Menu({
  visible,
  onClose,
  title,
  subtitle,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: (MenuItem | false | null | undefined)[];
}) {
  const chosen = useRef<MenuItem | null>(null);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      onClosed={() => {
        const item = chosen.current;
        chosen.current = null;
        item?.onPress();
      }}
    >
      {items.filter(Boolean).map(item => {
        const entry = item as MenuItem;
        return (
          <Pressable
            key={entry.label}
            accessibilityRole="menuitem"
            accessibilityLabel={entry.label}
            accessibilityState={{ disabled: !!entry.disabled }}
            disabled={entry.disabled}
            onPress={() => {
              chosen.current = entry;
              onClose();
            }}
            className="min-h-14 flex-row items-center gap-3 px-4 py-2"
          >
            {!!entry.icon && <Icon icon={entry.icon} color={entry.destructive ? 'danger' : 'text-secondary'} />}
            <View className="flex-1">
              <Text tone={entry.destructive ? 'danger' : 'text'}>{entry.label}</Text>
              {!!entry.subtitle && (
                <Text variant="bodySmall" tone="muted">
                  {entry.subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);
  const current = options.find(option => option.value === value);
  const open = () =>
    anchor.current?.measureInWindow((x, y, width, height) =>
      setMenu({ top: y + height + 4, right: Math.max(8, screenWidth - (x + width)) }),
    );
  return (
    <View ref={anchor} collapsable={false}>
      <Pressable
        accessibilityLabel={`${accessibilityLabel}: ${current?.label ?? ''}`}
        accessibilityState={{ expanded: !!menu }}
        onPress={open}
        className="h-12 flex-row items-center gap-1 rounded-sm px-2"
      >
        <Text variant="label">{current?.label}</Text>
        <Icon icon={CaretDownIcon} size={16} color="text-secondary" />
      </Pressable>
      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)} statusBarTranslucent>
        <RNPressable accessibilityLabel="Close" className="flex-1" onPress={() => setMenu(null)}>
          <View
            className="absolute min-w-40 overflow-hidden rounded-md bg-overlay py-1"
            style={{ top: menu?.top ?? 0, right: menu?.right ?? 0, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {options.map(option => (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.value === value }}
                onPress={() => {
                  setMenu(null);
                  onChange(option.value);
                }}
                className="h-12 flex-row items-center justify-between gap-3 px-4"
              >
                <Text variant="label">{option.label}</Text>
                {option.value === value && <Icon icon={CheckIcon} size={16} color="accent" />}
              </Pressable>
            ))}
          </View>
        </RNPressable>
      </Modal>
    </View>
  );
}

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
        style={{ minHeight: 48, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
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

type ConfirmOptions = { confirmText?: string; destructive?: boolean; cancelText?: string };

type ConfirmEntry = { title: string; message?: string; options: ConfirmOptions; resolve: (ok: boolean) => void };

let confirmEntry: ConfirmEntry | null = null;
const confirmListeners = new Set<() => void>();

function setConfirm(next: ConfirmEntry | null): void {
  confirmEntry = next;
  confirmListeners.forEach(listener => listener());
}

export function confirm(title: string, message?: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    confirmEntry?.resolve(false);
    setConfirm({ title, message, options, resolve });
  });
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    listener => {
      confirmListeners.add(listener);
      return () => {
        confirmListeners.delete(listener);
      };
    },
    () => confirmEntry,
  );
  const answer = (ok: boolean) => {
    if (ok && current?.options.destructive) {
      haptic(16);
    }
    current?.resolve(ok);
    setConfirm(null);
  };
  return (
    <Dialog
      visible={!!current}
      onClose={() => answer(false)}
      title={current?.title}
      message={current?.message}
      actions={[
        { label: current?.options.cancelText ?? 'Cancel', onPress: () => answer(false), variant: 'ghost' },
        {
          label: current?.options.confirmText ?? 'OK',
          onPress: () => answer(true),
          variant: current?.options.destructive ? 'danger' : 'primary',
        },
      ]}
    />
  );
}

