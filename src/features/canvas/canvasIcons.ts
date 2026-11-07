import { BrushIcon, CircleIcon, EraserIcon, FillIcon, GPenIcon, LineIcon, MoveIcon, PencilToolIcon, RectIcon, ShapesIcon } from '../../ui/icons';

import type { CanvasTool, ShapeTool } from '../../core/art/tools';
import type { IconGlyph } from '../../ui';

export const TOOL_ICONS: Record<Exclude<CanvasTool, ShapeTool>, IconGlyph> = {
  gpen: GPenIcon,
  pencil: PencilToolIcon,
  brush: BrushIcon,
  eraser: EraserIcon,
  fill: FillIcon,
  move: MoveIcon,
};

export const SHAPE_ICONS: Record<ShapeTool, IconGlyph> = {
  line: LineIcon,
  rect: RectIcon,
  ellipse: CircleIcon,
};

export const SHAPES_ICON = ShapesIcon;
