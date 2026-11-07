import { useMemo } from 'react';
import { View } from 'react-native';
import { BrushIcon, CloseIcon, IdeaIcon } from '../../ui/icons';

import { activeProjects, projectProgress } from '../../core/model/selectors';
import { tipOfDay } from '../../core/story/ideas';
import { resumeTarget } from '../../core/story/resume';
import { dayKey } from '../../core/util/time';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { ART, ArtBanner, Button, Card, ICON, Icon, IconButton, Screen, SectionHeader, Text, useDockInset } from '../../ui';
import { openBlankCanvas } from './blankCanvas';
import { ContinueCard } from './ContinueCard';
import { IdeaCard } from './IdeaCard';
import { RecentStories } from './RecentStories';

export function HomeScreen() {
  const navigation = useAppNavigation();
  const dockInset = useDockInset();
  const penName = useSettings(s => s.penName).trim();
  const role = useSettings(s => s.role);
  const tipDismissedDay = useSettings(s => s.tipDismissedDay);
  const state = useStoryData();

  const today = dayKey();
  const projects = useMemo(() => activeProjects(state), [state]);
  const current = projects[0];
  const empty = projects.length === 0;

  return (
    <Screen scroll keyboard bottomInset={dockInset} contentClassName="pt-4">
      <ArtBanner source={ART.homeHero} ratio={3 / 2}>
        <View className="absolute left-4 top-3 w-1/2">
          <Text variant="display" tone="onPaper" accessibilityRole="header" numberOfLines={1}>
            {penName ? `Hi ${penName}` : 'Hi there'}
          </Text>
          <Text variant="bodySmall" tone="onPaper" numberOfLines={2}>
            {empty ? 'Start a new story today.' : 'What are we drawing today?'}
          </Text>
        </View>
      </ArtBanner>

      {!!current && (
        <View className="gap-2">
          <SectionHeader>Continue</SectionHeader>
          <ContinueCard
            project={current}
            resume={resumeTarget(state, current)}
            progress={projectProgress(state, current.id)}
          />
        </View>
      )}

      <View className="gap-3">
        <SectionHeader>Start from one line</SectionHeader>
        <IdeaCard empty={empty} />
        {empty && <Button title="Blank story" variant="secondary" onPress={() => navigation.navigate('NewProject')} />}
        {role === 'draw' && (
          <Button
            title="Open blank canvas"
            variant="secondary"
            icon={BrushIcon}
            onPress={() => openBlankCanvas(navigation, useSettings.getState().defaultStyle)}
          />
        )}
      </View>

      {!empty && <RecentStories projects={projects.slice(0, 6)} />}

      {tipDismissedDay !== today && (
        <View className="gap-2">
          <SectionHeader
            right={
              <IconButton
                icon={CloseIcon}
                size={ICON.md}
                accessibilityLabel="Hide today's tip"
                onPress={() => useSettings.getState().set({ tipDismissedDay: today })}
              />
            }
          >
            Tip of the day
          </SectionHeader>
          <Card className="flex-row items-start gap-2 p-3">
            <Icon icon={IdeaIcon} size={ICON.md} color="accent" />
            <Text variant="bodySmall" className="flex-1">
              {tipOfDay(today)}
            </Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}
