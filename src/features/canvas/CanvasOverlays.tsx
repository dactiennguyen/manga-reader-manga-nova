import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { fitView, type SessionEnv } from '../../core/art/session';
import type { ViewState } from '../../core/art/tools';
import { msg, t } from '../../core/i18n';
import { Pressable, Text } from '../../ui';

const TIPS = [
  [msg('One finger'), msg('Draw. Press and hold to pick a color.')],
  [msg('Two fingers'), msg('Drag to pan, pinch to zoom, twist to rotate the view.')],
  [msg('Two-finger tap'), msg('Undo. Double-tap with two fingers to fit the screen.')],
  [msg('Three-finger tap'), msg('Redo.')],
  [msg('Rulers'), msg('The ruler button adds symmetry or perspective. Tap the same one again to turn it off.')],
  [msg('Shapes and tone'), msg('Tap the shapes tool twice to choose a shape. Brush and lasso fill can paint screentone.')],
  [msg('Stylus'), msg('Pressure is recorded and one finger pans the view.')],
  [msg('Double-tap outside the panel'), msg('Hide or show the tools.')],
];

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

export function TipsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Pressable
      className="items-center justify-center bg-scrim p-6"
      style={StyleSheet.absoluteFill}
      onPress={onClose}
      accessibilityLabel={t('Dismiss tips')}
    >
      <View className="max-w-96 gap-3 rounded-lg bg-raised p-4">
        <Text variant="title">{t('Canvas gestures')}</Text>
        {TIPS.map(([head, body]) => (
          <View key={head} className="gap-0.5">
            <Text variant="label">{t(head)}</Text>
            <Text variant="bodySmall" tone="secondary">
              {t(body)}
            </Text>
          </View>
        ))}
        <Text variant="caption" tone="muted" className="pt-2 text-center">
          {t('Tap to start drawing')}
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
