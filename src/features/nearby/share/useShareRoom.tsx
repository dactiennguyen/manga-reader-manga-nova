import { useCallback, useMemo } from 'react';

import { t } from '../../../core/i18n';
import type { Member, MemberId } from '../../../core/nearby/types';
import { useAppNavigation } from '../../../state/navigation';
import { useRoom } from '../../../state/useRoom';
import { EmptyState } from '../../../ui';
import { NEARBY_ART } from '../../../ui/nearbyArt';
import type { SendRoom } from '../../../core/nearby/sendStory';

/** The room as the sharing screens need it: who is here, who I am, and whether I host. */
export function useShareRoom() {
  const status = useRoom(state => state.status);
  const me = useRoom(state => state.me);
  const room = useRoom(state => state.room);
  const inRoom = (status === 'hosting' || status === 'joined') && !!room && !!me;
  const members = useMemo(() => room?.members ?? [], [room]);
  const others = useMemo(() => members.filter(member => member.id !== me?.id), [members, me]);
  const nameOf = useCallback((id: MemberId): string => members.find(member => member.id === id)?.name ?? t('A friend'), [members]);
  return { status, me, room, inRoom, isHost: !!me?.host, members, others, nameOf };
}

/** The room store as the send controller and the other pure parts expect it. */
export function roomPort(): SendRoom {
  const state = useRoom.getState();
  return {
    me: () => useRoom.getState().me?.id ?? null,
    send: state.send,
    onMessage: state.onMessage,
    startBlob: state.startBlob,
    onBlob: state.onBlob,
    onBlobProgress: state.onBlobProgress,
  };
}

/** Shown in place of an activity while this phone is in no room. */
export function NoRoom({ art, message }: { art: keyof typeof NEARBY_ART; message: string }) {
  const navigation = useAppNavigation();
  return (
    <EmptyState
      art={NEARBY_ART[art]}
      title={t('Join a room first')}
      message={message}
      action={{ label: t('Play together nearby'), onPress: () => navigation.navigate('Nearby') }}
    />
  );
}

export type { Member };
