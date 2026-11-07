import type { Effect, EffectType } from '../model/types';
import { uid } from '../util/id';

export function createEffect(type: EffectType, panelId: string): Effect {
  return {
    id: uid(),
    panelId,
    type,
    density: 0.5,
    angle: type === 'gradient' ? 90 : 0,
    cx: 0.5,
    cy: 0.5,
    opacity: type === 'tone' || type === 'gradient' ? 0.5 : 1,
  };
}
