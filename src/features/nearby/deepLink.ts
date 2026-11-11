import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { t } from '../../core/i18n';
import { parseRoomLink } from '../../core/nearby/link';
import type { RoomAddress } from '../../core/nearby/types';
import type { RootStackParamList } from '../../state/navigation';
import { receiveFriendLink } from '../../state/useNearbyShare';
import { useRoom } from '../../state/useRoom';
import { useSettings } from '../../state/useSettings';
import { confirm, toast } from '../../ui';

type Ref = NavigationContainerRefWithCurrent<RootStackParamList>;

/** A link can arrive while the app is still starting: wait a little for the navigator. */
function whenReady(ref: Ref, run: () => void, triesLeft = 50) {
  if (ref.isReady()) {
    run();
  } else if (triesLeft > 0) {
    setTimeout(() => whenReady(ref, run, triesLeft - 1), 100);
  }
}

async function joinFromLink(ref: Ref, address: RoomAddress) {
  const state = useRoom.getState();
  const current = state.address;
  const inRoom = state.status === 'hosting' || state.status === 'joined';
  if (inRoom && current?.host === address.host && current.port === address.port) {
    whenReady(ref, () => ref.navigate('Room'));
    return;
  }
  if (inRoom && !(await confirm(t('Join another room?'), t('You will leave {room}.', { room: state.room?.name ?? '' }), { confirmText: t('Join') }))) {
    return;
  }
  const name = useSettings.getState().penName.trim() || t('Mangaka');
  try {
    await useRoom.getState().joinRoom(address, name);
    whenReady(ref, () => {
      if (useRoom.getState().room?.activity === 'lobby') {
        ref.navigate('Room');
      }
    });
  } catch {
    const error = useRoom.getState().error;
    if (error) {
      toast(error);
    }
    whenReady(ref, () => ref.navigate('Nearby'));
  }
}

/**
 * `manganova://join?...` joins the room (from a room QR code scanned with the camera) and
 * `manganova://friend?...` opens the friend's mangaka card. False for anything else, such as a file.
 */
export function handleNearbyLink(url: string | null | undefined, ref: Ref): boolean {
  if (!url || !/^manganova:/i.test(url)) {
    return false;
  }
  const address = parseRoomLink(url);
  if (address) {
    joinFromLink(ref, address);
    return true;
  }
  if (receiveFriendLink(url)) {
    whenReady(ref, () => ref.navigate('MangakaCard'));
    return true;
  }
  toast(t("This link can't be opened."));
  return true;
}
