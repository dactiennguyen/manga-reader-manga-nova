import { useRef } from 'react';

import { t } from '../../core/i18n';
import { hitTestPanel, type Pt } from '../../core/layout/layout';
import { insidePage } from '../../core/layout/pageView';
import {
  bubbleAt,
  clampToBox,
  moveBubble,
  pickDrag,
  resizeBubble,
  rotateBubble,
  settleTail,
  snapTargets,
  type DragPick,
  type SnapTargets,
} from '../../core/lettering/bubbleDrag';
import { createBubble } from '../../core/lettering/bubbles';
import { createEffect } from '../../core/lettering/effects';
import { nextTap, pinchView, stageToPage, type LetteringView, type PinchStart, type TapMark } from '../../core/lettering/letteringState';
import type { Bubble } from '../../core/model/types';
import { haptic, toast } from '../../ui';
import type { LetteringGestureHandlers } from './LetteringGestures';
import type { LetteringController } from './useLetteringController';

type Drag = DragPick & {
  p0: Pt;
  view0: LetteringView;
  targets: SnapTargets | null;
  live: Bubble | null;
  center: Pt | null;
  snapped: boolean;
};

/** What each touch means. Holds the drag in a ref: gesture events arrive faster than React renders. */
export function useLetteringTouch(c: LetteringController): LetteringGestureHandlers {
  const { state, dispatch, stage, view, k, page, ctx } = c;
  const { box, pending, hideBubbles } = state;
  const drag = useRef<Drag | null>(null);
  const pinch = useRef<PinchStart | null>(null);
  const lastTap = useRef<TapMark>({ time: 0, id: null });

  const toPage = (x: number, y: number) => stageToPage(x, y, box, stage, view);
  const visibleBubbles = hideBubbles ? [] : page.bubbles;

  const finishDrag = (success: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (d && success && d.mode === 'center' && d.center && c.selectedEffect && c.effectShape) {
      const bb = c.effectShape.bbox;
      c.changeEffect(c.selectedEffect.id, { cx: (d.center.x - bb.x) / bb.w, cy: (d.center.y - bb.y) / bb.h });
    }
    if (d && success && d.live) {
      c.replaceBubble(d.mode === 'tail' ? settleTail(d.live) : d.live);
    }
    dispatch({ type: 'dragEnd' });
  };

  const placePending = (p: Pt) => {
    if (pending?.kind === 'bubble') {
      if (insidePage(p, ctx.size)) {
        const created = createBubble(pending.type, p);
        c.addBubbles([created]);
        dispatch({ type: 'placedBubble', id: created.id });
      }
    } else if (pending?.kind === 'effect') {
      const panelId = hitTestPanel(ctx.shapes, p);
      if (!panelId) {
        toast(t('Tap inside a panel to apply the effect'));
        return;
      }
      const created = createEffect(pending.type, panelId);
      c.addEffect(created);
      dispatch({ type: 'placedEffect', id: created.id });
    }
  };

  return {
    begin: (x, y) => {
      const p = toPage(x, y);
      const pick = pickDrag({
        p,
        k,
        selected: hideBubbles ? null : c.stored,
        effectCenter: c.effectCenter,
        grabbable: pending ? [] : visibleBubbles,
      });
      const targets = pick.mode === 'move' && pick.start ? snapTargets(page.bubbles, pick.start.id, ctx.shapes) : null;
      drag.current = { ...pick, p0: p, view0: view, targets, live: null, center: null, snapped: false };
    },
    start: () => {
      const d = drag.current;
      if (d?.mode === 'move' && d.start && d.start.id !== c.stored?.id) {
        dispatch({ type: 'select', selection: { kind: 'bubble', id: d.start.id } });
      }
    },
    move: (translationX, translationY) => {
      const d = drag.current;
      if (!d) {
        return;
      }
      if (d.mode === 'view') {
        dispatch({
          type: 'setView',
          view: { z: d.view0.z, tx: d.view0.tx + translationX, ty: d.view0.ty + translationY },
        });
        return;
      }
      const dx = translationX / k;
      const dy = translationY / k;
      const p = { x: d.p0.x + dx, y: d.p0.y + dy };
      if (d.mode === 'center') {
        if (c.effectShape) {
          d.center = clampToBox(p, c.effectShape.bbox);
          dispatch({ type: 'dragCenter', center: d.center });
        }
        return;
      }
      if (!d.start) {
        return;
      }
      if (d.mode === 'move' && d.targets) {
        const { bubble, guides } = moveBubble(d.start, dx, dy, k, d.targets);
        if (guides.length > 0 && !d.snapped) {
          haptic();
        }
        d.snapped = guides.length > 0;
        d.live = bubble;
        dispatch({ type: 'dragBubble', draft: bubble, guides });
        return;
      }
      if (d.mode === 'resize') {
        d.live = resizeBubble(d.start, d.corner, p);
      } else if (d.mode === 'rotate') {
        d.live = rotateBubble(d.start, p);
      } else {
        d.live = { ...d.start, tail: p };
      }
      dispatch({ type: 'dragBubble', draft: d.live, guides: [] });
    },
    end: finishDrag,
    tap: (x, y) => {
      const p = toPage(x, y);
      if (pending) {
        placePending(p);
        return;
      }
      const hit = bubbleAt(visibleBubbles, p, k);
      const { double, mark } = nextTap(lastTap.current, Date.now(), hit?.id ?? null);
      lastTap.current = mark;
      if (hit && double) {
        dispatch({ type: 'openEditor', id: hit.id });
      } else if (hit) {
        dispatch({ type: 'select', selection: { kind: 'bubble', id: hit.id } });
      } else if (double) {
        dispatch({ type: 'setView', view: null });
      } else {
        dispatch({ type: 'select', selection: null });
      }
    },
    hold: (x, y) => {
      const hit = bubbleAt(visibleBubbles, toPage(x, y), k);
      if (hit) {
        dispatch({ type: 'openItem', id: hit.id });
      }
    },
    pinchStart: (fx, fy) => {
      pinch.current = { view0: view, fx, fy };
    },
    pinchMove: (factor, fx, fy) => {
      if (pinch.current) {
        dispatch({ type: 'setView', view: pinchView(pinch.current, factor, fx, fy, box) });
      }
    },
  };
}
