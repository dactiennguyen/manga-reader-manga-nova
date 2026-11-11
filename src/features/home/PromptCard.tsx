import { memo, useMemo } from 'react';
import { Image, View } from 'react-native';

import { t } from '../../core/i18n';
import { dailyPrompt } from '../../core/studio/prompts';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { useStudio } from '../../state/useStudio';
import { Button, Card, ICON, Icon, Text } from '../../ui';
import { CheckIcon, MarkDoneIcon } from '../../ui/icons';
import { STUDIO_ART } from '../../ui/studioArt';
import { openRoute } from '../project/projectActions';
import { openBlankCanvas } from './quickStart';
import type { HomeData } from './useHomeData';

/** A small task for today, made from the person's own characters and places when there are any. */
export const PromptCard = memo(function PromptCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, today, studio, project } = data;
  const prompt = useMemo(() => dailyPrompt(state, today), [state, today]);
  // Any prompt marked done today counts: the text can change when the story is edited later that day.
  const done = !!studio.promptDays[today];

  const start = () => {
    if (prompt.route) {
      openRoute(navigation, prompt.route);
    } else if (project) {
      navigation.navigate('Project', { projectId: project.id });
    } else if (prompt.kind === 'draw') {
      openBlankCanvas(navigation, useSettings.getState().defaultStyle);
    } else {
      navigation.navigate('NewProject');
    }
  };

  return (
    <Card className="flex-1 gap-2 p-3">
      <View className="flex-row items-center gap-2">
        <Image accessibilityIgnoresInvertColors source={STUDIO_ART.prompt} style={{ width: 40, height: 40 }} className="rounded-md bg-paper" />
        <Text variant="label" accessibilityRole="header" className="flex-1" numberOfLines={2}>
          {t("Today's prompt")}
        </Text>
      </View>
      <Text variant="bodySmall" className="flex-1">
        {prompt.text}
      </Text>
      {done ? (
        <View className="min-h-9 flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
          <Icon icon={MarkDoneIcon} size={ICON.md} color="success" weight="fill" />
          <Text variant="label" tone="success">
            {t('Done for today')}
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          <Button title={t('Do it')} variant="secondary" small onPress={start} />
          <Button
            title={t('Done')}
            icon={CheckIcon}
            variant="ghost"
            small
            className="px-2"
            onPress={() => useStudio.getState().markPromptDone(today, prompt.id)}
          />
        </View>
      )}
    </Card>
  );
});
