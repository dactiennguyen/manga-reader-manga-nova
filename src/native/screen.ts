import NativeScreen from '../../specs/NativeScreen';

export type OrientationLock = 'auto' | 'portrait' | 'landscape';

export function setOrientationLock(mode: OrientationLock): void {
  NativeScreen?.setOrientation(mode);
}

export function setSecureScreen(enabled: boolean): void {
  NativeScreen?.setSecure(enabled);
}

export function setKeepAwake(enabled: boolean): void {
  NativeScreen?.setKeepAwake(enabled);
}

export function setSystemBarsDarkIcons(dark: boolean): void {
  NativeScreen?.setSystemBarsDarkIcons(dark);
}

/** The splash stays up until this is called, so the app appears fully drawn. */
export function hideSplash(): void {
  NativeScreen?.hideSplash();
}

export const orientationSupported = !!NativeScreen;
