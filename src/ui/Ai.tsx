import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AiIcon, RefreshIcon } from './icons';

import { t } from '../core/i18n';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { ICON, useColor } from './tokens';

export function AiNote({ text, className }: { text: string; className?: string }) {
  return (
    <View className={`flex-row items-center gap-2 rounded-sm bg-ai/15 px-3 py-2 ${className ?? ''}`}>
      <Icon icon={AiIcon} size={ICON.xs} color="ai" weight="fill" />
      <Text variant="caption" tone="ai" className="flex-1">
        {text}
      </Text>
    </View>
  );
}

export function AiPanel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <View className={`gap-2 rounded-md bg-ai/15 p-3 ${className ?? ''}`}>
      <View className="flex-row items-center gap-2">
        <Icon icon={AiIcon} size={ICON.sm} color="ai" weight="fill" />
        <Text variant="label" tone="ai" className="flex-1">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function AiLoading({ label, onCancel }: { label: string; onCancel?: () => void }) {
  const color = useColor('ai');
  return (
    <View accessibilityLiveRegion="polite" className="items-center gap-3 p-6">
      <ActivityIndicator size="large" color={color} />
      <Text variant="bodySmall" tone="secondary" className="text-center">
        {label}
      </Text>
      {!!onCancel && <Button title={t('Cancel')} variant="ghost" onPress={onCancel} />}
    </View>
  );
}

export function AiErrorBox({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  return (
    <View accessibilityRole="alert" className="gap-3 rounded-md bg-danger/15 p-3">
      <Text variant="bodySmall" tone="danger">
        {message}
      </Text>
      <View className="flex-row justify-end gap-2">
        {!!onCancel && <Button title={t('Cancel')} variant="ghost" small onPress={onCancel} />}
        {!!onRetry && <Button title={t('Retry')} variant="secondary" icon={RefreshIcon} small onPress={onRetry} />}
      </View>
    </View>
  );
}

export function AiButton({
  title,
  onPress,
  loading,
  disabled,
  small,
  className,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  className?: string;
}) {
  return <Button title={title} variant="ai" icon={AiIcon} onPress={onPress} loading={loading} disabled={disabled} small={small} className={className} />;
}
