import { BrushIcon, CircleIcon, EraserIcon, FillIcon, GPenIcon, LassoIcon, LineIcon, MoveIcon, PencilToolIcon, PerspectiveIcon, RectIcon, ShapesIcon, SymmetryIcon, TwoPointIcon } from '../../ui/icons';

import type { GuideKind } from '../../core/art/guides';
import type { CanvasTool, ShapeTool } from '../../core/art/tools';
import type { IconGlyph } from '../../ui';

export const TOOL_ICONS: Record<Exclude<CanvasTool, ShapeTool>, IconGlyph> = {
  gpen: GPenIcon,
  pencil: PencilToolIcon,
  brush: BrushIcon,
  eraser: EraserIcon,
  fill: FillIcon,
  select: LassoIcon,
  move: MoveIcon,
};

export const SHAPE_ICONS: Record<ShapeTool, IconGlyph> = {
  line: LineIcon,
  rect: RectIcon,
  ellipse: CircleIcon,
};

export const SHAPES_ICON = ShapesIcon;

export const GUIDE_ICONS: Record<GuideKind, IconGlyph> = {
  symmetry: SymmetryIcon,
  onePoint: PerspectiveIcon,
  twoPoint: TwoPointIcon,
};
