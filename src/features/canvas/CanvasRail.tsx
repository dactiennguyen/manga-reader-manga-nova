import { CaretLeftIcon, CaretRightIcon, EyedropperIcon, RulerIcon } from '../../ui/icons';
import { useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { GUIDES, type GuideKind } from '../../core/art/guides';
import { SHAPE_TOOLS, TOOLS, isShapeId, type CanvasTool, type ShapeTool } from '../../core/art/tools';
import { t } from '../../core/i18n';
import { IconButton } from '../../ui';
import { GUIDE_ICONS, SHAPES_ICON, SHAPE_ICONS, TOOL_ICONS } from './canvasIcons';

function iconOf(tool: CanvasTool) {
  return isShapeId(tool) ? SHAPE_ICONS[tool] : TOOL_ICONS[tool];
}

export function CanvasRail({
  tool,
  shape,
  picking,
  guide,
  collapsed,
  side,
  top,
  maxHeight,
  fade,
  onTool,
  onPick,
  onGuide,
  onToggle,
  onLayout,
}: {
  tool: CanvasTool;
  shape: ShapeTool;
  picking: boolean;
  guide: GuideKind | null;
  collapsed: boolean;
  side: 'left' | 'right';
  top: number;
  maxHeight: number;
  fade: StyleProp<AnimatedStyle<ViewStyle>>;
  onTool: (tool: CanvasTool) => void;
  onPick: () => void;
  onGuide: (kind: GuideKind) => void;
  onToggle: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const shapeActive = isShapeId(tool) && !picking;
  const shapeDef = SHAPE_TOOLS.find(item => item.id === (isShapeId(tool) ? tool : shape)) ?? SHAPE_TOOLS[0];
  const current = isShapeId(tool) ? shapeDef : TOOLS.find(item => item.id === tool) ?? TOOLS[0];
  const CollapseIcon = (side === 'left') === collapsed ? CaretRightIcon : CaretLeftIcon;

  const button = (item: { id: CanvasTool; label: string }) => (
    <IconButton
      key={item.id}
      icon={iconOf(item.id)}
      active={item.id === tool && !picking}
      accessibilityLabel={t(item.label)}
      onPress={() => {
        setShapesOpen(false);
        setGuidesOpen(false);
        if (collapsed) {
          onToggle();
        } else {
          onTool(item.id);
        }
      }}
    />
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      className={`absolute items-start gap-1 ${side === 'left' ? 'left-2 flex-row' : 'right-2 flex-row-reverse'}`}
      style={[{ top }, fade]}
    >
      <View className="rounded-lg bg-raised p-1" style={{ maxHeight }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-1">
          {collapsed ? (
            button(current)
          ) : (
            <>
              {TOOLS.slice(0, 4).map(button)}
              <IconButton
                icon={isShapeId(tool) ? SHAPE_ICONS[shapeDef.id] : SHAPES_ICON}
                active={shapeActive}
                accessibilityLabel={t('Shapes, {shape}', { shape: t(shapeDef.label) })}
                onPress={() => {
                  setGuidesOpen(false);
                  if (shapeActive) {
                    setShapesOpen(open => !open);
                  } else {
                    onTool(shapeDef.id);
                  }
                }}
                onLongPress={() => {
                  onTool(shapeDef.id);
                  setShapesOpen(true);
                }}
              />
              {TOOLS.slice(4).map(button)}
              <IconButton
                icon={guide ? GUIDE_ICONS[guide] : RulerIcon}
                active={!!guide}
                accessibilityLabel={guide ? t('Rulers, {ruler}', { ruler: t(GUIDES.find(item => item.id === guide)?.label ?? '') }) : t('Rulers')}
                onPress={() => {
                  setShapesOpen(false);
                  setGuidesOpen(open => !open);
                }}
              />
              <IconButton
                icon={EyedropperIcon}
                active={picking}
                accessibilityLabel={t('Eyedropper')}
                onPress={() => {
                  setShapesOpen(false);
                  setGuidesOpen(false);
                  onPick();
                }}
              />
              <IconButton
                icon={CollapseIcon}
                color="text-muted"
                accessibilityLabel={t('Collapse toolbar')}
                onPress={() => {
                  setShapesOpen(false);
                  setGuidesOpen(false);
                  onToggle();
                }}
              />
            </>
          )}
        </ScrollView>
      </View>
      {shapesOpen && !collapsed ? (
        <View className="gap-1 rounded-lg bg-raised p-1">
          {SHAPE_TOOLS.map(item => (
            <IconButton
              key={item.id}
              icon={SHAPE_ICONS[item.id]}
              active={item.id === tool && !picking}
              accessibilityLabel={t(item.label)}
              onPress={() => {
                onTool(item.id);
                setShapesOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}
      {guidesOpen && !collapsed ? (
        <View className="gap-1 self-end rounded-lg bg-raised p-1">
          {GUIDES.map(item => (
            <IconButton
              key={item.id}
              icon={GUIDE_ICONS[item.id]}
              active={item.id === guide}
              accessibilityLabel={t(item.label)}
              onPress={() => {
                onGuide(item.id);
                setGuidesOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
