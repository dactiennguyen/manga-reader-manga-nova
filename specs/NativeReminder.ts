import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Shows a local notification every day at this time, replacing any earlier one. No server is involved.
   * iOS asks for permission here and resolves false when it is refused. Android resolves true: its
   * permission is asked from JavaScript before this call.
   */
  schedule(hour: number, minute: number, title: string, body: string): Promise<boolean>;
  cancel(): void;
}

export default TurboModuleRegistry.get<Spec>('NativeReminder');
