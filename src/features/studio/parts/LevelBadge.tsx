import { Image, View } from 'react-native';

import { t } from '../../../core/i18n';
import type { Level } from '../../../core/studio/types';
import { Text } from '../../../ui';
import { LEVEL_ART } from '../../../ui/studioArt';

/** The printed picture of a journey level with its title under it. A locked level is shown faded. */
export function LevelBadge({
  level,
  size = 72,
  locked,
  showTitle = true,
}: {
  level: Level;
  size?: number;
  locked?: boolean;
  showTitle?: boolean;
}) {
  return (
    <View className="items-center gap-1" style={{ width: showTitle ? Math.max(size, 72) : size }}>
      <View className={`overflow-hidden rounded-lg bg-paper ${locked ? 'opacity-40' : ''}`} style={{ width: size, height: size }}>
        <Image accessibilityIgnoresInvertColors source={LEVEL_ART[level.id]} style={{ width: size, height: size }} />
      </View>
      {showTitle && (
        <Text variant="caption" tone={locked ? 'muted' : 'text'} numberOfLines={2} className="text-center">
          {t(level.title)}
        </Text>
      )}
    </View>
  );
}
