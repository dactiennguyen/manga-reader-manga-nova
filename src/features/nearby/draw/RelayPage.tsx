/**
 * A relay page on screen: the chosen layout with each finished panel's picture in place. While the relay
 * runs, pictures stay hidden and only the panel being drawn is marked, so the reveal is a surprise.
 */
import { Canvas, Group, Image as SkiaImage, Path, Rect, Skia, type SkImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import { pageSize, templatePreview, type LayoutTemplate } from '../../../core/layout/layout';
import { polyPath, PANEL_BORDER } from '../../../render/drawPage';
import { INK, PAPER } from '../../../render/ink';
import { useColor } from '../../../ui';

/** Every relay page is a B5 manga page, read right to left, on every phone. */
export const RELAY_PAGE = pageSize({ format: 'manga', pageSize: 'B5' });

function decode(base64: string): SkImage | null {
  try {
    return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
  } catch {
    return null;
  }
}

export function RelayPage({
  template,
  width,
  pictures,
  current,
}: {
  template: LayoutTemplate;
  width: number;
  /** Base64 JPEG by panel index; missing panels stay blank. */
  pictures: Record<number, string>;
  /** The panel being drawn now, marked in the accent ink. */
  current?: number | null;
}) {
  const accent = useColor('accent');
  const height = (width * RELAY_PAGE.h) / RELAY_PAGE.w;
  const shapes = useMemo(() => templatePreview(template, { w: width, h: height }, true), [template, width, height]);
  const images = useMemo(() => {
    const out: Record<number, SkImage | null> = {};
    Object.entries(pictures).forEach(([index, base64]) => {
      out[Number(index)] = decode(base64);
    });
    return out;
  }, [pictures]);
  const border = (PANEL_BORDER * width) / RELAY_PAGE.w;
  return (
    <View style={{ width, height }}>
      <Canvas style={{ width, height }}>
        <Rect x={0} y={0} width={width} height={height} color={PAPER} />
        {shapes.map(shape => {
          const path = polyPath(shape.poly);
          const image = images[shape.index];
          const { x, y, w, h } = shape.bbox;
          return (
            <Group key={shape.id}>
              {image ? (
                <Group clip={path}>
                  <SkiaImage image={image} x={x} y={y} width={w} height={h} fit="fill" />
                </Group>
              ) : null}
              <Path
                path={path}
                style="stroke"
                strokeWidth={shape.index === current ? border * 2.5 : border}
                color={shape.index === current ? accent : INK}
              />
            </Group>
          );
        })}
      </Canvas>
    </View>
  );
}
