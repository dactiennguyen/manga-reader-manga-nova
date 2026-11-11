/**
 * Relay: one page, one panel per turn. Whoever's turn it is sees only the panel drawn just before, so
 * the page is a surprise until the reveal. The host picks a layout and the order, and drives the turns;
 * every phone follows the same messages through `reduceRelay`.
 */
import { TEMPLATES, type LayoutTemplate } from '../layout/layout';
import type { MemberId, Message } from './types';

export const RELAY_SECONDS = [60, 120, 180] as const;
export const DEFAULT_RELAY_SECONDS = 120;
/** After a deadline the host waits this long for the picture before moving on without it. */
export const RELAY_GRACE_MS = 10000;
/** Relay pages are manga pages with two to seven panels: one panel would be no relay at all. */
export const RELAY_TEMPLATES: LayoutTemplate[] = TEMPLATES.filter(item => item.kind !== 'strip' && item.count >= 2);

export type RelaySetup = { templateId: string; order: MemberId[]; seconds: number };

export type RelayPanel = { from: MemberId; blobId: string };

export type RelayTurn = { member: MemberId; panelIndex: number; deadline: number };

export type RelayState = {
  phase: 'waiting' | 'turn' | 'reveal';
  turn: RelayTurn | null;
  /** Finished panels by reading-order index. A skipped panel stays missing. */
  done: Record<number, RelayPanel>;
};

export const INITIAL_RELAY: RelayState = { phase: 'waiting', turn: null, done: {} };

export function relayTemplate(templateId: string): LayoutTemplate | undefined {
  return RELAY_TEMPLATES.find(item => item.id === templateId);
}

/** The setup lives in the room options. Anything malformed means "not set up yet". */
export function readRelaySetup(options: Record<string, unknown> | undefined): RelaySetup | null {
  const raw = options?.relay as Partial<RelaySetup> | undefined;
  if (!raw || typeof raw.templateId !== 'string' || !relayTemplate(raw.templateId)) {
    return null;
  }
  const order = Array.isArray(raw.order) ? raw.order.filter((id): id is string => typeof id === 'string') : [];
  const seconds = (RELAY_SECONDS as readonly number[]).includes(raw.seconds as number)
    ? (raw.seconds as number)
    : DEFAULT_RELAY_SECONDS;
  return order.length ? { templateId: raw.templateId, order: [...new Set(order)], seconds } : null;
}

export function relayOptions(setup: RelaySetup): Record<string, unknown> {
  return { relay: setup };
}

export function panelCount(setup: RelaySetup): number {
  return relayTemplate(setup.templateId)?.count ?? 0;
}

/** Turns go round the order; someone who left is passed over. Null when nobody from the order is left. */
export function drawerFor(setup: RelaySetup, panelIndex: number, present: MemberId[]): MemberId | null {
  const n = setup.order.length;
  for (let k = 0; k < n; k++) {
    const member = setup.order[(panelIndex + k) % n];
    if (present.includes(member)) {
      return member;
    }
  }
  return null;
}

export function reduceRelay(state: RelayState, message: Message, from: MemberId): RelayState {
  switch (message.t) {
    case 'relay.turn': {
      const turn = { member: message.member, panelIndex: message.panelIndex, deadline: message.deadline };
      // The first panel is a new relay: nothing from an earlier one carries over.
      return { phase: 'turn', turn, done: message.panelIndex === 0 ? {} : state.done };
    }
    case 'relay.done': {
      const turn = state.turn;
      // Only the person whose turn it is, for that panel: a late picture after a skip is ignored.
      if (!turn || turn.panelIndex !== message.panelIndex || turn.member !== from) {
        return state;
      }
      return { ...state, done: { ...state.done, [message.panelIndex]: { from, blobId: message.blobId } } };
    }
    case 'relay.reveal':
      return { ...state, phase: 'reveal', turn: null };
    default:
      return state;
  }
}

/** The only panel the drawer may see: the last one finished before theirs. */
export function previousPanel(state: RelayState, panelIndex: number): (RelayPanel & { panelIndex: number }) | null {
  for (let index = panelIndex - 1; index >= 0; index--) {
    const panel = state.done[index];
    if (panel) {
      return { ...panel, panelIndex: index };
    }
  }
  return null;
}

/**
 * What the host sends next once a panel is finished or given up on: the following turn, or the reveal
 * after the last panel (or when nobody is left to draw).
 */
export function nextRelayStep(setup: RelaySetup, after: number, present: MemberId[], now: number): Message {
  const next = after + 1;
  const member = next < panelCount(setup) ? drawerFor(setup, next, present) : null;
  if (member === null) {
    return { t: 'relay.reveal' };
  }
  return { t: 'relay.turn', member, panelIndex: next, deadline: now + setup.seconds * 1000 };
}

/** The drawer left in the middle of a turn: the same panel goes to the next person still here. */
export function reassignRelayTurn(setup: RelaySetup, panelIndex: number, present: MemberId[], now: number): Message {
  return nextRelayStep(setup, panelIndex - 1, present, now);
}

export function firstRelayStep(setup: RelaySetup, present: MemberId[], now: number): Message {
  return nextRelayStep(setup, -1, present, now);
}

/** Who has drawn what, for the reveal credits: member ids in panel order. */
export function relayCredits(state: RelayState, count: number): (MemberId | null)[] {
  return Array.from({ length: count }, (_, index) => state.done[index]?.from ?? null);
}
