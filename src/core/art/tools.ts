import { msg } from '../i18n';
import type { LayerTransform } from './artMath';
import type { ArtLayer, ID, PanelArt, Stroke, StrokeTool } from '../model/types';

export type CanvasTool = StrokeTool | 'move' | 'select';

export type ShapeTool = 'line' | 'rect' | 'ellipse';

export const TOOLS: { id: CanvasTool; label: string }[] = [
  { id: 'gpen', label: msg('G-pen') },
  { id: 'pencil', label: msg('Pencil') },
  { id: 'brush', label: msg('Brush') },
  { id: 'eraser', label: msg('Eraser') },
  { id: 'fill', label: msg('Lasso fill') },
  { id: 'select', label: msg('Select strokes') },
  { id: 'move', label: msg('Move and scale layer') },
];

export const SHAPE_TOOLS: { id: ShapeTool; label: string }[] = [
  { id: 'line', label: msg('Straight line') },
  { id: 'rect', label: msg('Rectangle') },
  { id: 'ellipse', label: msg('Ellipse') },
];

export function isShapeId(tool: CanvasTool): tool is ShapeTool {
  'worklet';
  return tool === 'line' || tool === 'rect' || tool === 'ellipse';
}

export function supportsTone(tool: CanvasTool): boolean {
  'worklet';
  return tool === 'fill' || tool === 'brush';
}

export function strokeToolOf(tool: CanvasTool): StrokeTool {
  'worklet';
  return tool === 'move' || tool === 'select' ? 'gpen' : tool;
}

export const SIZE_MIN = 2;
export const SIZE_MAX = 60;

export const DEFAULT_SIZES: Record<StrokeTool, number> = {
  gpen: 6,
  pencil: 3,
  brush: 16,
  eraser: 28,
  line: 4,
  rect: 4,
  ellipse: 4,
  fill: 4,
};
export const DEFAULT_OPACITY: Record<StrokeTool, number> = {
  gpen: 1,
  pencil: 0.75,
  brush: 1,
  eraser: 1,
  line: 1,
  rect: 1,
  ellipse: 1,
  fill: 1,
};

export const GRAYS = ['#000000', '#FFFFFF', '#333333', '#666666', '#999999', '#CCCCCC'];

export const COLORS = [
  '#E53935',
  '#F4511E',
  '#FB8C00',
  '#FDD835',
  '#C0CA33',
  '#7CB342',
  '#2E7D32',
  '#00897B',
  '#00ACC1',
  '#039BE5',
  '#1E88E5',
  '#3949AB',
  '#5E35B1',
  '#8E24AA',
  '#D81B60',
  '#F8BBD0',
  '#FFCCBC',
  '#F1C27D',
  '#8D5524',
  '#4E342E',
];

export type ViewState = { tx: number; ty: number; scale: number; rot: number; flip: boolean };

export function screenToPage(view: ViewState, pageW: number, x: number, y: number): { x: number; y: number } {
  'worklet';
  const dx = x - view.tx;
  const dy = y - view.ty;
  const cos = Math.cos(-view.rot);
  const sin = Math.sin(-view.rot);
  const px = (dx * cos - dy * sin) / view.scale;
  const py = (dx * sin + dy * cos) / view.scale;
  return { x: view.flip ? pageW - px : px, y: py };
}

export type LiveStore = {
  get: () => Stroke | null;
  set: (stroke: Stroke | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createLiveStore(): LiveStore {
  let current: Stroke | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: stroke => {
      current = stroke;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type LiveTransform = { layer: ArtLayer; t: LayerTransform };

export type TransformStore = {
  get: () => LiveTransform | null;
  set: (transform: LiveTransform | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createTransformStore(): TransformStore {
  let current: LiveTransform | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: transform => {
      current = transform;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function patchLayer(art: PanelArt, layerId: ID, patch: (layer: ArtLayer) => ArtLayer): PanelArt {
  return { ...art, layers: art.layers.map(layer => (layer.id === layerId ? patch(layer) : layer)) };
}

export function activeLayerOf(art: PanelArt): ArtLayer | undefined {
  return art.layers.find(layer => layer.id === art.activeLayerId) ?? art.layers[art.layers.length - 1];
}
