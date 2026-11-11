import { View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { t } from '../../core/i18n';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { ART, ArtBanner, Pressable, Text } from '../../ui';
import { openBlankCanvas, openBlankLayout } from './quickStart';

type Start = { label: string; hint: string; art: ImageSourcePropType; onPress: () => void };

function Tile({ label, hint, art, onPress }: Start) {
  return (
    <Pressable accessibilityLabel={`${label}. ${hint}`} onPress={onPress} className="flex-1 gap-1">
      <ArtBanner source={art} ratio={1} />
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={2}>
        {hint}
      </Text>
    </Pressable>
  );
}

/** The ways into making a comic. Writers see the script first. */
export function StartTiles() {
  const navigation = useAppNavigation();
  const role = useSettings(s => s.role);
  const style = () => useSettings.getState().defaultStyle;

  const draw: Start = {
    label: t('Draw now'),
    hint: t('Open a blank page'),
    art: ART.tileDraw,
    onPress: () => openBlankCanvas(navigation, style()),
  };
  const layout: Start = {
    label: t('Lay out page'),
    hint: t('Split a page into panels'),
    art: ART.tileStoryboard,
    onPress: () => openBlankLayout(navigation, style()),
  };
  const write: Start = {
    label: t('Write script'),
    hint: t('Plan scenes and dialogue'),
    art: ART.tileScript,
    onPress: () => navigation.navigate('NewProject'),
  };

  return (
    <View className="flex-row gap-3">
      {(role === 'write' ? [write, layout, draw] : [draw, layout, write]).map(tile => (
        <Tile key={tile.label} {...tile} />
      ))}
    </View>
  );
}
