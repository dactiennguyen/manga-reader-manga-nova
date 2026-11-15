import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Saves what the home screen widget shows (the JSON from core/widget/snapshot.ts) where the widget reads it,
   * and asks the system to draw the widget again. iOS keeps it in the App Group, Android in SharedPreferences.
   */
  update(snapshot: string): void;
}

export default TurboModuleRegistry.get<Spec>('NativeWidget');
