import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react';
import {
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CheckIcon, CloseIcon, MinusIcon, PlusIcon, SearchIcon } from './icons';

import { Icon, type IconGlyph } from './Icon';
import { IconButton } from './IconButton';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ICON, useColor } from './tokens';

/**
 * Inside a Modal: whether its window is on screen yet. Android drops a keyboard request from a window
 * that has no focus, and a new Modal has none while it mounts, so `autoFocus` has to wait for this.
 */
export const ModalShownContext = createContext<boolean | null>(null);

export type TextFieldProps = TextInputProps & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  icon?: IconGlyph;
  onClear?: () => void;
  className?: string;
  inputClassName?: string;
};

export function TextField({ ref, icon, onClear, className, inputClassName, multiline, ...props }: TextFieldProps) {
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  useImperativeHandle(ref, () => input.current as ComponentRef<typeof TextInput>);
  const modalShown = useContext(ModalShownContext);
  const waitsForModal = !!props.autoFocus && modalShown !== null;
  useEffect(() => {
    if (waitsForModal && modalShown) {
      input.current?.focus();
    }
  }, [waitsForModal, modalShown]);
  return (
    <View
      className={`flex-row items-center gap-2 rounded-sm border bg-surface px-3 ${
        focused ? 'border-accent' : 'border-control-border'
      } ${multiline ? 'py-2' : 'h-12'} ${className ?? ''}`}
    >
      {!!icon && <Icon icon={icon} size={ICON.md} color="text-muted" />}
      <TextInput
        ref={input}
        multiline={multiline}
        placeholderTextColor={muted}
        cursorColor={accent}
        selectionColor={accent}
        {...props}
        autoFocus={waitsForModal ? false : props.autoFocus}
        onFocus={event => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        className={`flex-1 p-0 text-body font-inter text-text ${inputClassName ?? ''}`}
      />
      {!!onClear && !!props.value && <IconButton icon={CloseIcon} size={ICON.md} onPress={onClear} accessibilityLabel="Clear" color="text-muted" />}
    </View>
  );
}

export function SearchField(props: Omit<TextFieldProps, 'icon'>) {
  return <TextField icon={SearchIcon} returnKeyType="search" {...props} />;
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="secondary">
      {children}
    </Text>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  onLongPress,
  icon,
  count,
  className,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  icon?: IconGlyph;
  count?: number;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected: !!selected }}
      hitSlop={6}
      onPress={onPress}
      onLongPress={onLongPress}
      className={`h-9 flex-row items-center gap-1.5 overflow-hidden rounded-sm px-3 ${
        selected ? 'bg-accent' : 'bg-overlay'
      } ${className ?? ''}`}
    >
      {!!icon && <Icon icon={icon} size={ICON.sm} color={selected ? 'on-accent' : 'text-secondary'} weight={selected ? 'fill' : 'regular'} />}
      <Text variant="label" tone={selected ? 'onAccent' : 'secondary'} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined && (
        <Text variant="caption" tone={selected ? 'onAccent' : 'muted'}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={`items-center gap-2 py-1.5 ${className ?? ''}`}
    >
      {children}
    </ScrollView>
  );
}

export function ChipGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={`flex-row flex-wrap gap-2 py-1.5 ${className ?? ''}`}>{children}</View>;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" className="h-12 flex-row gap-1 rounded-md bg-overlay p-1">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center overflow-hidden rounded-sm ${selected ? 'bg-raised' : ''}`}
          >
            <Text variant="label" tone={selected ? 'text' : 'secondary'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  right,
  stretch,
}: {
  tabs: readonly { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
  right?: ReactNode;
  stretch?: boolean;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row items-center">
      {tabs.map(tab => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge}` : tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            className={`h-12 flex-row items-center justify-center gap-1.5 border-b-2 ${
              selected ? 'border-accent' : 'border-transparent'
            } ${stretch ? 'flex-1 px-1' : 'px-3'}`}
          >
            <Text variant="label" tone={selected ? 'accent' : 'secondary'} numberOfLines={1}>
              {tab.label}
            </Text>
            {!!tab.badge && (
              <Text variant="caption" tone="muted">
                {tab.badge}
              </Text>
            )}
          </Pressable>
        );
      })}
      {!!right && <View className="ml-auto">{right}</View>}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      className="min-h-12 flex-row items-center gap-3"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-sm border ${
          checked ? 'border-accent bg-accent' : 'border-control-border'
        }`}
      >
        {checked && <Icon icon={CheckIcon} size={ICON.sm} color="on-accent" />}
      </View>
      {!!label && <Text className="flex-1">{label}</Text>}
    </Pressable>
  );
}

export function Radio({
  selected,
  onPress,
  label,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 py-1"
    >
      <View className={`h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-accent' : 'border-control-border'}`}>
        {selected && <View className="h-3 w-3 rounded-full bg-accent" />}
      </View>
      <View className="flex-1">
        <Text>{label}</Text>
        {!!description && (
          <Text variant="bodySmall" tone="muted">
            {description}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function Switch({
  value,
  onValueChange,
  disabled,
  label,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      className={`h-7 w-12 justify-center rounded-full border px-0.5 ${
        value ? 'items-end border-accent bg-accent' : 'items-start border-control-border bg-transparent'
      }`}
    >
      <View className={`h-5 w-5 rounded-full ${value ? 'bg-on-accent' : 'bg-text-muted'}`} />
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: IconGlyph;
  disabled?: boolean;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-2">
      {!!icon && <Icon icon={icon} color="text-secondary" />}
      <View className="flex-1">
        <Text>{title}</Text>
        {!!subtitle && (
          <Text variant="bodySmall" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} label={title} />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  label = 'Value',
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  label?: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <IconButton icon={MinusIcon} size={ICON.md} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} accessibilityLabel={`Decrease ${label}`} />
      <Text variant="mono" className="min-w-10 text-center">
        {format ? format(value) : value}
      </Text>
      <IconButton icon={PlusIcon} size={ICON.md} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} accessibilityLabel={`Increase ${label}`} />
    </View>
  );
}

const THUMB = 22;

export function Slider({
  value,
  min,
  max,
  step = 0,
  onChange,
  onComplete,
  disabled,
  label = 'Value',
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  onComplete?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const width = useSharedValue(0);
  const ratio = useSharedValue((value - min) / (max - min || 1));
  const dragging = useSharedValue(false);
  useEffect(() => {
    if (!dragging.get()) {
      ratio.set((value - min) / (max - min || 1));
    }
  }, [dragging, max, min, ratio, value]);

  const emit = (next: number, done: boolean) => {
    onChange?.(next);
    if (done) {
      onComplete?.(next);
    }
  };

  const seek = (x: number, done: boolean) => {
    'worklet';
    const raw = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, width.value - THUMB)));
    const exact = min + raw * (max - min);
    const snapped = step > 0 ? Math.round(exact / step) * step : exact;
    const next = Math.min(max, Math.max(min, snapped));
    ratio.value = (next - min) / (max - min || 1);
    scheduleOnRN(emit, next, done);
  };

  // Seeking starts on activation, so a vertical scroll that passes over the slider changes nothing.
  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: event => {
      'worklet';
      dragging.value = true;
      seek(event.x, false);
    },
    onUpdate: event => {
      'worklet';
      seek(event.x, false);
    },
    onDeactivate: event => {
      'worklet';
      dragging.value = false;
      seek(event.x, true);
    },
  });
  const tap = useTapGesture({
    enabled: !disabled,
    onDeactivate: event => {
      'worklet';
      seek(event.x, true);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: ratio.value * Math.max(0, width.value - THUMB) }] }));
  const fill = useAnimatedStyle(() => ({ width: THUMB / 2 + ratio.value * Math.max(0, width.value - THUMB) }));
  const nudge = step > 0 ? step : (max - min) / 20;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        const delta = event.nativeEvent.actionName === 'increment' ? nudge : -nudge;
        emit(Math.min(max, Math.max(min, value + delta)), true);
      }}
      onLayout={(event: LayoutChangeEvent) => width.set(event.nativeEvent.layout.width)}
      className={`h-12 ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
    >
      <GestureDetector gesture={gesture}>
        <View className="h-12 w-full justify-center">
          <View className="h-1 rounded-full bg-overlay" />
          <Animated.View className="absolute h-1 rounded-full bg-accent" style={fill} />
          <Animated.View className="absolute h-[22px] w-[22px] rounded-full bg-accent" style={thumb} />
        </View>
      </GestureDetector>
    </View>
  );
}
