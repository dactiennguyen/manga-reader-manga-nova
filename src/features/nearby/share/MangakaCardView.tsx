import type { RefObject } from 'react';
import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { initialOf } from '../../../core/model/selectors';
import { QrCode, Text } from '../../../ui';
import type { CardViewRef } from '../../studio/cards/FlipCard';

/**
 * The mangaka card: printed on cream paper in both themes like the character cards, so a shared picture of it
 * looks the same everywhere and the QR code always scans (dark ink on light paper).
 */
export function MangakaCardView({
  name,
  stories,
  link,
  roomName,
  width,
  viewRef,
}: {
  name: string;
  stories: string[];
  link: string;
  roomName?: string;
  width: number;
  viewRef?: RefObject<CardViewRef | null>;
}) {
  const qr = Math.round(width * 0.5);
  return (
    <View ref={viewRef} collapsable={false} className="overflow-hidden rounded-xl border border-on-paper/20 bg-paper p-4" style={{ width }}>
      <View className="gap-4 rounded-lg border border-dashed border-on-paper/40 p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-on-paper">
            <Text variant="display" tone="onPaper" maxFontSizeMultiplier={1}>
              {initialOf(name)}
            </Text>
          </View>
          <View className="flex-1">
            {/* Without a pen name the name already reads "Mangaka", so the label would say it twice. */}
            {name !== t('Mangaka') && (
              <Text variant="caption" tone="onPaper" className="opacity-75" maxFontSizeMultiplier={1.2}>
                {t('Mangaka')}
              </Text>
            )}
            <Text variant="title" tone="onPaper" numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {name}
            </Text>
          </View>
        </View>
        {stories.length > 0 && (
          <View className="gap-1">
            {stories.map(title => (
              <Text key={title} variant="bodySmall" tone="onPaper" numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {t('“{title}”', { title })}
              </Text>
            ))}
          </View>
        )}
        <View className="items-center gap-2">
          <QrCode value={link} size={qr} accessibilityLabel={t('QR code to add {name} as a friend', { name })} />
          <Text variant="caption" tone="onPaper" className="text-center" maxFontSizeMultiplier={1.2}>
            {roomName
              ? t('Scan with a phone camera to add me and join “{room}”', { room: roomName })
              : t('Scan with a phone camera to add me in Manganova')}
          </Text>
        </View>
      </View>
    </View>
  );
}
