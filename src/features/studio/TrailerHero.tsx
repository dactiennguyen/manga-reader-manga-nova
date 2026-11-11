import { useIsFocused } from '@react-navigation/native';
import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { artImageUris } from '../../core/art/strokes';
import { t } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { recordPage, pageContext } from '../../render/drawPage';
import { useEngineFonts } from '../../render/fonts';
import { loadImage, useImageCacheRev } from '../../render/images';
import { PAPER } from '../../render/ink';
import { loadArt } from '../../state/artStore';
import { useProject, useWhileFocused } from '../../state/hooks';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { ART, ArtBanner, ICON, Icon, Pressable, Text } from '../../ui';
import { PlayIcon } from '../../ui/icons';

const RATIO = 3 / 2;
/** Where a still banner rests: near the top, where a page usually opens. */
const STILL_AT = 0.2;

/** One slow pass down the page, longer for a tall page so the speed stays gentle. */
function panDuration(range: number, height: number): number {
  return Math.min(40000, Math.max(12000, (range / Math.max(1, height)) * 9000));
}

/** The printed banner Home had before anything was drawn, with its greeting. */
function Greeting() {
  const penName = useSettings(s => s.penName).trim();
  const empty = useStory(s => !Object.values(s.projects).some(project => !project.deletedAt));
  return (
    <ArtBanner source={ART.homeHero} ratio={RATIO}>
      <View className="absolute left-4 top-3 w-1/2">
        <Text variant="display" tone="onPaper" accessibilityRole="header" numberOfLines={1}>
          {penName ? t('Hi {name}', { name: penName }) : t('Hi there')}
        </Text>
        <Text variant="bodySmall" tone="onPaper" numberOfLines={2}>
          {empty ? t('Start your first comic.') : t('What are we drawing today?')}
        </Text>
      </View>
    </ArtBanner>
  );
}

function PanningPage({ pageId, width }: { pageId: ID; width: number }) {
  const fonts = useEngineFonts();
  const imageRev = useImageCacheRev();
  // Kept as last shown while Home is out of sight, so drawing on this page does not record it again under the canvas.
  const page = useWhileFocused(useStory(s => s.pages[pageId]));
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const ctx = useMemo(() => (page ? pageContext(pageId) : null), [page, pageId]);

  useEffect(() => {
    ctx?.shapes.forEach(shape => artImageUris(loadArt(shape.id)).forEach(uri => loadImage(uri).catch(() => undefined)));
  }, [ctx]);

  const picture = useMemo(
    () => (ctx ? recordPage(ctx, fonts) : null),
    // The image cache revision redraws the page once a layer image has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, fonts, imageRev],
  );

  const height = width / RATIO;
  const scale = ctx ? width / ctx.size.w : 1;
  const range = ctx ? Math.max(0, ctx.size.h * scale - height) : 0;
  const progress = useSharedValue(STILL_AT);

  useEffect(() => {
    if (reduced || !focused || range <= 0) {
      cancelAnimation(progress);
      progress.set(STILL_AT);
      return;
    }
    progress.set(withRepeat(withTiming(1, { duration: panDuration(range, height), easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(progress);
  }, [reduced, focused, range, height, progress]);

  const transform = useDerivedValue(() => [{ translateY: -range * progress.value }, { scale }]);

  if (!picture) {
    return null;
  }
  return (
    <Canvas style={{ width, height, backgroundColor: PAPER }}>
      <Group transform={transform}>
        <Picture picture={picture} />
      </Group>
    </Canvas>
  );
}

/**
 * The top of Home: the newest drawn page of the story (`pageId`, from useHomeData), drifting slowly under
 * the title, as a way into its trailer. One recorded picture moved by a transform, so it costs about as much
 * as a still image. Before anything is drawn it is the printed banner with the greeting.
 */
export function TrailerHero({ projectId, pageId, onPress }: { projectId: ID | null; pageId: ID | null; onPress: () => void }) {
  const project = useProject(projectId ?? undefined);
  const [width, setWidth] = useState(0);

  if (!project || !pageId) {
    return <Greeting />;
  }
  const title = project.title.trim() || t('Untitled');
  return (
    <Pressable
      accessibilityLabel={t('Watch the trailer of {title}', { title })}
      onPress={onPress}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      className="overflow-hidden rounded-xl bg-paper"
      style={{ aspectRatio: RATIO }}
    >
      {width > 0 && <PanningPage pageId={pageId} width={width} />}
      <View className="absolute inset-x-3 bottom-3 flex-row items-end gap-2">
        <View className="flex-1 items-start">
          <View className="max-w-full rounded-md bg-paper px-3 py-2">
            <Text variant="caption" tone="onPaper" numberOfLines={1}>
              {t('Your latest page')}
            </Text>
            <Text variant="heading" tone="onPaper" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>
        <View className="h-12 flex-row items-center gap-1.5 rounded-full bg-accent px-4">
          <Icon icon={PlayIcon} size={ICON.sm} color="on-accent" weight="bold" />
          <Text variant="label" tone="onAccent">
            {t('Watch trailer')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
