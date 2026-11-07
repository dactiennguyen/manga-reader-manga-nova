import { Image, View } from 'react-native';
import { CheckIcon, CircleIcon, DoneIcon, FlagIcon, PanelsIcon, PenLineIcon } from '../../ui/icons';

import { PAGE_STATUS_LABEL } from '../../core/model/constants';
import { pageStatus } from '../../core/model/selectors';
import type { ID, PageStatus } from '../../core/model/types';
import { STORYBOARD_SIZES, pageLabel } from '../../core/reorder/storyboardGrid';
import { useThumb } from '../../render/thumbs';
import { panelHasArt } from '../../state/artStore';
import { usePage } from '../../state/hooks';
import { ICON, Icon, Pressable, Skeleton, Text, type ColorToken, type IconGlyph } from '../../ui';

const STATUS_ICON: Record<PageStatus, IconGlyph> = {
  empty: CircleIcon,
  paneled: PanelsIcon,
  drawing: PenLineIcon,
  done: DoneIcon,
};

const STATUS_COLOR: Record<PageStatus, ColorToken> = {
  empty: 'text-muted',
  paneled: 'text-secondary',
  drawing: 'accent',
  done: 'success',
};

const MENU_ACTION = 'menu';

export function PageThumb({
  pageId,
  number,
  width,
  height,
  selecting,
  selected,
  onPress,
  onLongPress,
  onMenu,
}: {
  pageId: ID;
  number: number;
  width: number;
  height: number;
  selecting?: boolean;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  /** Screen readers cannot hold and drag, so the menu stays reachable as an action. */
  onMenu?: () => void;
}) {
  const page = usePage(pageId);
  const uri = useThumb(pageId);
  if (!page) {
    return null;
  }
  const status = pageStatus(page, panelHasArt);
  return (
    <Pressable
      accessibilityLabel={pageLabel(number, Object.keys(page.panels).length, PAGE_STATUS_LABEL[status], !!page.flag)}
      accessibilityState={{ selected: !!selected }}
      accessibilityActions={onMenu ? [{ name: MENU_ACTION, label: 'Page menu' }] : undefined}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === MENU_ACTION) {
          onMenu?.();
        }
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
    >
      <View className={`overflow-hidden rounded-sm ${selected ? 'border-2 border-accent' : ''}`} style={{ width, height }}>
        {uri ? (
          <View className="flex-1 bg-white">
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri }}
              className="h-full w-full"
              resizeMode="cover"
              resizeMethod="resize"
            />
          </View>
        ) : (
          <Skeleton className="flex-1" />
        )}
        {selecting && (
          <View
            className={`absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full border ${
              selected ? 'border-accent bg-accent' : 'border-control-border bg-surface'
            }`}
          >
            {selected && <Icon icon={CheckIcon} size={ICON.sm} color="on-accent" />}
          </View>
        )}
      </View>
      <View className="flex-row items-center justify-center gap-1" style={{ height: STORYBOARD_SIZES.metaHeight }}>
        <Text variant="label">{number}</Text>
        <Icon icon={STATUS_ICON[status]} size={ICON.xs} color={STATUS_COLOR[status]} />
        {!!page.flag && <Icon icon={FlagIcon} size={ICON.xs} color="warning" />}
      </View>
    </Pressable>
  );
}
