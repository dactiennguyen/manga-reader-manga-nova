import NativeScreen from '../../specs/NativeScreen';

export type OrientationLock = 'auto' | 'portrait' | 'landscape';

/** Screenshot blocking in release builds, as the old app did. Set to false to allow screenshots. */
export const SECURE_SCREEN = true;

export function setOrientationLock(mode: OrientationLock): void {
  NativeScreen?.setOrientation(mode);
}

export function setSecureScreen(enabled: boolean): void {
  NativeScreen?.setSecure(enabled);
}

export function setKeepAwake(enabled: boolean): void {
  NativeScreen?.setKeepAwake(enabled);
}

export const orientationSupported = !!NativeScreen;
