import { View } from 'react-native';

import { t } from '../../core/i18n';
import { tipOfDay } from '../../core/story/ideas';
import { useSettings } from '../../state/useSettings';
import { Card, ICON, Icon, IconButton, SectionHeader, Text } from '../../ui';
import { CloseIcon, IdeaIcon } from '../../ui/icons';

/** One drawing or writing tip a day, which the person can put away until tomorrow. */
export function TipCard({ today }: { today: string }) {
  const dismissedDay = useSettings(s => s.tipDismissedDay);
  if (dismissedDay === today) {
    return null;
  }
  return (
    <View className="gap-2">
      <SectionHeader
        right={
          <IconButton
            icon={CloseIcon}
            size={ICON.md}
            accessibilityLabel={t("Hide today's tip")}
            onPress={() => useSettings.getState().set({ tipDismissedDay: today })}
          />
        }
      >
        {t('Tip of the day')}
      </SectionHeader>
      <Card className="flex-row items-start gap-2 p-3">
        <Icon icon={IdeaIcon} size={ICON.md} color="accent" />
        <Text variant="bodySmall" className="flex-1">
          {tipOfDay(today)}
        </Text>
      </Card>
    </View>
  );
}
