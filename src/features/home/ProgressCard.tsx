import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { progressPair } from '../../core/studio/progress';
import { panelHasArt } from '../../state/artStore';
import { useAppNavigation } from '../../state/navigation';
import { Card, Pressable, SectionHeader, Text } from '../../ui';
import { HomeThumb } from './HomeThumb';
import type { HomeData } from './useHomeData';

const THUMB_W = 120;
const THUMB_H = 168;
const MEMORY_W = 48;
const MEMORY_H = 68;

function PageTile({ pageId, label, onOpen }: { pageId: ID; label: string; onOpen: (pageId: ID) => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={() => onOpen(pageId)} className="items-center gap-1">
      <HomeThumb pageId={pageId} width={THUMB_W} height={THUMB_H} />
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The first drawn page next to the latest, so the person sees how far they have come, and a page from this day. */
export const ProgressCard = memo(function ProgressCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, today, artVersion } = data;
  const pair = useMemo(
    () => progressPair(state, panelHasArt, today),
    // Art is not React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, today, artVersion],
  );

  if (!pair.firstPageId || !pair.latestPageId) {
    return null;
  }
  const openPage = (pageId: ID) => {
    const chapterId = state.pages[pageId]?.chapterId;
    if (chapterId) {
      navigation.navigate('Storyboard', { chapterId });
    }
  };
  const same = pair.firstPageId === pair.latestPageId;
  return (
    <View className="gap-2">
      <SectionHeader>{t('Your progress')}</SectionHeader>
      <Card className="gap-3 p-3">
        <View className="flex-row justify-center gap-4">
          <PageTile pageId={pair.firstPageId} label={same ? t('Your first drawn page') : t('First page')} onOpen={openPage} />
          {!same && <PageTile pageId={pair.latestPageId} label={t('Latest page')} onOpen={openPage} />}
        </View>
        <Text variant="bodySmall" tone="secondary" className="text-center">
          {same
            ? t('Draw another page and see them side by side.')
            : pair.daysBetween > 0
              ? tn(pair.daysBetween, '{count} day of practice between them.', '{count} days of practice between them.')
              : t('Both drawn on the same day.')}
        </Text>
        {!!pair.memory && (
          <Pressable
            onPress={() => pair.memory && openPage(pair.memory.pageId)}
            className="flex-row items-center gap-3 rounded-md bg-overlay p-2"
          >
            <HomeThumb pageId={pair.memory.pageId} width={MEMORY_W} height={MEMORY_H} />
            <Text variant="label" className="flex-1">
              {tn(pair.memory.daysAgo, 'On this day {count} day ago', 'On this day {count} days ago')}
            </Text>
          </Pressable>
        )}
      </Card>
    </View>
  );
});
