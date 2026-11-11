import { memo, useMemo } from 'react';
import { Image, View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { chapterLabel } from '../../core/model/selectors';
import { issueOf } from '../../core/studio/magazine';
import { panelHasArt } from '../../state/artStore';
import { useAppNavigation } from '../../state/navigation';
import { Card, Divider, ICON, Icon, Pressable, Text } from '../../ui';
import { CaretRightIcon } from '../../ui/icons';
import { STUDIO_ART } from '../../ui/studioArt';
import { ScoreStars } from '../studio/parts';
import { HomeThumb } from './HomeThumb';
import type { HomeData } from './useHomeData';

const COVER_W = 72;
const COVER_H = 100;
const TOP = 3;

/** This week's issue of the person's own magazine and the reading club's top chapters. */
export const MagazineCard = memo(function MagazineCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, studio, today, artVersion, projects, club } = data;
  const weekday = studio.issueWeekday;
  const ranking = club.ranking;
  const issue = useMemo(
    () => issueOf(state, { issueWeekday: weekday }, today, ranking, panelHasArt),
    // Art is not React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, weekday, today, ranking, artVersion],
  );

  if (!projects.length) {
    return null;
  }
  const issueText = t('Issue no. {n}', { n: issue.number });
  const when = issue.daysLeft === 0 ? t('A new issue comes out today') : tn(issue.daysLeft, 'Next issue in {count} day', 'Next issue in {count} days');
  const top = ranking.slice(0, TOP);
  const several = projects.length > 1;

  return (
    <Card>
      <Pressable
        accessibilityLabel={`${t('My magazine')}, ${issueText}. ${when}`}
        onPress={() => navigation.navigate('Magazine')}
        className="flex-row items-center gap-3 p-3"
      >
        {issue.coverPageId ? (
          <HomeThumb pageId={issue.coverPageId} width={COVER_W} height={COVER_H} />
        ) : (
          <Image
            accessibilityIgnoresInvertColors
            source={STUDIO_ART.magazine}
            resizeMode="cover"
            className="rounded-sm bg-paper"
            style={{ width: COVER_W, height: COVER_H }}
          />
        )}
        <View className="flex-1 gap-1">
          <Text variant="caption" tone="muted">
            {t('My magazine')}
          </Text>
          <Text variant="heading">{issueText}</Text>
          <Text variant="bodySmall" tone="secondary">
            {when}
          </Text>
        </View>
        <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
      </Pressable>
      <Divider />
      <Pressable
        accessibilityLabel={t('Club ranking')}
        onPress={() => navigation.navigate('Club', {})}
        className="gap-2 p-3"
      >
        <View className="flex-row items-center gap-2">
          <Text variant="label" className="flex-1">
            {t('Club ranking')}
          </Text>
          <Text variant="label" tone="accent">
            {t('See all')}
          </Text>
          <Icon icon={CaretRightIcon} size={ICON.sm} color="accent" />
        </View>
        {top.length ? (
          top.map(item => (
            <View key={item.chapterId} className="min-h-10 flex-row items-center gap-3">
              <Text variant="heading" tone="secondary" className="w-6 text-center" style={{ fontVariant: ['tabular-nums'] }}>
                {item.rank}
              </Text>
              <View className="flex-1">
                <Text variant="label" numberOfLines={1}>
                  {chapterLabel(state, item.chapterId)}
                </Text>
                {several && (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {state.projects[item.projectId]?.title.trim() || t('Untitled')}
                  </Text>
                )}
              </View>
              <ScoreStars score={item.average} size={ICON.xs} />
            </View>
          ))
        ) : (
          <Text variant="bodySmall" tone="secondary">
            {t('Write or draw a chapter and the club will rank it here.')}
          </Text>
        )}
      </Pressable>
    </Card>
  );
});
