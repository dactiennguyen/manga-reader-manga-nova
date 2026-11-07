import { Vibration } from 'react-native';

let enabled = true;

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

export function haptic(duration = 8): void {
  if (enabled) {
    Vibration.vibrate(duration);
  }
}
