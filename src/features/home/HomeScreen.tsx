import { View } from 'react-native';

import { t } from '../../core/i18n';
import { Screen, SectionHeader, useDockInset } from '../../ui';
import { BadgesCard } from './BadgesCard';
import { CharacterCardsStrip } from './CharacterCardsStrip';
import { CharacterMessageCard } from './CharacterMessageCard';
import { ClubCard } from './ClubCard';
import { ContinueSection } from './ContinueSection';
import { EditorCard } from './EditorCard';
import { GiftCard } from './GiftCard';
import { HomeHero } from './HomeHero';
import { IdeaSection } from './IdeaSection';
import { JourneyCard } from './JourneyCard';
import { LettersCard } from './LettersCard';
import { MagazineCard } from './MagazineCard';
import { ProgressCard } from './ProgressCard';
import { PromptCard } from './PromptCard';
import { RecentStories } from './RecentStories';
import { SampleCard } from './SampleCard';
import { StartTiles } from './StartTiles';
import { StreakMiniCard } from './StreakMiniCard';
import { TipCard } from './TipCard';
import { useHomeData } from './useHomeData';

function StartCreating() {
  return (
    <View className="gap-2">
      <SectionHeader>{t('Start creating')}</SectionHeader>
      <StartTiles />
    </View>
  );
}

/**
 * Home reads top to bottom as a day at the studio: the latest page, the editor's note, a word from a
 * character, today's prompt and streak, the journey, where to continue, then the magazine, the club and
 * what has been won. Someone with no story yet gets the ways to start right under the editor's welcome.
 */
export function HomeScreen() {
  const dockInset = useDockInset();
  const data = useHomeData();
  const { project, projects, today, heroPageId } = data;
  const empty = projects.length === 0;

  return (
    <Screen scroll keyboard bottomInset={dockInset} contentClassName="pt-4">
      <HomeHero projectId={project?.id ?? null} pageId={heroPageId} />
      <EditorCard data={data} />
      {empty && <StartCreating />}
      {empty && <SampleCard />}
      <CharacterMessageCard data={data} />
      <View className="flex-row gap-3">
        <PromptCard data={data} />
        <StreakMiniCard data={data} />
      </View>
      <JourneyCard data={data} />
      <ContinueSection data={data} />
      <CharacterCardsStrip data={data} />
      <MagazineCard data={data} />
      <LettersCard data={data} />
      <ClubCard data={data} />
      <GiftCard data={data} />
      <BadgesCard data={data} />
      <ProgressCard data={data} />
      {!empty && <StartCreating />}
      <IdeaSection empty={empty} />
      {!empty && <RecentStories projects={projects.slice(0, 6)} />}
      <TipCard today={today} />
    </Screen>
  );
}
