import { Image, View } from 'react-native';

import { t } from '../../../core/i18n';
import type { ID } from '../../../core/model/types';
import { formatDate } from '../../../core/util/time';
import { useThumb } from '../../../render/thumbs';
import { Text } from '../../../ui';
import { STUDIO_ART } from '../../../ui/studioArt';

const COVER_MAX = 360;
const COVER_RATIO = 0.72;

/**
 * This week's cover, printed like a manga weekly: masthead, issue number and date over the person's latest
 * drawn page. Before anything is drawn, the magazine's own artwork stands in with a note saying so.
 */
export function MagazineCover({
  number,
  pageId,
  lead,
  day,
}: {
  number: number;
  pageId: ID | null;
  /** The cover line: the lead chapter of the issue, or nothing. */
  lead: string;
  day: number;
}) {
  const uri = useThumb(pageId ?? undefined);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('Cover of issue {n}', { n: number })}
      className="w-full self-center overflow-hidden rounded-lg border border-on-paper/20 bg-paper p-3"
      style={{ maxWidth: COVER_MAX, aspectRatio: COVER_RATIO }}
    >
      <View className="flex-row items-end justify-between gap-2 border-b-2 border-on-paper pb-1">
        <View className="shrink">
          <Text variant="caption" tone="onPaper" className="uppercase tracking-widest" maxFontSizeMultiplier={1}>
            {t('Weekly')}
          </Text>
          <Text variant="display" tone="onPaper" className="uppercase" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>
            Manganova
          </Text>
        </View>
        <View className="items-end">
          <Text variant="heading" tone="onPaper" maxFontSizeMultiplier={1}>
            {t('No. {n}', { n: number })}
          </Text>
          <Text variant="caption" tone="onPaper" maxFontSizeMultiplier={1}>
            {formatDate(day)}
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-1 overflow-hidden rounded-sm border border-on-paper/30 bg-white">
        <Image
          accessibilityIgnoresInvertColors
          source={uri ? { uri } : STUDIO_ART.magazine}
          resizeMode="cover"
          className="h-full w-full"
        />
      </View>
      {lead ? (
        <View className="absolute bottom-6 left-5 right-5 self-start rounded-sm bg-accent px-2 py-1">
          <Text variant="label" tone="onAccent" numberOfLines={2} maxFontSizeMultiplier={1.2}>
            {lead}
          </Text>
        </View>
      ) : !pageId ? (
        <View className="absolute bottom-6 left-5 right-5 rounded-sm bg-paper px-2 py-1">
          <Text variant="caption" tone="onPaper" numberOfLines={2} maxFontSizeMultiplier={1.2}>
            {t('Draw a page and it becomes the cover.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
