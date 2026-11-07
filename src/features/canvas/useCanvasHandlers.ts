import { useEffect, useMemo, useRef, type RefObject } from 'react';

import { layerBounds, type LayerTransform } from '../../core/art/artMath';
import { HOLD_MS, TAP_MS, type SessionEnv } from '../../core/art/session';
import type { PanelShape } from '../../core/layout/layout';
import type { ID } from '../../core/model/types';
import { sampleArtColor } from '../../render/drawArt';
import { loadArt, redoArt, undoArt } from '../../state/artStore';
import { toast } from '../../ui';
import type { CanvasDoc } from './useCanvasDoc';
import type { CanvasEngine, EngineHandlers, JsEffect, StrokeMeta } from './useCanvasEngine';
import type { CanvasTools } from './useCanvasTools';

type Timers = { hold: ReturnType<typeof setTimeout> | null; tap: ReturnType<typeof setTimeout> | null };

/** The JS half of the gesture rules: the two timers, color sampling, history and toasts. */
export function useCanvasHandlers({
  handlers,
  engine,
  doc,
  tools,
  panelId,
  setStylusMode,
  toggleChrome,
}: {
  handlers: RefObject<EngineHandlers>;
  engine: CanvasEngine;
  doc: CanvasDoc;
  tools: CanvasTools;
  panelId: ID;
  setStylusMode: (value: boolean) => void;
  toggleChrome: () => void;
}): void {
  const timers = useRef<Timers>({ hold: null, tap: null });
  const { send } = engine;

  useEffect(() => {
    const running = timers.current;
    return () => {
      if (running.hold) {
        clearTimeout(running.hold);
      }
      if (running.tap) {
        clearTimeout(running.tap);
      }
    };
  }, []);

  const pick = (x: number, y: number): string | null => {
    const art = loadArt(panelId);
    const picked = art ? sampleArtColor(art, x, y) : null;
    tools.setPicking(false);
    if (picked) {
      tools.setColor(picked);
      toast(`Picked ${picked}`);
    }
    return picked;
  };

  const onEffect = (effect: JsEffect) => {
    const t = timers.current;
    switch (effect.kind) {
      case 'toast':
        toast(effect.message);
        break;
      case 'stylusDetected':
        setStylusMode(true);
        break;
      case 'holdStart':
        if (t.hold) {
          clearTimeout(t.hold);
        }
        t.hold = setTimeout(() => {
          t.hold = null;
          send({ type: 'hold', token: effect.token });
        }, HOLD_MS);
        break;
      case 'holdCancel':
        if (t.hold) {
          clearTimeout(t.hold);
          t.hold = null;
        }
        break;
      case 'tapTimerStart':
        t.tap = setTimeout(() => {
          t.tap = null;
          send({ type: 'tapTimeout' });
        }, TAP_MS);
        break;
      case 'tapTimerCancel':
        if (t.tap) {
          clearTimeout(t.tap);
          t.tap = null;
        }
        break;
      case 'sample': {
        const picked = pick(effect.x, effect.y);
        if (effect.reason === 'hold') {
          if (picked) {
            send({ type: 'holdPicked', token: effect.token });
          }
        } else if (!picked) {
          toast('No color here');
        }
        break;
      }
      case 'undo':
        undoArt(panelId);
        break;
      case 'redo':
        redoArt(panelId);
        break;
      case 'toggleChrome':
        toggleChrome();
        break;
    }
  };

  handlers.current = {
    onStroke: (layerId: ID, meta: StrokeMeta, points: Float32Array, seq: number) => {
      doc.commit(layerId, meta, points, seq);
      if (meta.tool !== 'eraser') {
        tools.rememberColor(meta.color);
      }
    },
    onTransform: (layerId: ID, t: LayerTransform) => doc.applyTransform(layerId, t),
    onEffect,
  };
}

/** Mirrors what the screen knows into the reducer's environment. Runs on tool and layer changes only. */
export function useCanvasEnv({
  engine,
  doc,
  tools,
  panelId,
  shape,
  pageW,
  stylusMode,
  area,
}: {
  engine: CanvasEngine;
  doc: CanvasDoc;
  tools: CanvasTools;
  panelId: ID;
  shape: PanelShape;
  pageW: number;
  stylusMode: boolean;
  area: { w: number; h: number };
}): void {
  const { env, frameBox } = engine;
  const { active } = doc;
  const { tool, size, opacity, color, activeTone, picking } = tools;
  const moving = tool === 'move';
  const bounds = useMemo(() => {
    // From the store: doc.art does not follow every stroke.
    const layer = moving && active ? loadArt(panelId)?.layers.find(item => item.id === active.id) : null;
    return layer ? layerBounds(layer) : null;
  }, [moving, active, panelId]);

  useEffect(() => {
    const next: SessionEnv = {
      tool,
      size,
      opacity,
      color,
      tone: activeTone,
      picking,
      stylusMode,
      pageW,
      area,
      bbox: shape.bbox,
      poly: shape.poly,
      layer: active ? { id: active.id, locked: active.locked, visible: active.visible, bounds } : null,
    };
    env.value = next;
  }, [active, activeTone, area, bounds, color, env, opacity, pageW, picking, shape, size, stylusMode, tool]);

  useEffect(() => {
    frameBox.value = active?.visible ? bounds : null;
  }, [active, bounds, frameBox]);
}
