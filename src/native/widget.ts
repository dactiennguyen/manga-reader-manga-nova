import NativeWidget from '../../specs/NativeWidget';

/** Hands the widget its new data. Does nothing where the native module is missing, such as in tests. */
export function updateWidget(snapshot: string): void {
  try {
    NativeWidget?.update(snapshot);
  } catch {
    // A widget that misses one update is fixed by the next one.
  }
}
