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

export type OnceReminder = { id: string; at: number; title: string; body: string };

/**
 * Replaces every one-off notification with this list; an empty list removes them. Never asks for
 * permission, so call it after scheduleReminder. Resolves false when they could not be set.
 */
export async function replaceOnceReminders(list: readonly OnceReminder[]): Promise<boolean> {
  if (!NativeReminder) {
    return false;
  }
  try {
    return await NativeReminder.replaceOnce(list.map(({ id, at, title, body }) => ({ id, at, title, body })));
  } catch {
    return false;
  }
}
