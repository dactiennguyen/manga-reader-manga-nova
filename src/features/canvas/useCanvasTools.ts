import { useCallback, useMemo, useState } from 'react';

import { isBrushBase, type BrushBase, type BrushPreset } from '../../core/art/brushes';
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
  SIZE_MAX,
  SIZE_MIN,
  isShapeId,
  strokeToolOf,
  supportsTone,
  type CanvasTool,
  type ShapeTool,
} from '../../core/art/tools';
import { activeBrush, chooseBrush as choosePresetBrush, findBrush, useArtPresets } from '../../state/useArtPresets';
import { useSettings } from '../../state/useSettings';

export type CanvasTools = {
  tool: CanvasTool;
  shapeTool: ShapeTool;
  size: number;
  opacity: number;
  color: string;
  /** The chosen tone: null for solid, a legacy density id or a tone preset id (see toneForChoice). */
  tone: string | null;
  /** Null when the current tool cannot paint tone. */
  activeTone: string | null;
  /** The custom brush the current tool draws with, if any. */
  brush: BrushPreset | undefined;
  /** The size slider's range: the brush's own, or the app's. */
  sizeRange: { min: number; max: number };
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
  setTone: (tone: string | null) => void;
  /** Draws with a brush preset, switching to its tool. Null with a tool goes back to that tool's own. */
  chooseBrush: (id: string | null, base: BrushBase) => void;
  setPicking: (next: boolean | ((value: boolean) => boolean)) => void;
  rememberColor: (color: string) => void;
  /** Adds the current colour to the saved palette. */
  saveColor: () => SaveColorResult;
  removeSaved: (color: string) => void;
};

export function useCanvasTools(hadArt: boolean, colored: boolean): CanvasTools {
  const [tool, setTool] = useState<CanvasTool>(hadArt ? 'gpen' : 'pencil');
  const [shapeTool, setShapeTool] = useState<ShapeTool>('line');
  const [tone, setTone] = useState<string | null>(null);
  const presets = useArtPresets();
  // A tool that remembers a brush starts at that brush's size.
  const [sizes, setSizes] = useState(() => {
    const out = { ...DEFAULT_SIZES };
    (['gpen', 'pencil', 'brush'] as const).forEach(base => {
      const preset = activeBrush(useArtPresets.getState(), base);
      if (preset) {
        out[base] = preset.size;
      }
    });
    return out;
  });
  const [opacities, setOpacities] = useState(() => {
    const out = { ...DEFAULT_OPACITY };
    (['gpen', 'pencil', 'brush'] as const).forEach(base => {
      const preset = activeBrush(useArtPresets.getState(), base);
      if (preset) {
        out[base] = preset.opacity;
      }
    });
    return out;
  });
  const [color, setColor] = useState(GRAYS[0]);
  const recentColors = useSettings(s => s.recentColors);
  const savedColors = useSettings(s => s.savedColors);
  const [picking, setPicking] = useState(false);
  const strokeTool = strokeToolOf(tool);
  const brush = isBrushBase(tool) ? activeBrush(presets, tool) : undefined;
  const sizeRange = useMemo(
    () => (brush ? { min: brush.sizeMin, max: brush.sizeMax } : { min: SIZE_MIN, max: SIZE_MAX }),
    [brush],
  );
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

  // A brush can go below 2, so it moves in half steps; the tools' own sizes stay whole numbers.
  const halfSteps = !!brush;
  const setSize = useCallback(
    (value: number) =>
      setSizes(prev => ({ ...prev, [strokeTool]: halfSteps ? Math.round(value * 2) / 2 : Math.round(value) })),
    [halfSteps, strokeTool],
  );

  const chooseBrush = useCallback(
    (id: string | null, base: BrushBase) => {
      const store = useArtPresets.getState();
      const preset = id ? findBrush(store, id) : undefined;
      store.update(current => choosePresetBrush(current, base, preset ? preset.id : null));
      if (preset) {
        setSizes(prev => ({ ...prev, [base]: preset.size }));
        setOpacities(prev => ({ ...prev, [base]: preset.opacity }));
      }
      chooseTool(base);
    },
    [chooseTool],
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
    size: Math.max(sizeRange.min, Math.min(sizeRange.max, sizes[strokeTool])),
    opacity: opacities[strokeTool],
    color,
    tone,
    activeTone: supportsTone(tool) ? tone : null,
    brush,
    sizeRange,
    picking,
    recent,
    saved,
    palette,
    chooseTool,
    setSize,
    setOpacity,
    setColor,
    setTone,
    chooseBrush,
    setPicking,
    rememberColor,
    saveColor,
    removeSaved,
  };
}
