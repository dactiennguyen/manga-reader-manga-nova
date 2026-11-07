import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CaretDownIcon, CaretRightIcon, CloseIcon, IdeaIcon } from '../../ui/icons';

import { activeProjects, projectProgress } from '../../core/model/selectors';
import { tipOfDay } from '../../core/story/ideas';
import { resumeTarget } from '../../core/story/resume';
import { dayKey } from '../../core/util/time';
import { useStoryData } from '../../state/hooks';
import { useSettings } from '../../state/useSettings';
import { ART, ArtBanner, Card, ICON, Icon, IconButton, ListItem, Screen, SectionHeader, Text, useDockInset } from '../../ui';
import { ContinueCard } from './ContinueCard';
import { IdeaCard } from './IdeaCard';
import { RecentStories } from './RecentStories';
import { StartTiles } from './StartTiles';

export function HomeScreen() {
  const dockInset = useDockInset();
  const penName = useSettings(s => s.penName).trim();
  const writer = useSettings(s => s.role) === 'write';
  const [ideaOpen, setIdeaOpen] = useState(writer);
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
            {empty ? 'Start your first comic.' : 'What are we drawing today?'}
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

      <View className="gap-2">
        <SectionHeader>Start creating</SectionHeader>
        <StartTiles />
      </View>

      <Card>
        <ListItem
          title="Start from an idea"
          icon={IdeaIcon}
          right={<Icon icon={ideaOpen ? CaretDownIcon : CaretRightIcon} size={ICON.md} color="text-secondary" />}
          onPress={() => setIdeaOpen(open => !open)}
        />
      </Card>
      {ideaOpen && <IdeaCard empty={empty} />}

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
