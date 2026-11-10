import { ScrollView, View } from 'react-native';

import { version } from '../../../package.json';
import { msg, t } from '../../core/i18n';
import { APP_NAME } from '../../core/model/constants';
import { useAppNavigation } from '../../state/navigation';
import { AppBar, BrandMark, ListItem, Screen, Section, Text } from '../../ui';

const CREDITS = [
  { name: 'Inter', license: 'SIL Open Font License 1.1', use: msg('Interface typeface') },
  { name: 'Anton', license: 'SIL Open Font License 1.1', use: msg('Display typeface') },
  { name: 'Be Vietnam Pro', license: 'SIL Open Font License 1.1', use: msg('Lettering typeface') },
  { name: 'Patrick Hand', license: 'SIL Open Font License 1.1', use: msg('Handwriting typeface') },
  { name: 'Bangers', license: 'SIL Open Font License 1.1', use: msg('Display typeface') },
  { name: 'Mali', license: 'SIL Open Font License 1.1', use: msg('Handwriting typeface') },
  { name: 'M PLUS Rounded 1c', license: 'SIL Open Font License 1.1', use: msg('Lettering typeface') },
  { name: 'Yusei Magic', license: 'SIL Open Font License 1.1', use: msg('Handwriting typeface') },
  { name: 'Dela Gothic One', license: 'SIL Open Font License 1.1', use: msg('Display typeface') },
  { name: 'Lucide', license: 'ISC License', use: msg('Icons') },
];

export function AboutScreen() {
  const navigation = useAppNavigation();
  return (
    <Screen padded={false}>
      <AppBar title={t('About')} onBack={navigation.goBack} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-8 md:px-6">
        <View className="items-center px-2 pb-2 pt-6">
          <View className="mb-4">
            <BrandMark size={88} />
          </View>
          <Text variant="display" accessibilityRole="header">
            {APP_NAME}
          </Text>
          <Text variant="label" tone="secondary" className="mt-1">
            {t('Version {version}', { version })}
          </Text>
          <Text tone="secondary" className="mt-3 text-center">
            {t('Make a manga chapter right on your phone: write the script, lay out panels, draw, letter and export.')}
          </Text>
        </View>
        <Section title={t('Credits')} footer={t("Fonts and icons are used under their authors' open-source licenses.")}>
          {CREDITS.map(item => (
            <ListItem key={item.name} title={item.name} subtitle={`${t(item.use)} · ${item.license}`} />
          ))}
        </Section>
        <Text variant="caption" tone="muted" className="mt-2 text-center">
          {t('Your stories are saved on this device.')}
        </Text>
      </ScrollView>
    </Screen>
  );
}
