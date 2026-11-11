import { memo, useState } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { useSettings } from '../../state/useSettings';
import { Text } from '../../ui';
import { TrailerHero } from '../studio/TrailerHero';
import { TrailerSheet } from '../studio/TrailerSheet';

/**
 * The top of Home: the latest story's drawn page drifting under the greeting, as a way into its trailer.
 * Before anything is drawn, TrailerHero shows the printed banner, which carries the greeting itself.
 * `pageId` comes from useHomeData, which stops working it out while Home is out of sight.
 */
export const HomeHero = memo(function HomeHeroView({ projectId, pageId }: { projectId: ID | null; pageId: ID | null }) {
  const penName = useSettings(s => s.penName).trim();
  const drawn = !!projectId && !!pageId;
  const [trailer, setTrailer] = useState(false);

  return (
    <View className="gap-3">
      {drawn && (
        <View>
          <Text variant="display" accessibilityRole="header" numberOfLines={1}>
            {penName ? t('Hi {name}', { name: penName }) : t('Hi there')}
          </Text>
          <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
            {t('What are we drawing today?')}
          </Text>
        </View>
      )}
      <TrailerHero projectId={projectId} pageId={pageId} onPress={() => setTrailer(true)} />
      {!!projectId && <TrailerSheet projectId={projectId} visible={trailer} onClose={() => setTrailer(false)} />}
    </View>
  );
});
