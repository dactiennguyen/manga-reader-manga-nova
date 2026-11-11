import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { castMember } from '../../../core/studio/cast';
import type { ChapterReview } from '../../../core/studio/types';
import { Button, Card, Text } from '../../../ui';
import { PanelsIcon } from '../../../ui/icons';
import { CastAvatar, ScoreStars } from '../parts';

/** One chapter as the club saw it: the average, the headline and every member's vote and comment. */
export function ClubChapter({
  review,
  rank,
  onOpenChapter,
}: {
  review: ChapterReview;
  rank: number;
  onOpenChapter: () => void;
}) {
  return (
    <>
      <Card className="gap-2 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <ScoreStars score={review.average} size={24} />
          <Text variant="caption" tone="secondary">
            {t('Rank {rank}', { rank })}
          </Text>
        </View>
        <Text variant="display">{t('{score} / 5', { score: review.average.toFixed(1) })}</Text>
        <Text tone="secondary">{review.headline}</Text>
        <Button title={t('Open storyboard')} icon={PanelsIcon} variant="secondary" small className="mt-1 self-start" onPress={onOpenChapter} />
      </Card>
      <Card>
        {review.votes.map((vote, index) => {
          const member = castMember(vote.readerId);
          return (
            <View key={vote.readerId} className={`flex-row gap-3 p-3 ${index > 0 ? 'border-t border-divider' : ''}`}>
              <CastAvatar id={vote.readerId} size={44} />
              <View className="flex-1 gap-1">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View className="shrink">
                    <Text variant="label">{member.name}</Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {t(member.role)}
                    </Text>
                  </View>
                  <ScoreStars score={vote.score} />
                </View>
                <Text variant="bodySmall">{vote.comment}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}
