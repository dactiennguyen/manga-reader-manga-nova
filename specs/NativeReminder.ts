import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** A notification shown once, at `at` (milliseconds since 1970). `id` names it among the others. */
export type OnceReminder = {
  id: string;
  at: number;
  title: string;
  body: string;
};

export interface Spec extends TurboModule {
  /**
   * Shows a local notification every day at this time, replacing any earlier one. No server is involved.
   * iOS asks for permission here and resolves false when it is refused. Android resolves true: its
   * permission is asked from JavaScript before this call.
   */
  schedule(hour: number, minute: number, title: string, body: string): Promise<boolean>;
  cancel(): void;
  /**
   * Replaces every one-off notification with this list; an empty list removes them all. The daily one
   * is left alone, and so is `cancel` with the one-offs. Times already past are skipped. Never asks for
   * permission: iOS resolves false when it was not given, Android resolves true.
   */
  replaceOnce(reminders: ReadonlyArray<OnceReminder>): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('NativeReminder');
