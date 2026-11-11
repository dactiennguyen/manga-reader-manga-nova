import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable as RNPressable, View, type TextInputProps } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Button, type ButtonVariant } from './Button';
import { t } from '../core/i18n';
import { ModalShownContext, useModalShown } from './modalShown';
import { DIALOG_SHADOW } from './shadows';
import { Text } from './Text';
import { TextField } from './TextField';

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
        <RNPressable accessibilityLabel={t('Close')} className="absolute inset-0 bg-scrim" onPress={onClose} />
        <View accessibilityViewIsModal className="max-h-[90%] w-full max-w-[560px] gap-3 rounded-xl bg-overlay p-6" style={{ boxShadow: DIALOG_SHADOW }}>
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
  confirmText = t('Save'),
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
        { label: t('Cancel'), onPress: onClose, variant: 'ghost' },
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
