import type { ImageSourcePropType } from 'react-native';

import { msg } from '../../core/i18n';
import type { RoomStoreState } from '../../core/nearby/room';
import type { Activity } from '../../core/nearby/types';
import { NEARBY_ART } from '../../ui/nearbyArt';

type ActivityRoute = 'CoDraw' | 'Relay' | 'Battle' | 'ReadTogether' | 'Dub' | 'CardSwap' | 'MangakaCard' | 'SendStory';

export type ActivityCard = { activity: Exclude<Activity, 'lobby'>; route: ActivityRoute; title: string; blurb: string; art: ImageSourcePropType };

/** The eight things to do together, in the order the lobby shows them. Texts are msg() keys. */
export const ACTIVITY_CARDS: readonly ActivityCard[] = [
  { activity: 'codraw', route: 'CoDraw', title: msg('Draw together'), blurb: msg('One page, everyone drawing live'), art: NEARBY_ART.codraw },
  { activity: 'relay', route: 'Relay', title: msg('Panel relay'), blurb: msg('Each draws a panel, seeing only the one before'), art: NEARBY_ART.relay },
  { activity: 'battle', route: 'Battle', title: msg('Speed battle'), blurb: msg('Same prompt, a timer, then everyone votes'), art: NEARBY_ART.battle },
  { activity: 'read', route: 'ReadTogether', title: msg('Read together'), blurb: msg('Turn the pages for everyone and collect notes'), art: NEARBY_ART.read },
  { activity: 'dub', route: 'Dub', title: msg('Dub together'), blurb: msg('Give each character a real voice'), art: NEARBY_ART.dub },
  { activity: 'cards', route: 'CardSwap', title: msg('Card swap'), blurb: msg('Trade character cards with friends'), art: NEARBY_ART.cards },
  { activity: 'mangaka', route: 'MangakaCard', title: msg('Mangaka cards'), blurb: msg('Show your card, scan a friend'), art: NEARBY_ART.mangakaCard },
  { activity: 'send', route: 'SendStory', title: msg('Send a story'), blurb: msg('Give a whole story to a friend over Wi-Fi'), art: NEARBY_ART.send },
];

/**
 * The screen for the room's current activity. No params: ids in the room options belong to the host's
 * phone (guests get copies with their own ids), so each activity screen reads the options itself.
 */
export function activityRoute(activity: Activity): ActivityRoute | 'Room' {
  return activity === 'lobby' ? 'Room' : ACTIVITY_CARDS.find(item => item.activity === activity)!.route;
}

type FollowState = Pick<RoomStoreState, 'status' | 'room'>;

const inRoom = (state: FollowState) => (state.status === 'hosting' || state.status === 'joined') && !!state.room;

/**
 * Whether a phone should move to the room's activity screen: when the activity changes, or on arriving in a
 * room that is already mid-activity. New options for the same activity (the host turning a page) never move it.
 */
export function shouldFollow(previous: FollowState, state: FollowState): boolean {
  if (!inRoom(state)) {
    return false;
  }
  const wasHere = inRoom(previous) && previous.room!.roomId === state.room!.roomId;
  return wasHere ? previous.room!.activity !== state.room!.activity : state.room!.activity !== 'lobby';
}
