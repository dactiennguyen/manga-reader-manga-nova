import { useCSSVariable } from 'uniwind';

export type ColorToken =
  | 'bg'
  | 'surface'
  | 'raised'
  | 'overlay'
  | 'text'
  | 'text-secondary'
  | 'text-muted'
  | 'accent'
  | 'on-accent'
  | 'ai'
  | 'on-ai'
  | 'danger'
  | 'success'
  | 'warning'
  | 'divider'
  | 'control-border'
  /** Printed cream paper and the ink on it: the same in both themes. */
  | 'paper'
  | 'on-paper';

/** For props that need a real colour value, such as icons and Skia. */
export function useColor(token: ColorToken): string {
  return String(useCSSVariable(`--color-${token}`) ?? '#000000');
}

export const ICON = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32, xxl: 40 } as const;

export const MOTION = { instant: 100, fast: 160, base: 220, slow: 300 } as const;

export const DOCK_HEIGHT = 64;

export const DOCK_GAP = 12;

export const DOCK_RAIL_WIDTH = 80;
