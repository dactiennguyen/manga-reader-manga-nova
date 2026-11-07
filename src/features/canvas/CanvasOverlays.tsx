import { CaretRightIcon, CloseIcon, MaximizeIcon, MinimizeIcon } from '../../ui/icons';
import { useState } from 'react';
import { Image, StyleSheet, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { fitView, type SessionEnv } from '../../core/art/session';
import type { ViewState } from '../../core/art/tools';
import { fileUri } from '../../core/util/paths';
import { ICON, IconButton, Pressable, Text } from '../../ui';

const REF_SIZES = [152, 224];

/** A picture to draw from, or a character with their sheet and appearance notes. */
export type CanvasReference = { id: string; images: string[]; title?: string; note?: string };

const TIPS = [
  ['One finger', 'Draw. Press and hold to pick a color.'],
  ['Two fingers', 'Drag to pan, pinch to zoom, twist to rotate the view.'],
  ['Two-finger tap', 'Undo. Double-tap with two fingers to fit the screen.'],
  ['Three-finger tap', 'Redo.'],
  ['Rulers', 'The ruler button adds symmetry or perspective. Tap the same one again to turn it off.'],
  ['Shapes and tone', 'Tap the shapes tool twice to choose a shape. Brush and lasso fill can paint screentone.'],
  ['Stylus', 'Pressure is recorded and one finger pans the view.'],
  ['Double-tap outside the panel', 'Hide or show the tools.'],
];

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

export function ReferenceWindow({
  reference,
  initialX,
  initialY,
  onClose,
}: {
  reference: CanvasReference;
  initialX: number;
  initialY: number;
  onClose: () => void;
}) {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const [big, setBig] = useState(false);
  const [shown, setShown] = useState(0);
  const size = REF_SIZES[big ? 1 : 0];
  const { images, title, note } = reference;
  const path = images[shown];
  const pan = usePanGesture({
    onUpdate: e => {
      'worklet';
      x.value = Math.max(0, x.value + e.changeX);
      y.value = Math.max(0, y.value + e.changeY);
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onClose);
    },
  });
  const gesture = useSimultaneousGestures(pan, doubleTap);
  const place = useAnimatedStyle(() => ({ left: x.value, top: y.value }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View className="absolute overflow-hidden rounded-sm border-2 border-raised bg-raised" style={[{ width: size }, place]}>
        {path ? (
          <Image
            source={{ uri: fileUri(path) }}
            style={{ width: size - 4, height: size - 4 }}
            resizeMode="contain"
            accessibilityLabel={title ? `${title} reference` : 'Reference image'}
          />
        ) : null}
        {title || note ? (
          <View className="gap-0.5 px-2 pt-1">
            {title ? (
              <Text variant="label" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {note ? (
              <Text variant="caption" tone="secondary" numberOfLines={big ? 8 : 4}>
                {note}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View className="flex-row justify-between">
          <IconButton
            icon={big ? MinimizeIcon : MaximizeIcon}
            size={ICON.sm}
            onPress={() => setBig(value => !value)}
            accessibilityLabel={big ? 'Shrink reference image' : 'Enlarge reference image'}
          />
          {images.length > 1 ? (
            <IconButton
              icon={CaretRightIcon}
              size={ICON.sm}
              onPress={() => setShown(value => (value + 1) % images.length)}
              accessibilityLabel="Next reference image"
            />
          ) : null}
          <IconButton icon={CloseIcon} size={ICON.sm} onPress={onClose} accessibilityLabel="Hide reference image" />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function TipsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Pressable
      className="items-center justify-center bg-scrim p-6"
      style={StyleSheet.absoluteFill}
      onPress={onClose}
      accessibilityLabel="Dismiss tips"
    >
      <View className="max-w-96 gap-3 rounded-lg bg-raised p-4">
        <Text variant="title">Canvas gestures</Text>
        {TIPS.map(([head, body]) => (
          <View key={head} className="gap-0.5">
            <Text variant="label">{head}</Text>
            <Text variant="bodySmall" tone="secondary">
              {body}
            </Text>
          </View>
        ))}
        <Text variant="caption" tone="muted" className="pt-2 text-center">
          Tap to start drawing
        </Text>
      </View>
    </Pressable>
  );
}

export function DescriptionBanner({ text, top }: { text: string; top: number }) {
  return (
    <View pointerEvents="none" className="absolute left-16 right-16 rounded-md bg-raised px-3 py-2" style={{ top }}>
      <Text variant="bodySmall" numberOfLines={3} className="text-center">
        {text}
      </Text>
    </View>
  );
}

/** Updated by the UI thread, so a pinch changes this text without a React render. */
export function ZoomBadge({
  view,
  env,
  suffix,
  side,
  bottom,
}: {
  view: SharedValue<ViewState>;
  env: SharedValue<SessionEnv>;
  suffix: string;
  side: 'left' | 'right';
  bottom: number;
}) {
  const props = useAnimatedProps(() => {
    const v = view.value;
    const e = env.value;
    const fit = fitView(e.area, e.bbox, e.pageW, v.flip).scale;
    const degrees = Math.round((v.rot * 180) / Math.PI);
    const text = `${Math.round((v.scale / fit) * 100)}%${degrees ? ` · ${degrees}°` : ''}${suffix}`;
    return { text, defaultValue: text };
  });
  return (
    <View pointerEvents="none" className={`absolute rounded-sm bg-raised px-2 ${side === 'left' ? 'left-2' : 'right-2'}`} style={{ bottom }}>
      <AnimatedInput
        editable={false}
        animatedProps={props}
        className="p-0 font-inter-medium text-mono text-text"
        style={{ fontVariant: ['tabular-nums'] }}
      />
    </View>
  );
}

/** A ring the size of the brush at the current zoom, shown while the size slider moves. */
export function BrushPreview({ size, view }: { size: number; view: SharedValue<ViewState> }) {
  const ring = useAnimatedStyle(() => {
    const d = Math.max(4, size * view.value.scale);
    return { width: d, height: d, borderRadius: d / 2 };
  });
  return (
    <View pointerEvents="none" className="items-center justify-center" style={StyleSheet.absoluteFill}>
      <Animated.View className="border-2 border-accent" style={ring} />
    </View>
  );
}
