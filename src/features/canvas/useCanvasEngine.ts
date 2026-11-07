import { type SkPicture } from '@shopify/react-native-skia';
import { useCallback, useMemo, type RefObject } from 'react';
import {
  GestureStateManager,
  PointerType,
  useManualGesture,
  usePanGesture,
  useSimultaneousGestures,
  type GestureTouchEvent,
} from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { IDENTITY_TRANSFORM, type Box, type LayerTransform } from '../../core/art/artMath';
import {
  createSession,
  reduceSession,
  type Pointer,
  type SessionEffect,
  type SessionEnv,
  type SessionEvent,
  type SessionState,
} from '../../core/art/session';
import type { Guide } from '../../core/art/guides';
import type { ViewState } from '../../core/art/tools';
import type { ID, Stroke } from '../../core/model/types';
import {
  beginLiveStroke,
  emptyPicture,
  pendingFrom,
  recordLiveStroke,
  recordPending,
  type LiveStroke,
  type PendingStroke,
} from '../../render/liveStroke';

export type StrokeMeta = Omit<Stroke, 'points'>;

/** Effects the UI thread hands to JS. Everything that touches the UI thread stays in the engine. */
export type JsEffect = Exclude<
  SessionEffect,
  | { kind: 'strokeBegin' | 'strokeExtend' | 'strokeCancel' | 'strokeCommit' | 'view' | 'guide' }
  | { kind: 'transform' | 'transformCancel' | 'transformCommit' }
>;

export type EngineHandlers = {
  onStroke: (layerId: ID, meta: StrokeMeta, points: Float32Array, seq: number, mirror: number | null) => void;
  onTransform: (layerId: ID, t: LayerTransform) => void;
  onEffect: (effect: JsEffect) => void;
};

export type ScenePictures = Record<ID, SkPicture>;

export type CanvasEngine = {
  gesture: ReturnType<typeof useSimultaneousGestures>;
  env: SharedValue<SessionEnv>;
  view: SharedValue<ViewState>;
  guide: SharedValue<Guide | null>;
  xform: SharedValue<LayerTransform>;
  frameBox: SharedValue<Box | null>;
  contents: SharedValue<ScenePictures>;
  livePicture: SharedValue<SkPicture>;
  pendingPicture: SharedValue<SkPicture>;
  blank: SkPicture;
  /** Screen rects of the floating panels. A stroke entering one fades them. */
  chromeRects: SharedValue<Record<string, Box>>;
  faded: SharedValue<boolean>;
  send: (event: SessionEvent) => void;
  /** One UI-thread update, so a finished stroke never leaves the screen for a frame. */
  publish: (pictures: ScenePictures, seq: number | null, clearTransform: boolean) => void;
};

const NO_VIEW: ViewState = { tx: 0, ty: 0, scale: 1, rot: 0, flip: false };

export function useCanvasEngine(handlers: RefObject<EngineHandlers>, initialEnv: SessionEnv): CanvasEngine {
  const blank = useMemo(() => emptyPicture(), []);
  const session = useSharedValue<SessionState>(createSession(NO_VIEW));
  const env = useSharedValue<SessionEnv>(initialEnv);
  const view = useSharedValue<ViewState>(NO_VIEW);
  const guide = useSharedValue<Guide | null>(null);
  const xform = useSharedValue<LayerTransform>(IDENTITY_TRANSFORM);
  const frameBox = useSharedValue<Box | null>(null);
  const contents = useSharedValue<ScenePictures>({});
  const livePicture = useSharedValue<SkPicture>(blank);
  const pendingPicture = useSharedValue<SkPicture>(blank);
  const live = useSharedValue<LiveStroke | null>(null);
  const pending = useSharedValue<PendingStroke[]>([]);
  const seq = useSharedValue(0);
  const pressure = useSharedValue(0.5);
  const pressureSeen = useSharedValue(false);
  const chromeRects = useSharedValue<Record<string, Box>>({});
  const faded = useSharedValue(false);

  const js = useMemo(
    () => ({
      stroke: (layerId: ID, meta: StrokeMeta, points: Float32Array, id: number, mirror: number | null) =>
        handlers.current.onStroke(layerId, meta, points, id, mirror),
      transform: (layerId: ID, t: LayerTransform) => handlers.current.onTransform(layerId, t),
      effect: (effect: JsEffect) => handlers.current.onEffect(effect),
    }),
    [handlers],
  );
  const toJsStroke = js.stroke;
  const toJsTransform = js.transform;
  const toJsEffect = js.effect;

  const dispatch = useMemo(() => {
    const clearLive = () => {
      'worklet';
      live.value = null;
      livePicture.value = blank;
    };
    const commit = (stroke: Stroke, layerId: ID, mirror: number | null) => {
      'worklet';
      const id = seq.value + 1;
      seq.value = id;
      if (live.value) {
        const next = [...pending.value, pendingFrom(live.value, stroke, id, layerId)];
        pending.value = next;
        pendingPicture.value = recordPending(next);
      }
      clearLive();
      const meta: StrokeMeta = {
        tool: stroke.tool,
        color: stroke.color,
        size: stroke.size,
        opacity: stroke.opacity,
        pressure: stroke.pressure,
        tone: stroke.tone,
      };
      scheduleOnRN(toJsStroke, layerId, meta, new Float32Array(stroke.points), id, mirror);
    };
    return (event: SessionEvent) => {
      'worklet';
      const out = reduceSession(session.value, event, env.value);
      session.value = out.state;
      for (let i = 0; i < out.effects.length; i++) {
        const effect = out.effects[i];
        switch (effect.kind) {
          case 'strokeBegin':
            live.value = beginLiveStroke(out.state.stroke as Stroke);
            livePicture.value = recordLiveStroke(live.value, out.state.stroke as Stroke);
            break;
          case 'strokeExtend':
            if (live.value && out.state.stroke) {
              livePicture.value = recordLiveStroke(live.value, out.state.stroke);
            }
            break;
          case 'strokeCancel':
            clearLive();
            break;
          case 'strokeCommit':
            commit(effect.stroke, effect.layerId, effect.mirror);
            break;
          case 'view':
            view.value = out.state.view;
            break;
          case 'guide':
            guide.value = out.state.guide;
            break;
          case 'transform':
            xform.value = effect.t;
            break;
          case 'transformCancel':
            xform.value = IDENTITY_TRANSFORM;
            break;
          case 'transformCommit':
            scheduleOnRN(toJsTransform, effect.layerId, effect.t);
            break;
          default:
            scheduleOnRN(toJsEffect, effect);
        }
      }
    };
  }, [
    blank,
    env,
    guide,
    live,
    livePicture,
    pending,
    pendingPicture,
    seq,
    session,
    toJsEffect,
    toJsStroke,
    toJsTransform,
    view,
    xform,
  ]);

  const manualConfig = useMemo(() => {
    const pointerOf = (type: PointerType): Pointer => {
      'worklet';
      return type === PointerType.STYLUS ? 'stylus' : type === PointerType.TOUCH ? 'touch' : 'other';
    };
    const fadeOver = (x: number, y: number) => {
      'worklet';
      const rects = chromeRects.value;
      let hit = false;
      for (const key in rects) {
        const r = rects[key];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          hit = true;
        }
      }
      if (hit !== faded.value) {
        faded.value = hit;
      }
    };
    return {
      onTouchesDown: (e: GestureTouchEvent) => {
        'worklet';
        GestureStateManager.activate(e.handlerTag);
        dispatch({
          type: 'down',
          all: e.allTouches,
          changed: e.changedTouches,
          pointer: pointerOf(e.pointerType),
          pressure: pressureSeen.value ? pressure.value : 0.5,
          time: Date.now(),
        });
      },
      onTouchesMove: (e: GestureTouchEvent) => {
        'worklet';
        dispatch({ type: 'move', all: e.allTouches, pressure: pressure.value });
        if (session.value.mode === 'draw' && e.allTouches.length) {
          fadeOver(e.allTouches[0].x, e.allTouches[0].y);
        } else if (faded.value) {
          faded.value = false;
        }
      },
      onTouchesUp: (e: GestureTouchEvent) => {
        'worklet';
        dispatch({ type: 'up', changed: e.changedTouches, time: Date.now() });
        if (session.value.ids.length === 0) {
          faded.value = false;
          GestureStateManager.deactivate(e.handlerTag);
        }
      },
      onTouchesCancel: (e: GestureTouchEvent) => {
        'worklet';
        dispatch({ type: 'cancel' });
        faded.value = false;
        GestureStateManager.fail(e.handlerTag);
      },
    };
  }, [chromeRects, dispatch, faded, pressure, pressureSeen, session]);

  const panConfig = useMemo(() => {
    const read = (e: { stylusData?: { pressure: number } }) => {
      'worklet';
      const value = e.stylusData?.pressure;
      if (typeof value === 'number' && value > 0) {
        pressure.value = value;
        pressureSeen.value = true;
      }
    };
    return { minDistance: 0, maxPointers: 1, onBegin: read, onActivate: read, onUpdate: read };
  }, [pressure, pressureSeen]);

  const manual = useManualGesture(manualConfig);
  const stylus = usePanGesture(panConfig);
  const gesture = useSimultaneousGestures(manual, stylus);

  const send = useCallback((event: SessionEvent) => scheduleOnUI(dispatch, event), [dispatch]);

  const applyScene = useMemo(
    () => (pictures: ScenePictures, ack: number | null, clearTransform: boolean) => {
      'worklet';
      contents.value = pictures;
      if (clearTransform) {
        xform.value = IDENTITY_TRANSFORM;
      }
      if (ack !== null) {
        const rest = pending.value.filter(item => item.seq > ack);
        pending.value = rest;
        pendingPicture.value = rest.length ? recordPending(rest) : blank;
      }
    },
    [blank, contents, pending, pendingPicture, xform],
  );

  const publish = useCallback(
    (pictures: ScenePictures, ack: number | null, clearTransform: boolean) =>
      scheduleOnUI(applyScene, pictures, ack, clearTransform),
    [applyScene],
  );

  return {
    gesture,
    env,
    view,
    guide,
    xform,
    frameBox,
    contents,
    livePicture,
    pendingPicture,
    blank,
    chromeRects,
    faded,
    send,
    publish,
  };
}
