import { useMemo } from 'react';
import { View } from 'react-native';
import { Brush, X, Lightbulb } from 'lucide-react-native';

import { activeProjects, projectProgress } from '../../core/model/selectors';
import { tipOfDay } from '../../core/story/ideas';
import { resumeTarget } from '../../core/story/resume';
import { dayKey } from '../../core/util/time';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { Button, Card, Icon, IconButton, Screen, SectionHeader, Text, useDockInset } from '../../ui';
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
      <View>
        <Text variant="display" accessibilityRole="header">
          {penName ? `Hi ${penName}` : 'Hi there'}
        </Text>
        <Text tone="secondary">{empty ? 'Start a new story today.' : 'Which story are you working on today?'}</Text>
      </View>

      {empty && <Text variant="heading">Tell me your idea!</Text>}

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
            icon={Brush}
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
                icon={X}
                size={18}
                accessibilityLabel="Hide today's tip"
                onPress={() => useSettings.getState().set({ tipDismissedDay: today })}
              />
            }
          >
            Tip of the day
          </SectionHeader>
          <Card className="flex-row items-start gap-2 p-3">
            <Icon icon={Lightbulb} size={18} color="accent" />
            <Text variant="bodySmall" className="flex-1">
              {tipOfDay(today)}
            </Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}
