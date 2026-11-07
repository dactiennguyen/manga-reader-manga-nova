import { Canvas, Fill, Group, Path, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue } from 'react-native-reanimated';

import { transformBox } from '../../core/art/artMath';
import type { PanelShape } from '../../core/layout/layout';
import type { ArtLayer, ID } from '../../core/model/types';
import { PANEL_BORDER, polyPath, recordPage, type PageContext } from '../../render/drawPage';
import { useEngineFonts } from '../../render/fonts';
import { useImageCacheRev } from '../../render/images';
import { INK } from '../../render/ink';
import { recordGuideHandles, recordGuideLines, recordTransformFrame } from '../../render/liveStroke';
import { useColor } from '../../ui';
import type { CanvasEngine } from './useCanvasEngine';

const GRID_STEP = 50;

type LayerNodeProps = {
  id: ID;
  opacity: number;
  active: boolean;
  mirrored: boolean;
  engine: CanvasEngine;
};

const LayerNode = memo(function LayerNodeInner({ id, opacity, active, mirrored, engine }: LayerNodeProps) {
  const { contents, blank, xform, pendingPicture, livePicture, guide } = engine;
  const picture = useDerivedValue<SkPicture>(() => contents.value[id] ?? blank);
  const transform = useDerivedValue(() => {
    const t = xform.value;
    return active ? [{ translateX: t.tx }, { translateY: t.ty }, { scale: t.s }] : [];
  });
  const mirror = useDerivedValue(() => {
    const g = guide.value;
    return [{ translateX: g?.kind === 'symmetry' ? g.x * 2 : 0 }, { scaleX: -1 }];
  });
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setAlphaf(opacity);
    return p;
  }, [opacity]);
  return (
    <Group layer={paint}>
      <Group transform={transform}>
        <Picture picture={picture} />
      </Group>
      {active ? <Picture picture={pendingPicture} /> : null}
      {active ? <Picture picture={livePicture} /> : null}
      {active && mirrored ? (
        <Group transform={mirror}>
          <Picture picture={pendingPicture} />
          <Picture picture={livePicture} />
        </Group>
      ) : null}
    </Group>
  );
});

export function CanvasStage({
  ctx,
  shape,
  panelId,
  layers,
  activeId,
  opacityPreview,
  grid,
  mirrored,
  engine,
  onLayout,
}: {
  ctx: PageContext;
  shape: PanelShape;
  panelId: ID;
  layers: ArtLayer[];
  activeId: ID | undefined;
  opacityPreview: { id: ID; value: number } | null;
  grid: boolean;
  mirrored: boolean;
  engine: CanvasEngine;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { view, xform, frameBox, blank, gesture, guide } = engine;
  const fonts = useEngineFonts();
  const imageRev = useImageCacheRev();
  const workspace = useColor('bg');
  const accent = useColor('accent');
  const pageW = ctx.size.w;
  const panel = ctx.page.panels[panelId];

  const background = useMemo(
    () => recordPage(ctx, fonts, { skipArtPanelId: panelId, dimExceptPanelId: panelId, bubbles: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, fonts, panelId, imageRev],
  );
  const clip = useMemo(() => polyPath(shape.poly), [shape]);
  const gridPath = useMemo(() => {
    const { x, y, w, h } = shape.bbox;
    const builder = Skia.PathBuilder.Make();
    for (let gx = x + GRID_STEP; gx < x + w; gx += GRID_STEP) {
      builder.moveTo(gx, y).lineTo(gx, y + h);
    }
    for (let gy = y + GRID_STEP; gy < y + h; gy += GRID_STEP) {
      builder.moveTo(x, gy).lineTo(x + w, gy);
    }
    return builder.build();
  }, [shape]);

  const transform = useDerivedValue(() => {
    const v = view.value;
    return [
      { translateX: v.tx },
      { translateY: v.ty },
      { rotate: v.rot },
      { scale: v.scale },
      { translateX: v.flip ? pageW : 0 },
      { scaleX: v.flip ? -1 : 1 },
    ];
  });
  const frame = useDerivedValue<SkPicture>(() => {
    const box = frameBox.value;
    if (!box) {
      return blank;
    }
    return recordTransformFrame(transformBox(box, xform.value), 1 / Math.max(0.0001, view.value.scale), accent);
  });

  const bbox = shape.bbox;
  const unit = useDerivedValue(() => 1 / Math.max(0.0001, view.value.scale));
  const guideLines = useDerivedValue<SkPicture>(() =>
    guide.value ? recordGuideLines(guide.value, bbox, unit.value, accent) : blank,
  );
  const guideDots = useDerivedValue<SkPicture>(() =>
    guide.value ? recordGuideHandles(guide.value, bbox, unit.value, accent) : blank,
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} collapsable={false} onLayout={onLayout}>
        <Canvas opaque style={StyleSheet.absoluteFill}>
          <Fill color={workspace} />
          <Group transform={transform}>
            <Picture picture={background} />
            <Group clip={clip}>
              {layers.map(layer =>
                layer.visible ? (
                  <LayerNode
                    key={layer.id}
                    id={layer.id}
                    opacity={opacityPreview?.id === layer.id ? opacityPreview.value : layer.opacity}
                    active={layer.id === activeId}
                    mirrored={mirrored}
                    engine={engine}
                  />
                ) : null,
              )}
              {grid ? <Path path={gridPath} style="stroke" strokeWidth={1} color={accent} opacity={0.4} /> : null}
              <Picture picture={guideLines} />
            </Group>
            {panel?.borderless ? null : (
              <Path path={clip} style="stroke" strokeWidth={PANEL_BORDER} strokeJoin="miter" color={INK} />
            )}
            <Picture picture={frame} />
            <Picture picture={guideDots} />
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}
