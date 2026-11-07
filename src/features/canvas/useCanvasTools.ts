import { useCallback, useMemo, useState } from 'react';

import {
  COLORS,
  DEFAULT_OPACITY,
  DEFAULT_SIZES,
  GRAYS,
  isShapeId,
  strokeToolOf,
  supportsTone,
  type CanvasTool,
  type ShapeTool,
} from '../../core/art/tools';

export type CanvasTools = {
  tool: CanvasTool;
  shapeTool: ShapeTool;
  size: number;
  opacity: number;
  color: string;
  tone: number | null;
  /** Null when the current tool cannot paint tone. */
  activeTone: number | null;
  picking: boolean;
  recent: string[];
  palette: string[];
  chooseTool: (tool: CanvasTool) => void;
  setSize: (value: number) => void;
  setOpacity: (value: number) => void;
  setColor: (color: string) => void;
  setTone: (tone: number | null) => void;
  setPicking: (next: boolean | ((value: boolean) => boolean)) => void;
  rememberColor: (color: string) => void;
};

export function useCanvasTools(hadArt: boolean, colored: boolean): CanvasTools {
  const [tool, setTool] = useState<CanvasTool>(hadArt ? 'gpen' : 'pencil');
  const [shapeTool, setShapeTool] = useState<ShapeTool>('line');
  const [tone, setTone] = useState<number | null>(null);
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [opacities, setOpacities] = useState(DEFAULT_OPACITY);
  const [color, setColor] = useState(GRAYS[0]);
  const [recent, setRecent] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const strokeTool = strokeToolOf(tool);
  const palette = useMemo(() => (colored ? [...GRAYS, ...COLORS] : GRAYS), [colored]);

  const chooseTool = useCallback((next: CanvasTool) => {
    setTool(next);
    if (isShapeId(next)) {
      setShapeTool(next);
    }
    setPicking(false);
  }, []);

  const setSize = useCallback(
    (value: number) => setSizes(prev => ({ ...prev, [strokeTool]: Math.round(value) })),
    [strokeTool],
  );

  const setOpacity = useCallback(
    (value: number) => setOpacities(prev => ({ ...prev, [strokeTool]: Math.round(value * 100) / 100 })),
    [strokeTool],
  );

  const rememberColor = useCallback(
    (used: string) =>
      setRecent(list => (list[0] === used ? list : [used, ...list.filter(item => item !== used)].slice(0, 6))),
    [],
  );

  return {
    tool,
    shapeTool,
    size: sizes[strokeTool],
    opacity: opacities[strokeTool],
    color,
    tone,
    activeTone: supportsTone(tool) ? tone : null,
    picking,
    recent,
    palette,
    chooseTool,
    setSize,
    setOpacity,
    setColor,
    setTone,
    setPicking,
    rememberColor,
  };
}
