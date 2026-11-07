import { useContext, useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { CloseIcon, SearchIcon } from './icons';

import { Icon, type IconGlyph } from './Icon';
import { IconButton } from './IconButton';
import { ModalShownContext } from './modalShown';
import { Text } from './Text';
import { ICON, useColor } from './tokens';

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
