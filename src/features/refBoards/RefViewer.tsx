import { useState } from 'react';
import { Image, Modal, View, useWindowDimensions } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useExclusiveGestures,
  usePanGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../../core/i18n';
import { containSize, stepIndex } from '../../core/refBoards/layout';
import { fileUri } from '../../core/util/paths';
import type { RefImage } from '../../state/useRefBoards';
import { IconButton, Tag, Text } from '../../ui';
import { CaretLeftIcon, CaretRightIcon, CloseIcon, TagIcon } from '../../ui/icons';
import { useZoom } from '../preview/useZoom';

const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 700;

type Shot = Pick<RefImage, 'id' | 'path' | 'width' | 'height' | 'caption' | 'tags'>;

function ZoomImage({
  shot,
  frameW,
  frameH,
  onStep,
  onTap,
}: {
  shot: Shot;
  frameW: number;
  frameH: number;
  onStep: (delta: number) => void;
  onTap: () => void;
}) {
  const content = containSize(shot.width, shot.height, frameW, frameH);
  const { pinch, pan, style, zoomed, toggleAt } = useZoom({ frameW, frameH, contentW: content.w, contentH: content.h });
  const swipe = usePanGesture({
    enabled: !zoomed,
    runOnJS: true,
    maxPointers: 1,
    activeOffsetX: [-20, 20],
    failOffsetY: [-30, 30],
    onDeactivate: (e: { canceled: boolean; translationX: number; velocityX: number }) => {
      if (e.canceled) {
        return;
      }
      if (e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY) {
        onStep(1);
      } else if (e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY) {
        onStep(-1);
      }
    },
  });
  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    maxDelay: 250,
    maxDistance: 16,
    onDeactivate: (e: { canceled: boolean; x: number; y: number }) => {
      if (!e.canceled) {
        toggleAt(e.x, e.y);
      }
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    maxDistance: 16,
    onDeactivate: (e: { canceled: boolean }) => {
      if (!e.canceled) {
        onTap();
      }
    },
  });
  const taps = useExclusiveGestures(doubleTap, tap);
  const gesture = useSimultaneousGestures(pinch, pan, swipe, taps);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        accessible
        accessibilityRole="image"
        accessibilityLabel={shot.caption || t('Reference image')}
        className="absolute inset-0 items-center justify-center"
      >
        <Animated.View style={[{ width: content.w, height: content.h }, style]}>
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: fileUri(shot.path) }}
            style={{ width: content.w, height: content.h }}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Full screen, one picture at a time. Pinch or double-tap to zoom, swipe or the arrows to change picture,
 * tap to hide the bars.
 */
export function RefViewer({
  images,
  index,
  title,
  onIndex,
  onClose,
}: {
  images: Shot[];
  index: number | null;
  title?: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [chrome, setChrome] = useState(true);
  const shot = index !== null ? images[Math.min(index, images.length - 1)] : undefined;
  const step = (delta: number) => {
    if (index !== null && images.length > 1) {
      onIndex(stepIndex(index, delta, images.length));
    }
  };
  const many = images.length > 1;
  return (
    <Modal visible={!!shot} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView className="flex-1 bg-bg">
        {shot ? (
          <ZoomImage key={shot.id} shot={shot} frameW={width} frameH={height} onStep={step} onTap={() => setChrome(value => !value)} />
        ) : null}
        {chrome && shot ? (
          <>
            <View className="absolute inset-x-2 flex-row items-center gap-2 rounded-lg bg-raised px-1" style={{ top: insets.top + 8 }}>
              <IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel={t('Close')} />
              <View className="flex-1">
                {title ? (
                  <Text variant="label" numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
                {many && index !== null ? (
                  <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                    {`${index + 1} / ${images.length}`}
                  </Text>
                ) : null}
              </View>
            </View>
            {many || shot.caption || shot.tags.length ? (
              <View
                className="absolute inset-x-2 flex-row items-center gap-1 rounded-lg bg-raised p-1"
                style={{ bottom: insets.bottom + 8 }}
              >
                {many ? <IconButton icon={CaretLeftIcon} onPress={() => step(-1)} accessibilityLabel={t('Previous picture')} /> : null}
                <View className="flex-1 gap-1 px-2 py-1">
                  {shot.caption ? (
                    <Text variant="bodySmall" numberOfLines={4}>
                      {shot.caption}
                    </Text>
                  ) : null}
                  {shot.tags.length ? (
                    <View className="flex-row flex-wrap gap-1">
                      {shot.tags.map(tag => (
                        <Tag key={tag} icon={TagIcon} label={tag} />
                      ))}
                    </View>
                  ) : null}
                </View>
                {many ? <IconButton icon={CaretRightIcon} onPress={() => step(1)} accessibilityLabel={t('Next picture')} /> : null}
              </View>
            ) : null}
          </>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
