import { Circle, DashPathEffect, Group, Line, Picture, Rect, Skia, vec, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { Pt, Rect as Box, Size } from '../../core/layout/layout';
import { localCorners, rotateHandle, type Guide } from '../../core/lettering/bubbleDrag';
import { bubbleCenter } from '../../core/lettering/bubbles';
import type { Bubble } from '../../core/model/types';
import { drawBubble } from '../../render/drawBubble';
import { PAPER } from '../../render/ink';

function Frame({ bubble, color, k, dashed }: { bubble: Bubble; color: string; k: number; dashed?: boolean }) {
  return (
    <Group transform={[{ rotate: (bubble.rotation * Math.PI) / 180 }]} origin={bubbleCenter(bubble)}>
      <Rect
        x={bubble.x}
        y={bubble.y}
        width={bubble.w}
        height={bubble.h}
        style="stroke"
        strokeWidth={(dashed ? 1.5 : 2.5) / k}
        color={color}
      >
        {dashed && <DashPathEffect intervals={[6 / k, 4 / k]} />}
      </Rect>
    </Group>
  );
}

/**
 * Renders inside the Skia Canvas of PageView, which is its own React root: context does not reach it,
 * so colours come in as props. Sizes are divided by k to stay the same on screen at any zoom.
 */
export function Overlay({
  scale,
  k,
  size,
  fonts,
  lang,
  selected,
  floating,
  guides,
  warned,
  orphans,
  effectBox,
  effectCenter,
  accent,
  warning,
  danger,
}: {
  scale: number;
  k: number;
  size: Size;
  fonts: SkTypefaceFontProvider | null;
  lang?: string | null;
  selected: Bubble | null;
  floating: boolean;
  guides: Guide[];
  warned: Bubble[];
  orphans: Bubble[];
  effectBox: Box | null;
  effectCenter: Pt | null;
  accent: string;
  warning: string;
  danger: string;
}) {
  const picture = useMemo(() => {
    if (!selected || !floating) {
      return null;
    }
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size.w, size.h));
    drawBubble(canvas, selected, fonts, lang);
    return recorder.finishRecordingAsPicture();
  }, [selected, floating, fonts, lang, size.w, size.h]);

  const r = 7 / k;
  const center = selected ? bubbleCenter(selected) : null;
  const knob = selected ? rotateHandle(selected, k) : null;
  const corners = selected ? localCorners(selected) : [];

  return (
    <Group transform={[{ scale }]}>
      {picture && <Picture picture={picture} />}
      {warned.map(bubble => (
        <Frame key={`w${bubble.id}`} bubble={bubble} color={warning} k={k} />
      ))}
      {orphans.map(bubble => (
        <Frame key={`o${bubble.id}`} bubble={bubble} color={danger} k={k} />
      ))}
      {guides.map(guide => (
        <Line
          key={`${guide.axis}${guide.at}`}
          p1={guide.axis === 'x' ? vec(guide.at, 0) : vec(0, guide.at)}
          p2={guide.axis === 'x' ? vec(guide.at, size.h) : vec(size.w, guide.at)}
          color={accent}
          strokeWidth={1.5 / k}
        />
      ))}
      {effectBox && (
        <Rect
          x={effectBox.x}
          y={effectBox.y}
          width={effectBox.w}
          height={effectBox.h}
          style="stroke"
          strokeWidth={2.5 / k}
          color={accent}
        >
          <DashPathEffect intervals={[8 / k, 5 / k]} />
        </Rect>
      )}
      {effectCenter && (
        <>
          <Circle cx={effectCenter.x} cy={effectCenter.y} r={11 / k} color={PAPER} />
          <Circle cx={effectCenter.x} cy={effectCenter.y} r={8 / k} color={accent} />
        </>
      )}
      {selected && center && knob && (
        <>
          <Frame bubble={selected} color={accent} k={k} dashed />
          <Group transform={[{ rotate: (selected.rotation * Math.PI) / 180 }]} origin={center}>
            <Line p1={vec(knob.x, selected.y)} p2={vec(knob.x, knob.y)} color={accent} strokeWidth={1.5 / k} />
            <Circle cx={knob.x} cy={knob.y} r={r} color={accent} />
            <Circle cx={knob.x} cy={knob.y} r={r * 0.45} color={PAPER} />
            {corners.map((p, index) => (
              <Group key={index}>
                <Circle cx={p.x} cy={p.y} r={r} color={accent} />
                <Circle cx={p.x} cy={p.y} r={r * 0.6} color={PAPER} />
              </Group>
            ))}
          </Group>
          {selected.tail && (
            <>
              <Circle cx={selected.tail.x} cy={selected.tail.y} r={r * 1.1} color={PAPER} />
              <Circle cx={selected.tail.x} cy={selected.tail.y} r={r * 0.75} color={accent} />
            </>
          )}
        </>
      )}
    </Group>
  );
}
