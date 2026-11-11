/**
 * The square board of Guess the drawing. Everyone sees the drawer's strokes as they arrive; on the
 * drawer's phone the board also takes a finger or pen. A stroke goes out in small pieces while it is
 * drawn, so the others watch the line grow instead of waiting for the finger to lift.
 */
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { memo, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { BOARD_UNITS, INK_POINTS_MAX, type InkStroke } from '../../../core/nearby/guess';
import { useColor } from '../../../ui';

/** A piece of the stroke goes out at most this often. */
const SEND_EVERY_MS = 70;
/** Points closer than this (in board units) to the last one are skipped. */
const MIN_STEP = 2;

/** A smooth path through the points: quadratic curves between midpoints, as a pen would draw it. */
export function inkPath(points: readonly number[], scale: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  if (points.length < 2) {
    return builder.build();
  }
  const x = (i: number) => points[i] * scale;
  const y = (i: number) => points[i + 1] * scale;
  builder.moveTo(x(0), y(0));
  if (points.length < 4) {
    // A tap: a dot.
    builder.lineTo(x(0) + 0.01, y(0));
    return builder.build();
  }
  for (let i = 2; i < points.length - 2; i += 2) {
    builder.quadTo(x(i), y(i), (x(i) + x(i + 2)) / 2, (y(i) + y(i + 2)) / 2);
  }
  builder.lineTo(x(points.length - 2), y(points.length - 2));
  return builder.build();
}

/** Memoised: finished strokes keep their object, so only new or growing ones are drawn again. */
const StrokePath = memo(function StrokePathView({ stroke, scale }: { stroke: InkStroke; scale: number }) {
  const path = useMemo(() => inkPath(stroke.points, scale), [stroke.points, scale]);
  return <Path path={path} style="stroke" strokeWidth={stroke.size * scale} strokeCap="round" strokeJoin="round" color={stroke.color} />;
});

export type BoardPen = {
  size: number;
  color: string;
  /** Sends a piece of a stroke: its id, the new points (x, y in board units) and whether it is finished. */
  onInk: (id: number, points: number[], size: number, color: string, done: boolean) => void;
};

type Live = { id: number; size: number; color: string; points: number[]; unsent: number[]; sentAt: number };

/** Memoised so the screen's clock ticking does not redraw the board. */
export const GuessBoard = memo(function GuessBoardView({ strokes, side, pen }: { strokes: readonly InkStroke[]; side: number; pen?: BoardPen }) {
  const paper = useColor('paper');
  // The drawing area sits inside a 1px outline.
  const inner = side - 2;
  const scale = inner / BOARD_UNITS;
  const [live, setLive] = useState<InkStroke | null>(null);
  const current = useRef<Live | null>(null);
  const nextId = useRef(1);
  const latest = useRef({ pen, scale, strokes });
  latest.current = { pen, scale, strokes };

  const flush = (done: boolean) => {
    const stroke = current.current;
    const active = latest.current.pen;
    if (!stroke || !active || (!stroke.unsent.length && !done)) {
      return;
    }
    active.onInk(stroke.id, stroke.unsent, stroke.size, stroke.color, done);
    stroke.unsent = [];
    stroke.sentAt = Date.now();
  };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    enabled: !!pen,
    onBegin: event => {
      const active = latest.current.pen;
      if (!active) {
        return;
      }
      // Ids only grow, past any stroke already on the board, so pieces never land on an old stroke.
      const id = Math.max(nextId.current, ...latest.current.strokes.map(item => item.id + 1));
      nextId.current = id + 1;
      const point = [Math.round(event.x / latest.current.scale), Math.round(event.y / latest.current.scale)];
      current.current = { id, size: active.size, color: active.color, points: point, unsent: point.slice(), sentAt: 0 };
      setLive({ id, size: active.size, color: active.color, points: point, done: false });
      flush(false);
    },
    onUpdate: event => {
      const stroke = current.current;
      if (!stroke || stroke.points.length >= INK_POINTS_MAX * 4) {
        return;
      }
      const px = Math.round(Math.min(BOARD_UNITS, Math.max(0, event.x / latest.current.scale)));
      const py = Math.round(Math.min(BOARD_UNITS, Math.max(0, event.y / latest.current.scale)));
      const n = stroke.points.length;
      if (Math.hypot(px - stroke.points[n - 2], py - stroke.points[n - 1]) < MIN_STEP) {
        return;
      }
      stroke.points.push(px, py);
      stroke.unsent.push(px, py);
      setLive({ id: stroke.id, size: stroke.size, color: stroke.color, points: stroke.points.slice(), done: false });
      if (Date.now() - stroke.sentAt >= SEND_EVERY_MS || stroke.unsent.length >= INK_POINTS_MAX) {
        flush(false);
      }
    },
    onFinalize: () => {
      flush(true);
      current.current = null;
      setLive(null);
    },
  });

  // The stroke being drawn here is shown from this phone's copy until it is done, so it never lags.
  const shown = live ? strokes.filter(item => item.id !== live.id) : strokes;
  const board = (
    <View className="overflow-hidden rounded-2xl border border-control-border" style={{ width: side, height: side, backgroundColor: paper }}>
      <Canvas style={{ width: inner, height: inner }}>
        {shown.map(stroke => (
          <StrokePath key={stroke.id} stroke={stroke} scale={scale} />
        ))}
        {live ? <StrokePath stroke={live} scale={scale} /> : null}
      </Canvas>
    </View>
  );
  return pen ? <GestureDetector gesture={pan}>{board}</GestureDetector> : board;
});
