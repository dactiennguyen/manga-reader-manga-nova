import type { Icon as IconGlyph, IconWeight } from 'phosphor-react-native';

import { ICON, useColor, type ColorToken } from './tokens';

export type { IconGlyph, IconWeight };

/** `regular` by default. A selected control uses `fill`, so its state never rests on colour alone. */
export function Icon({
  icon: Glyph,
  size = ICON.md,
  color = 'text',
  weight = 'regular',
}: {
  icon: IconGlyph;
  size?: number;
  color?: ColorToken;
  weight?: IconWeight;
}) {
  return <Glyph size={size} color={useColor(color)} weight={weight} />;
}
