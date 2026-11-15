/**
 * The panel of Fill the bubbles: the artist's strokes on the square board of Guess the drawing, with the
 * bubbles drawn on top by the lettering code. On the artist's phone the board takes a pen (draw mode) or
 * moves bubbles (bubble mode): drag a bubble to move it, or the tip of its tail to point it.
 */
import { Canvas, Group, Picture, Rect, Skia } from '@shopify/react-native-skia';
import { memo, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { asPageBubble, cleanBubble, grabBubble, moveBubble, type FillBubble } from '../../../core/nearby/fill';
import { BOARD_UNITS, type InkStroke } from '../../../core/nearby/guess';
import { useEngineFonts } from '../../../render/fonts';
import { drawBubble } from '../../../render/drawBubble';
import { useColor } from '../../../ui';
import { GuessBoard, type BoardPen } from '../guess/GuessBoard';

const BOARD_BOX = { x: 0, y: 0, size: BOARD_UNITS };

export type BubbleEditor = {
  selected: number;
  onSelect: (index: number) => void;
  onChange: (index: number, bubble: FillBubble) => void;
};

type Drag = { index: number; part: 'tail' | 'body'; start: FillBubble };

/**
 * `lines` fills the bubbles; a bubble with no line shows its number, so writers know which field is which.
 * Memoised so the screen's clock ticking does not redraw the panel.
 */
export const FillBoard = memo(function FillBoardView({
  strokes,
  bubbles,
  lines,
  side,
  pen,
  editor,
}: {
  strokes: readonly InkStroke[];
  bubbles: readonly FillBubble[];
  lines?: readonly string[];
  side: number;
  /** The artist drawing. */
  pen?: BoardPen;
  /** The artist placing bubbles. */
  editor?: BubbleEditor;
}) {
  const fonts = useEngineFonts();
  const accent = useColor('accent');
  const inner = side - 2;
  const scale = inner / BOARD_UNITS;

  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, BOARD_UNITS, BOARD_UNITS));
    bubbles.forEach((bubble, index) => {
      const text = lines ? lines[index] ?? '' : String(index + 1);
      drawBubble(canvas, asPageBubble(bubble, text, `fill${index}`, BOARD_BOX), fonts);
    });
    return recorder.finishRecordingAsPicture();
  }, [bubbles, lines, fonts]);

  const drag = useRef<Drag | null>(null);
  const latest = useRef({ bubbles, editor, scale });
  latest.current = { bubbles, editor, scale };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    enabled: !!editor,
    onBegin: event => {
      const { bubbles: list, editor: active, scale: k } = latest.current;
      if (!active) {
        return;
      }
      const grab = grabBubble(list, { x: event.x / k, y: event.y / k });
      drag.current = grab ? { ...grab, start: list[grab.index] } : null;
      active.onSelect(grab ? grab.index : -1);
    },
    onUpdate: event => {
      const held = drag.current;
      const { editor: active, scale: k } = latest.current;
      if (!held || !active) {
        return;
      }
      const dx = event.translationX / k;
      const dy = event.translationY / k;
      const next =
        held.part === 'body' ? moveBubble(held.start, dx, dy) : cleanBubble({ ...held.start, tail: { x: held.start.tail.x + dx, y: held.start.tail.y + dy } });
      active.onChange(held.index, next);
    },
    onFinalize: () => {
      drag.current = null;
    },
  });

  const chosen = editor ? bubbles[editor.selected] : undefined;
  return (
    <View style={{ width: side, height: side }}>
      <GuessBoard strokes={strokes} side={side} pen={editor ? undefined : pen} />
      <View pointerEvents="none" className="absolute left-px top-px" style={{ width: inner, height: inner }}>
        <Canvas style={{ width: inner, height: inner }}>
          <Group transform={[{ scale }]}>
            <Picture picture={picture} />
            {chosen ? (
              <Rect x={chosen.x - 8} y={chosen.y - 8} width={chosen.w + 16} height={chosen.h + 16} style="stroke" strokeWidth={4 / scale} color={accent} />
            ) : null}
          </Group>
        </Canvas>
      </View>
      {editor ? (
        <GestureDetector gesture={pan}>
          <View className="absolute left-px top-px" style={{ width: inner, height: inner }} />
        </GestureDetector>
      ) : null}
    </View>
  );
});
