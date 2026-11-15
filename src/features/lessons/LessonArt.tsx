/**
 * The vector drawings of the lessons: guide strokes as clean ink lines on paper, the earlier steps faint
 * behind them, and the learner's own ink when there is some. Nothing here is a bitmap.
 */
import { Canvas, Circle, DashPathEffect, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { PAGE_H, PAGE_W } from '../../core/lessons/catalog';
import { boundsOf, fitBox, type Box, type GuideStroke } from '../../core/lessons/shapes';
import type { Stroke } from '../../core/model/types';
import { strokePath } from '../../render/drawArt';
import { useColor } from '../../ui';

export const FULL_PAGE: Box = { x: 0, y: 0, w: PAGE_W, h: PAGE_H };

const paths = new WeakMap<GuideStroke, SkPath>();

/** A guide stroke as a Skia path, built once per stroke: the catalogue never changes. */
export function guidePath(stroke: GuideStroke): SkPath {
  const cached = paths.get(stroke);
  if (cached) {
    return cached;
  }
  const builder = Skia.PathBuilder.Make();
  const p = stroke.points;
  if (p.length >= 2) {
    builder.moveTo(p[0], p[1]);
    for (let i = 2; i + 1 < p.length; i += 2) {
      builder.lineTo(p[i], p[i + 1]);
    }
  }
  const path = builder.build();
  paths.set(stroke, path);
  return path;
}

export type ArtColors = { ink: string; accent: string };

/** The colours of the drawings, read outside the Skia canvas: context does not reach inside it. */
export function useArtColors(): ArtColors {
  const ink = useColor('on-paper');
  const accent = useColor('accent');
  return useMemo(() => ({ ink, accent }), [ink, accent]);
}

/**
 * Strokes in page units, drawn inside a Group already scaled by `scale`. `width` is in screen pixels, so lines
 * keep the same weight at any size. Guides can be dashed, and a dot can mark where each stroke starts.
 */
export const GuideLayer = memo(function GuideLayerView({
  strokes,
  color,
  scale,
  width,
  opacity = 1,
  dashed = false,
  startColor,
}: {
  strokes: readonly GuideStroke[];
  color: string;
  scale: number;
  width: number;
  opacity?: number;
  dashed?: boolean;
  /** Draws a dot at the start of each stroke in this colour. */
  startColor?: string;
}) {
  const k = Math.max(0.01, scale);
  return (
    <Group opacity={opacity}>
      {strokes.map((stroke, index) => (
        <Path key={index} path={guidePath(stroke)} style="stroke" strokeWidth={width / k} strokeCap="round" strokeJoin="round" color={color}>
          {dashed && <DashPathEffect intervals={[10 / k, 8 / k]} />}
        </Path>
      ))}
      {!!startColor &&
        strokes.map((stroke, index) => <Circle key={`s${index}`} cx={stroke.points[0]} cy={stroke.points[1]} r={(width + 3) / k} color={startColor} />)}
    </Group>
  );
});

/** The learner's strokes, drawn the way the canvas draws them. */
export const InkLayer = memo(function InkLayerView({ ink, color }: { ink: readonly Stroke[]; color: string }) {
  return (
    <Group>
      {ink.map((stroke, index) => {
        const path = strokePath(stroke);
        return path ? <Path key={index} path={path} color={color} /> : null;
      })}
    </Group>
  );
});

/**
 * A still drawing: the step's strokes in ink over the earlier ones, cropped to what is drawn (or to `box`).
 * With `ink`, the guide turns faint and the learner's strokes go on top.
 */
export function LessonArt({
  strokes,
  context = [],
  ink,
  width,
  height,
  box,
  startDots = false,
  label,
}: {
  strokes: readonly GuideStroke[];
  context?: readonly GuideStroke[];
  ink?: readonly Stroke[];
  width: number;
  height: number;
  box?: Box;
  startDots?: boolean;
  /** What the drawing shows, for screen readers. */
  label: string;
}) {
  const colors = useArtColors();
  const frame = useMemo(() => box ?? boundsOf([...context, ...strokes], 50) ?? FULL_PAGE, [box, context, strokes]);
  const fit = fitBox(frame, width, height);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} className="overflow-hidden rounded-md bg-paper" style={{ width, height }}>
      <Canvas style={{ width, height }}>
        <Group transform={[{ translateX: fit.x }, { translateY: fit.y }, { scale: fit.scale }]}>
          <GuideLayer strokes={context} color={colors.ink} scale={fit.scale} width={2} opacity={0.3} />
          <GuideLayer
            strokes={strokes}
            color={colors.ink}
            scale={fit.scale}
            width={ink ? 2 : 3}
            opacity={ink ? 0.3 : 1}
            dashed={!!ink}
            startColor={startDots ? colors.accent : undefined}
          />
          {!!ink && <InkLayer ink={ink} color={colors.ink} />}
        </Group>
      </Canvas>
    </View>
  );
}
