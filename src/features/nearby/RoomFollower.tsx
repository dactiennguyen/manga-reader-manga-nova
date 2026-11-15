import { StackActions, type NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useEffect } from 'react';

import { t } from '../../core/i18n';
import type { RoomStoreState } from '../../core/nearby/room';
import type { RootStackParamList } from '../../state/navigation';
import { useNearbySafety } from '../../state/useNearbySafety';
import { useRoom } from '../../state/useRoom';
import { toast } from '../../ui';
import { activityRoute, shouldFollow } from './activities';

type Ref = NavigationContainerRefWithCurrent<RootStackParamList>;

function inStack(ref: Ref, name: keyof RootStackParamList): boolean {
  return !!ref.getRootState()?.routes.some(route => route.name === name);
}

/** Back to the lobby (or the hub), dropping whatever activity screens are above it. */
function backTo(ref: Ref, name: 'Room' | 'Nearby') {
  if (inStack(ref, name)) {
    ref.dispatch(StackActions.popTo(name));
  } else {
    ref.navigate(name);
  }
}

function follow(ref: Ref, state: RoomStoreState) {
  const target = activityRoute(state.room!.activity);
  // Already there (e.g. the host opened the activity from a story and then started it): stay, keep its params.
  if (ref.getCurrentRoute()?.name === target) {
    return;
  }
  backTo(ref, 'Room');
  if (target !== 'Room') {
    ref.navigate(target);
  }
}

/** A guest is told once when someone they blocked joins (or is in) the room, wherever they are in the app. */
function noteBlocked(state: RoomStoreState, previous: RoomStoreState) {
  if (state.status !== 'joined' || !state.room || !state.me) {
    return;
  }
  const before = new Set(previous.status === 'joined' ? (previous.room?.members ?? []).map(member => member.id) : []);
  const { isBlocked } = useNearbySafety.getState();
  const arrived = state.room.members.filter(member => member.id !== state.me?.id && !before.has(member.id) && isBlocked(member.key));
  if (arrived.length) {
    toast(t('Someone you blocked is in this room: {names}', { names: arrived.map(member => member.name).join(', ') }));
  }
}

/**
 * Takes every phone where the host's choice of activity is, and back to the hub with a clear message
 * when the room ends for a guest. Every phone follows, the host included, so there is one code path.
 */
export function RoomFollower({ navigationRef }: { navigationRef: Ref }) {
  useEffect(
    () =>
      useRoom.subscribe((state, previous) => {
        if (state.room !== previous.room) {
          noteBlocked(state, previous);
        }
        if (!navigationRef.isReady()) {
          return;
        }
        if (shouldFollow(previous, state)) {
          follow(navigationRef, state);
          return;
        }
        if (state.status === 'error' && previous.status === 'joined' && state.error) {
          toast(state.error);
          backTo(navigationRef, 'Nearby');
        }
      }),
    [navigationRef],
  );
  return null;
}
