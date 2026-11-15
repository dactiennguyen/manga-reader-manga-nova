/**
 * The practice page: the step's guide as faint dashed strokes, the earlier steps behind it, and the
 * learner's pen on top. Strokes are real G-pen strokes (core/art), drawn by the same code as the canvas
 * (render/drawArt), in page units so the score reads them as they are.
 */
import { Canvas, Group, Path, Rect } from '@shopify/react-native-skia';
import { memo, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { STROKE_POINT_LIMIT, appendPoint } from '../../core/art/strokes';
import { PAGE_H, PAGE_W } from '../../core/lessons/catalog';
import type { GuideStroke } from '../../core/lessons/shapes';
import type { Stroke } from '../../core/model/types';
import { buildStrokePath } from '../../render/drawArt';
import { useColor } from '../../ui';
import { GuideLayer, InkLayer, useArtColors } from './LessonArt';

/** G-pen width in page units: about the canvas default on a page this size. */
export const PRACTICE_PEN_SIZE = 7;
/** Points closer than this, in page units, are skipped. */
const MIN_STEP = 1.5;

const LiveInk = memo(function LiveInkView({ stroke, color }: { stroke: Stroke; color: string }) {
  const path = useMemo(() => buildStrokePath(stroke, false), [stroke]);
  return path ? <Path path={path} color={color} /> : null;
});

export function PracticePad({
  width,
  guide,
  context,
  showGuide,
  ink,
  onStroke,
  label,
}: {
  /** Page width in screen pixels. The height follows the page's 3:4 shape. */
  width: number;
  guide: readonly GuideStroke[];
  context: readonly GuideStroke[];
  showGuide: boolean;
  ink: readonly Stroke[];
  onStroke: (stroke: Stroke) => void;
  label: string;
}) {
  const colors = useArtColors();
  const paper = useColor('paper');
  const scale = width / PAGE_W;
  const height = PAGE_H * scale;
  const [live, setLive] = useState<Stroke | null>(null);
  const current = useRef<number[] | null>(null);
  const latest = useRef({ scale, onStroke, ink: colors.ink });
  latest.current = { scale, onStroke, ink: colors.ink };

  const toPage = (x: number, y: number): [number, number] => {
    const k = latest.current.scale;
    return [Math.min(PAGE_W, Math.max(0, x / k)), Math.min(PAGE_H, Math.max(0, y / k))];
  };
  const strokeOf = (points: number[]): Stroke => ({
    tool: 'gpen',
    color: latest.current.ink,
    size: PRACTICE_PEN_SIZE,
    opacity: 1,
    points,
  });

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    onBegin: event => {
      const points: number[] = [];
      appendPoint(points, ...toPage(event.x, event.y), 0);
      current.current = points;
      setLive(strokeOf(points.slice()));
    },
    onUpdate: event => {
      const points = current.current;
      if (!points || points.length >= STROKE_POINT_LIMIT) {
        return;
      }
      if (appendPoint(points, ...toPage(event.x, event.y), MIN_STEP)) {
        setLive(strokeOf(points.slice()));
      }
    },
    onFinalize: () => {
      const points = current.current;
      current.current = null;
      setLive(null);
      if (points?.length) {
        latest.current.onStroke(strokeOf(points));
      }
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View accessible accessibilityLabel={label} className="overflow-hidden rounded-sm" style={{ width, height }}>
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height} color={paper} />
          <Group transform={[{ scale }]}>
            <GuideLayer strokes={context} color={colors.ink} scale={scale} width={2} opacity={0.35} />
            {showGuide && <GuideLayer strokes={guide} color={colors.ink} scale={scale} width={3} opacity={0.4} dashed startColor={colors.accent} />}
            <InkLayer ink={ink} color={colors.ink} />
            {live ? <LiveInk stroke={live} color={colors.ink} /> : null}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}
