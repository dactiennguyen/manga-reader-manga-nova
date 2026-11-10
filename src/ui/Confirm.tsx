import { useSyncExternalStore } from 'react';

import { t } from '../core/i18n';
import { Dialog } from './Dialog';
import { haptic } from './haptics';

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
        { label: current?.options.cancelText ?? t('Cancel'), onPress: () => answer(false), variant: 'ghost' },
        {
          label: current?.options.confirmText ?? t('OK'),
          onPress: () => answer(true),
          variant: current?.options.destructive ? 'danger' : 'primary',
        },
      ]}
    />
  );
}
