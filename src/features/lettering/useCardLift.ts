import { useEffect, useRef } from 'react';

import { cardLift, type LetteringView } from '../../core/lettering/letteringState';
import type { LetteringController } from './useLetteringController';

/**
 * Moves the page up while the bubble card would cover the selected bubble, and back on deselect.
 * It goes through the view, so touches keep mapping to the page. It waits out a drag, because the
 * card is hidden then and moving the page would pull it from under the finger.
 */
export function useCardLift(c: LetteringController, cardHeight: number): void {
  const { state, dispatch, stage } = c;
  const { box, draft } = state;
  const bubble = c.selectedBubble;
  const held = useRef<{ before: LetteringView | null; lifted: LetteringView } | null>(null);
  const dragging = !!draft;

  useEffect(() => {
    if (dragging) {
      return;
    }
    const mine = held.current;
    // A view the user set since then is theirs to keep.
    const untouched = !!mine && state.view === mine.lifted;
    const start = mine && untouched ? mine.before : state.view;
    const base = start ?? stage.fit;
    const lift = bubble && cardHeight > 0 ? cardLift(bubble, cardHeight, box, stage, base) : 0;
    if (lift > 0) {
      const lifted = { ...base, ty: base.ty - lift };
      held.current = { before: start, lifted };
      dispatch({ type: 'setView', view: lifted });
    } else {
      held.current = null;
      if (untouched) {
        dispatch({ type: 'setView', view: start });
      }
    }
    // The view is left out on purpose: panning must not re-run this and fight the finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, bubble?.id, bubble?.y, bubble?.h, bubble?.tail?.y, cardHeight, box.h]);
}
