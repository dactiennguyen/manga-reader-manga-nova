import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  setOrientation(mode: string): void;
  setSecure(enabled: boolean): void;
  setKeepAwake(enabled: boolean): void;
  setSystemBarsDarkIcons(dark: boolean): void;
  hideSplash(): void;
}

export default TurboModuleRegistry.get<Spec>('NativeScreen');
