import { memo, useMemo } from 'react';
import { Image, View } from 'react-native';

import { t } from '../../core/i18n';
import { chapterIdsOf, chapterLabel } from '../../core/model/selectors';
import type { ID, Project, StoryData } from '../../core/model/types';
import { chapterTouchedAt } from '../../core/studio/castUtil';
import type { ChapterReview } from '../../core/studio/types';
import { useAppNavigation } from '../../state/navigation';
import { Card, ICON, Icon, Text } from '../../ui';
import { CaretRightIcon } from '../../ui/icons';
import { STUDIO_ART } from '../../ui/studioArt';
import { CastAvatar, ScoreStars } from '../studio/parts';
import type { HomeData } from './useHomeData';

const FACES = 5;

/** The club's take on the chapter worked on last: the newest chapter that has something to read. */
function latestReview(state: StoryData, projects: Project[], reviews: ReadonlyMap<ID, ChapterReview>): ChapterReview | null {
  const ids: ID[] = projects.flatMap(project => chapterIdsOf(project)).filter(id => reviews.has(id));
  ids.sort((a, b) => chapterTouchedAt(state, b) - chapterTouchedAt(state, a));
  return ids.length ? (reviews.get(ids[0]) ?? null) : null;
}

/** What the reading club thought of the latest chapter, with a few of their faces and the average score. */
export const ClubCard = memo(function ClubCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, projects, club } = data;
  const review = useMemo(() => latestReview(state, projects, club.reviews), [state, projects, club]);
  const faces = useMemo(() => (review ? [...review.votes].sort((a, b) => b.score - a.score).slice(0, FACES) : []), [review]);

  if (!projects.length) {
    return null;
  }
  if (!review) {
    return (
      <Card onPress={() => navigation.navigate('Club', {})} className="flex-row items-center gap-3 p-3">
        <Image accessibilityIgnoresInvertColors source={STUDIO_ART.club} style={{ width: 64, height: 64 }} className="rounded-md bg-paper" />
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{t('The Manganova reading club')}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t('Write a scene and the club will read it and vote.')}
          </Text>
        </View>
        <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
      </Card>
    );
  }
  const chapter = chapterLabel(state, review.chapterId);
  return (
    <Card
      accessibilityLabel={`${t('Reading club')}, ${chapter}. ${review.headline} ${t('{score} out of 5 stars', { score: review.average })}`}
      onPress={() => navigation.navigate('Club', { chapterId: review.chapterId })}
      className="gap-2 p-3"
    >
      <View className="flex-row items-center gap-2">
        <Text variant="caption" tone="muted" className="flex-1" numberOfLines={1}>
          {t('Reading club')} · {chapter}
        </Text>
        <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
      </View>
      <Text variant="heading" numberOfLines={3}>
        {review.headline}
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="flex-row">
          {faces.map((vote, index) => (
            <View key={vote.readerId} className={`rounded-full border-2 border-surface ${index ? '-ml-2' : ''}`}>
              <CastAvatar id={vote.readerId} size={32} />
            </View>
          ))}
        </View>
        <ScoreStars score={review.average} />
        <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
          {review.average.toFixed(1)}
        </Text>
      </View>
    </Card>
  );
});
