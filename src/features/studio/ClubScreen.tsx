import { useState } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { activeProjects, chapterLabel } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useStudio } from '../../state/useStudio';
import { Card, EmptyState, IconButton, SectionHeader, Text } from '../../ui';
import { CharactersIcon } from '../../ui/icons';
import { STUDIO_ART } from '../../ui/studioArt';
import { ClubChapter } from './club/ClubChapter';
import { ClubIntro } from './club/ClubIntro';
import { useClubReviews } from './club/useClub';
import { ScoreStars } from './parts';
import { StudioPage } from './StudioPage';

/** The reading club: who they are on the first visit, then their ranking of the person's chapters and every vote. */
export function ClubScreen() {
  const navigation = useAppNavigation();
  const routeChapter = useAppRoute<'Club'>().params?.chapterId;
  const state = useStoryData();
  const introSeen = useStudio(s => s.clubIntroSeen);
  const [meeting, setMeeting] = useState(false);
  const [picked, setPicked] = useState<ID | null>(null);
  const rows = useClubReviews();

  if (!introSeen || meeting) {
    return (
      <StudioPage title={t('Reading club')} onBack={meeting ? () => setMeeting(false) : undefined}>
        <ClubIntro
          doneLabel={meeting ? t('Back to the reviews') : t('See what they think')}
          onDone={() => {
            useStudio.getState().setClubIntroSeen();
            setMeeting(false);
          }}
        />
      </StudioPage>
    );
  }

  const selectedId = picked ?? routeChapter ?? null;
  const selected = selectedId ? rows.find(row => row.rank.chapterId === selectedId) : undefined;
  if (selected) {
    const project = state.projects[selected.rank.projectId];
    return (
      <StudioPage
        title={chapterLabel(state, selected.rank.chapterId)}
        subtitle={project?.title.trim() || t('Untitled')}
        onBack={picked ? () => setPicked(null) : undefined}
      >
        <ClubChapter
          review={selected.review}
          rank={selected.rank.rank}
          onOpenChapter={() => navigation.navigate('Storyboard', { chapterId: selected.rank.chapterId })}
        />
      </StudioPage>
    );
  }

  const latest = activeProjects(state)[0];
  return (
    <StudioPage
      title={t('Reading club')}
      right={<IconButton icon={CharactersIcon} onPress={() => setMeeting(true)} accessibilityLabel={t('Meet the club')} />}
    >
      {rows.length === 0 ? (
        <EmptyState
          art={STUDIO_ART.club}
          title={t('Nothing for the club to read yet')}
          message={t('Write a script or draw a page in a chapter, and the club will read it and vote.')}
          action={
            latest
              ? { label: t('Open your story'), onPress: () => navigation.navigate('Project', { projectId: latest.id }) }
              : { label: t('Start a story'), onPress: () => navigation.navigate('NewProject') }
          }
        />
      ) : (
        <View className="gap-2">
          <SectionHeader>{t('Club ranking')}</SectionHeader>
          <Text variant="caption" tone="muted">
            {t('Your chapters, ordered by the club’s average vote. Votes change when the chapter changes.')}
          </Text>
          {rows.map(({ rank, review }) => (
            <Card
              key={rank.chapterId}
              onPress={() => setPicked(rank.chapterId)}
              accessibilityLabel={t('Rank {rank}: {chapter}, {score} out of 5', {
                rank: rank.rank,
                chapter: chapterLabel(state, rank.chapterId),
                score: review.average.toFixed(1),
              })}
              className="flex-row gap-3 p-3"
            >
              <View className={`h-10 w-10 items-center justify-center rounded-full ${rank.rank === 1 ? 'bg-accent' : 'bg-overlay'}`}>
                <Text variant="heading" tone={rank.rank === 1 ? 'onAccent' : 'text'}>
                  {rank.rank}
                </Text>
              </View>
              <View className="flex-1 gap-1">
                <Text variant="label" numberOfLines={1}>
                  {chapterLabel(state, rank.chapterId)}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {state.projects[rank.projectId]?.title.trim() || t('Untitled')}
                </Text>
                <View className="flex-row items-center gap-2">
                  <ScoreStars score={review.average} />
                  <Text variant="mono" tone="secondary">
                    {review.average.toFixed(1)}
                  </Text>
                </View>
                <Text variant="bodySmall" tone="secondary" numberOfLines={2}>
                  {review.headline}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </StudioPage>
  );
}
