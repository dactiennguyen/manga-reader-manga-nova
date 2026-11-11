import { useCallback, useMemo, useState } from 'react';

import {
  addRecentColor,
  addSavedColor,
  cleanColors,
  colorsFor,
  removeSavedColor,
  RECENT_COLORS_MAX,
  SAVED_COLORS_MAX,
  type SaveColorResult,
} from '../../core/art/palette';
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
import { useSettings } from '../../state/useSettings';

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
  /** The last colours drawn with, newest first. A black and white story only sees its grays. */
  recent: string[];
  /** The person's own palette, under the same rule. */
  saved: string[];
  palette: string[];
  chooseTool: (tool: CanvasTool) => void;
  setSize: (value: number) => void;
  setOpacity: (value: number) => void;
  setColor: (color: string) => void;
  setTone: (tone: number | null) => void;
  setPicking: (next: boolean | ((value: boolean) => boolean)) => void;
  rememberColor: (color: string) => void;
  /** Adds the current colour to the saved palette. */
  saveColor: () => SaveColorResult;
  removeSaved: (color: string) => void;
};

export function useCanvasTools(hadArt: boolean, colored: boolean): CanvasTools {
  const [tool, setTool] = useState<CanvasTool>(hadArt ? 'gpen' : 'pencil');
  const [shapeTool, setShapeTool] = useState<ShapeTool>('line');
  const [tone, setTone] = useState<number | null>(null);
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [opacities, setOpacities] = useState(DEFAULT_OPACITY);
  const [color, setColor] = useState(GRAYS[0]);
  const recentColors = useSettings(s => s.recentColors);
  const savedColors = useSettings(s => s.savedColors);
  const [picking, setPicking] = useState(false);
  const strokeTool = strokeToolOf(tool);
  const palette = useMemo(() => (colored ? [...GRAYS, ...COLORS] : GRAYS), [colored]);
  const recent = useMemo(() => colorsFor(cleanColors(recentColors, RECENT_COLORS_MAX), colored), [colored, recentColors]);
  const saved = useMemo(() => colorsFor(cleanColors(savedColors, SAVED_COLORS_MAX), colored), [colored, savedColors]);

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

  const rememberColor = useCallback((used: string) => {
    const settings = useSettings.getState();
    const list = cleanColors(settings.recentColors, RECENT_COLORS_MAX);
    const next = addRecentColor(list, used);
    // Most strokes reuse the last colour, and those must not write settings to disk.
    if (next !== list) {
      settings.set({ recentColors: next });
    }
  }, []);

  const saveColor = useCallback((): SaveColorResult => {
    const settings = useSettings.getState();
    const out = addSavedColor(cleanColors(settings.savedColors, SAVED_COLORS_MAX), color);
    if (out.result === 'added') {
      settings.set({ savedColors: out.list });
    }
    return out.result;
  }, [color]);

  const removeSaved = useCallback((gone: string) => {
    const settings = useSettings.getState();
    const list = cleanColors(settings.savedColors, SAVED_COLORS_MAX);
    const next = removeSavedColor(list, gone);
    if (next !== list) {
      settings.set({ savedColors: next });
    }
  }, []);

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
    saved,
    palette,
    chooseTool,
    setSize,
    setOpacity,
    setColor,
    setTone,
    setPicking,
    rememberColor,
    saveColor,
    removeSaved,
  };
}
