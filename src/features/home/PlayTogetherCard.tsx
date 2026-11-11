import { Image, View } from 'react-native';

import { t } from '../../core/i18n';
import { useAppNavigation } from '../../state/navigation';
import { Card, ICON, Icon, Text } from '../../ui';
import { CaretRightIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';

const ART = 56;

/** The way into Play together: drawing, reading and trading with friends on the same Wi-Fi. */
export function PlayTogetherCard() {
  const navigation = useAppNavigation();
  const title = t('Play together');
  const subtitle = t('Draw, read and swap cards with friends nearby');
  return (
    <Card accessibilityLabel={`${title}. ${subtitle}`} onPress={() => navigation.navigate('Nearby')} className="flex-row items-center gap-3 p-3">
      <Image accessibilityIgnoresInvertColors source={NEARBY_ART.codraw} className="rounded-md bg-paper" style={{ width: ART, height: ART }} />
      <View className="flex-1 gap-0.5">
        <Text variant="label">{title}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
    </Card>
  );
}
