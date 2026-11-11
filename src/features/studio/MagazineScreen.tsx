import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { activeProjects, chapterLabel } from '../../core/model/selectors';
import { issueOf } from '../../core/studio/magazine';
import { clubRanking } from '../../core/studio/ranking';
import { dayKey, dayKeyToDate, formatDate, weekdayName } from '../../core/util/time';
import { panelHasArt, useArtVersion } from '../../state/artStore';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useStudio } from '../../state/useStudio';
import { Card, Chip, ChipGroup, EmptyState, IconButton, ListItem, Section, Text } from '../../ui';
import { CharactersIcon, ChapterIcon } from '../../ui/icons';
import { STUDIO_ART } from '../../ui/studioArt';
import { MagazineCover } from './magazine/MagazineCover';
import { StudioPage } from './StudioPage';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** The person's own weekly: this issue's cover and contents, when the next one comes out and on which day. */
export function MagazineScreen() {
  const navigation = useAppNavigation();
  const state = useStoryData();
  const artVersion = useArtVersion();
  const weekday = useStudio(s => s.issueWeekday);
  const today = dayKey();
  const { issue, rank } = useMemo(() => {
    const ranking = clubRanking(state, panelHasArt);
    return { issue: issueOf(state, { issueWeekday: weekday }, today, ranking, panelHasArt), rank: ranking };
    // Art is not in React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, weekday, today, artVersion]);

  if (activeProjects(state).length === 0) {
    return (
      <StudioPage title={t('My magazine')}>
        <EmptyState
          art={STUDIO_ART.magazine}
          title={t('Your magazine starts with your first story')}
          message={t('Each week, an issue gathers the chapters you worked on, with your latest drawn page on the cover.')}
          action={{ label: t('Start a story'), onPress: () => navigation.navigate('NewProject') }}
        />
      </StudioPage>
    );
  }

  const rankOf = new Map(rank.map(item => [item.chapterId, item.rank]));
  const lead = issue.contents[0];
  return (
    <StudioPage title={t('My magazine')} subtitle={t('Issue no. {n}', { n: issue.number })}>
      <MagazineCover
        number={issue.number}
        pageId={issue.coverPageId}
        lead={lead ? chapterLabel(state, lead.chapterId) : ''}
        day={dayKeyToDate(today).getTime()}
      />
      <Card className="gap-1 p-4">
        <Text variant="caption" tone="secondary">
          {t('Next issue')}
        </Text>
        <Text variant="title">
          {issue.daysLeft === 0 ? t('Out today') : tn(issue.daysLeft, 'In {count} day', 'In {count} days')}
        </Text>
        <Text variant="bodySmall" tone="muted">
          {formatDate(dayKeyToDate(issue.nextDay).getTime(), true)}
        </Text>
      </Card>
      <Section title={t('In this issue')} footer={t('Chapters you worked on in the last seven days, best ranked by the club first.')}>
        {issue.contents.length > 0 ? (
          issue.contents.map(item => {
            const place = rankOf.get(item.chapterId);
            return (
              <ListItem
                key={item.chapterId}
                icon={ChapterIcon}
                title={chapterLabel(state, item.chapterId)}
                subtitle={
                  place
                    ? t('{story} · Club rank {rank}', { story: state.projects[item.projectId]?.title.trim() || t('Untitled'), rank: place })
                    : state.projects[item.projectId]?.title.trim() || t('Untitled')
                }
                onPress={() => navigation.navigate('Storyboard', { chapterId: item.chapterId })}
                right={
                  place ? (
                    <IconButton
                      icon={CharactersIcon}
                      onPress={() => navigation.navigate('Club', { chapterId: item.chapterId })}
                      accessibilityLabel={t("See the club's votes")}
                    />
                  ) : undefined
                }
              />
            );
          })
        ) : (
          <View className="p-4">
            <Text variant="bodySmall" tone="secondary">
              {t('Nothing worked on this week yet. Every chapter you change before the next issue goes in it.')}
            </Text>
          </View>
        )}
      </Section>
      <View className="gap-2">
        <Text variant="heading" accessibilityRole="header">
          {t('Release day')}
        </Text>
        <ChipGroup>
          {WEEKDAYS.map(day => (
            <Chip
              key={day}
              label={weekdayName(day)}
              selected={weekday === day}
              onPress={() => useStudio.getState().setIssueWeekday(day)}
            />
          ))}
        </ChipGroup>
      </View>
    </StudioPage>
  );
}
