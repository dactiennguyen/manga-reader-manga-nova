import type { LucideIcon } from 'lucide-react-native';

import { ICON, useColor, type ColorToken } from './tokens';

export type { LucideIcon };

export function Icon({
  icon: Glyph,
  size = ICON.md,
  color = 'text',
  strokeWidth = 2,
}: {
  icon: LucideIcon;
  size?: number;
  color?: ColorToken;
  strokeWidth?: number;
}) {
  return <Glyph size={size} color={useColor(color)} strokeWidth={strokeWidth} />;
}
