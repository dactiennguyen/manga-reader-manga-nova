import { useCallback, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Settings, Sparkles } from 'lucide-react-native';

import { AiErrorBox, AiLoading, Button, Icon, Text } from '../../ui';

/**
 * For sheets that mount when needed. The parent's onClose runs after the closing animation,
 * and closeThen runs a follow-up, such as navigating, once the sheet is gone.
 */
export function useSheetClose(onClose: () => void) {
  const [visible, setVisible] = useState(true);
  const next = useRef<(() => void) | null>(null);
  const close = useCallback(() => setVisible(false), []);
  const closeThen = useCallback((then: () => void) => {
    next.current = then;
    setVisible(false);
  }, []);
  const onClosed = () => {
    const then = next.current;
    next.current = null;
    onClose();
    then?.();
  };
  return { visible, close, closeThen, onClosed };
}

export function AiMark({ label = 'AI suggestion' }: { label?: string }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-sm bg-ai/15 px-2 py-1">
      <Icon icon={Sparkles} size={14} color="ai" />
      <Text variant="caption" tone="ai">
        {label}
      </Text>
    </View>
  );
}

export function AiSetupNotice({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <View className="items-center gap-3 p-6">
      <Icon icon={Sparkles} size={32} color="ai" />
      <Text variant="heading" className="text-center">
        AI is not set up yet
      </Text>
      <Text tone="secondary" className="text-center">
        To get AI suggestions, set the AI server address in Profile first.
      </Text>
      <Button title="Open Profile" icon={Settings} variant="ai" onPress={onOpenProfile} className="mt-2 self-stretch" />
    </View>
  );
}

export function AiBusy({ label, onCancel }: { label: string; onCancel: () => void }) {
  return <AiLoading label={label} onCancel={onCancel} />;
}

export function AiFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="p-4">
      <AiErrorBox message={message} onRetry={onRetry} />
    </View>
  );
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return <View className="gap-2 px-4 pt-3">{children}</View>;
}
