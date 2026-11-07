import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { panelOrder } from '../../core/layout/layout';
import { SHOT_LABEL } from '../../core/model/constants';
import type { ID, Page } from '../../core/model/types';
import type { ItemSize } from '../../core/reorder/reorder';
import { STORYBOARD_SIZES, thumbHeight } from '../../core/reorder/storyboardGrid';
import { Pressable, Text } from '../../ui';
import { PageThumb } from './PageThumb';

const { bottomSpace, listMaxHeight, listThumb, pad, rowGap } = STORYBOARD_SIZES;

export function StoryboardList({
  pages,
  pageSizes,
  webtoon,
  rtl,
  selection,
  onPressPage,
  onLongPressPage,
}: {
  pages: Page[];
  pageSizes: ItemSize[];
  webtoon: boolean;
  rtl: boolean;
  selection: ID[] | null;
  onPressPage: (pageId: ID) => void;
  onLongPressPage: (pageId: ID) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <FlatList
      data={pages}
      extraData={selection}
      keyExtractor={page => page.id}
      contentContainerStyle={{ padding: pad, paddingBottom: bottomSpace + insets.bottom, gap: rowGap }}
      renderItem={({ item: page, index }) => {
        const order = panelOrder(page, rtl);
        return (
          <Pressable
            accessible={false}
            accessibilityRole="none"
            onPress={() => onPressPage(page.id)}
            onLongPress={() => onLongPressPage(page.id)}
            className="flex-row gap-3"
          >
            <PageThumb
              pageId={page.id}
              number={index + 1}
              width={listThumb}
              height={thumbHeight(listThumb, pageSizes[index], webtoon, listMaxHeight)}
              selecting={!!selection}
              selected={selection?.includes(page.id)}
              onPress={() => onPressPage(page.id)}
              onLongPress={() => onLongPressPage(page.id)}
            />
            <View className="flex-1 gap-1">
              {order.length === 0 && (
                <Text variant="caption" tone="muted">
                  No panels yet
                </Text>
              )}
              {order.map((panelId, panelIndex) => {
                const panel = page.panels[panelId];
                return (
                  <Text key={panelId} variant="caption" tone="secondary" numberOfLines={2}>
                    <Text variant="label">
                      {panelIndex + 1}
                      {panel?.shot ? ` · ${SHOT_LABEL[panel.shot]}` : ''}
                    </Text>
                    {`  ${panel?.description || 'No description'}`}
                  </Text>
                );
              })}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
