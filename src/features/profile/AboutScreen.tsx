import { ScrollView, View } from 'react-native';

import { version } from '../../../package.json';
import { APP_NAME } from '../../core/model/constants';
import { useAppNavigation } from '../../state/navigation';
import { AppBar, BrandMark, ListItem, Screen, Section, Text } from '../../ui';

const CREDITS = [
  { name: 'Inter', license: 'SIL Open Font License 1.1', use: 'Interface typeface' },
  { name: 'Anton', license: 'SIL Open Font License 1.1', use: 'Display typeface' },
  { name: 'Be Vietnam Pro', license: 'SIL Open Font License 1.1', use: 'Lettering typeface' },
  { name: 'Patrick Hand', license: 'SIL Open Font License 1.1', use: 'Handwriting typeface' },
  { name: 'Lucide', license: 'ISC License', use: 'Icons' },
];

export function AboutScreen() {
  const navigation = useAppNavigation();
  return (
    <Screen padded={false}>
      <AppBar title="About" onBack={navigation.goBack} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-8 md:px-6">
        <View className="items-center px-2 pb-2 pt-6">
          <View className="mb-4">
            <BrandMark size={88} />
          </View>
          <Text variant="display" accessibilityRole="header">
            {APP_NAME}
          </Text>
          <Text variant="label" tone="secondary" className="mt-1">
            Version {version}
          </Text>
          <Text tone="secondary" className="mt-3 text-center">
            Make a manga chapter right on your phone: write the script, lay out panels, draw, letter and export.
          </Text>
        </View>
        <Section title="Credits" footer="Fonts and icons are used under their authors' open-source licenses.">
          {CREDITS.map(item => (
            <ListItem key={item.name} title={item.name} subtitle={`${item.use} · ${item.license}`} />
          ))}
        </Section>
        <Text variant="caption" tone="muted" className="mt-2 text-center">
          Your stories are saved on this device.
        </Text>
      </ScrollView>
    </Screen>
  );
}
