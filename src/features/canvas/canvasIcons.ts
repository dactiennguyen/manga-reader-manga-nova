import { Brush, Circle, Eraser, Minus, Move, PaintBucket, PenLine, Pencil, Shapes, Square } from 'lucide-react-native';

import type { CanvasTool, ShapeTool } from '../../core/art/tools';
import type { LucideIcon } from '../../ui';

export const TOOL_ICONS: Record<Exclude<CanvasTool, ShapeTool>, LucideIcon> = {
  gpen: PenLine,
  pencil: Pencil,
  brush: Brush,
  eraser: Eraser,
  fill: PaintBucket,
  move: Move,
};

export const SHAPE_ICONS: Record<ShapeTool, LucideIcon> = {
  line: Minus,
  rect: Square,
  ellipse: Circle,
};

export const SHAPES_ICON = Shapes;
