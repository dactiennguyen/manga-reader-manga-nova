import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable as RNPressable, ScrollView, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon } from '../../ui/icons';

import { fileUri } from '../../core/util/paths';
import { FieldLabel, IconButton, Text, TextField } from '../../ui';

const INPUT_PADDING = 16;

export function useDraft(value: string, commit: (value: string) => void, delay = 600) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(commit);

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      const next = pending.current;
      pending.current = null;
      commitRef.current(next);
    }
  }, []);

  const onChangeText = useCallback(
    (next: string) => {
      setText(next);
      pending.current = next;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  useEffect(() => flush, [flush]);

  return { text, onChangeText, onBlur: flush, setText };
}

/** Keeps the last real value, so a closing sheet does not lose its title mid-animation. */
export function useSticky<T>(value: T | null | undefined): T | null | undefined {
  const last = useRef(value);
  if (value !== null && value !== undefined) {
    last.current = value;
  }
  return last.current;
}

export function AutoField({
  label,
  value,
  onCommit,
  hint,
  multiline,
  maxLength,
  showCount,
  editable = true,
  minHeight = 96,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur' | 'style'> & {
  label?: string;
  value: string;
  onCommit: (value: string) => void;
  hint?: string;
  showCount?: boolean;
  minHeight?: number;
}) {
  const draft = useDraft(value, onCommit);
  return (
    <View className="mb-4 gap-1">
      {!!label && <FieldLabel>{label}</FieldLabel>}
      <TextField
        accessibilityLabel={label}
        {...props}
        value={draft.text}
        onChangeText={draft.onChangeText}
        onBlur={draft.onBlur}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={editable ? '' : 'opacity-60'}
        style={multiline ? { minHeight: minHeight - INPUT_PADDING } : undefined}
      />
      {(!!hint || (showCount && !!maxLength)) && (
        <View className="flex-row items-start gap-2">
          <Text variant="caption" tone="muted" className="flex-1">
            {hint ?? ''}
          </Text>
          {showCount && !!maxLength && (
            <Text variant="caption" tone={draft.text.length >= maxLength ? 'danger' : 'muted'}>
              {draft.text.length}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function ImageViewer({ path, title, onClose }: { path: string | null | undefined; title?: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!path} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View className="flex-1 bg-bg">
        {!!path && (
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="grow items-center justify-center"
          >
            <RNPressable accessibilityRole="button" accessibilityLabel="Close image" onPress={onClose}>
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: fileUri(path) }}
                style={{ width, height }}
                resizeMode="contain"
              />
            </RNPressable>
          </ScrollView>
        )}
        <View className="absolute inset-x-4 flex-row items-center gap-3" style={{ top: insets.top + 8 }}>
          <Text variant="label" numberOfLines={1} className="flex-1">
            {title ?? ''}
          </Text>
          <IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel="Close" className="bg-overlay" />
        </View>
      </View>
    </Modal>
  );
}
