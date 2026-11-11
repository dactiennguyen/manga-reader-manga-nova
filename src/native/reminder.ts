import { PermissionsAndroid, Platform } from 'react-native';

import NativeReminder from '../../specs/NativeReminder';

async function androidAllowed(ask: boolean): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) {
    return true;
  }
  return ask && (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Sets the daily reminder. With `ask` the system may show its permission question, so pass it only
 * when the person has just turned the reminder on. Resolves false when notifications are not allowed.
 */
export async function scheduleReminder(
  time: { hour: number; minute: number },
  text: { title: string; body: string },
  ask: boolean,
): Promise<boolean> {
  if (!NativeReminder || !(await androidAllowed(ask))) {
    return false;
  }
  try {
    return await NativeReminder.schedule(time.hour, time.minute, text.title, text.body);
  } catch {
    return false;
  }
}

export function cancelReminder(): void {
  NativeReminder?.cancel();
}
