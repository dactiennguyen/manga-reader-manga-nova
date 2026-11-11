/**
 * People in the room as the drawing activities show them: a name that stays known after they leave
 * (credits on a relay page, a battle result) and an ink colour of their own for cursors and chips.
 */
import { useRef } from 'react';

import { t } from '../../../core/i18n';
import { MEMBER_INKS } from '../../../core/nearby/codraw';
import type { Member, MemberId } from '../../../core/nearby/types';
import { useRoom } from '../../../state/useRoom';

export function inkOf(member: Pick<Member, 'color'> | undefined): string {
  return MEMBER_INKS[(member?.color ?? 0) % MEMBER_INKS.length];
}

const NO_MEMBERS: Member[] = [];

export function useMembers(): Member[] {
  return useRoom(state => state.room?.members ?? NO_MEMBERS);
}

/** Names of everyone seen in this room, including people who have left since. */
export function useMemberNames(): (id: MemberId | null | undefined) => string {
  const members = useMembers();
  const seen = useRef(new Map<MemberId, string>());
  members.forEach(member => seen.current.set(member.id, member.name));
  return id => (id ? seen.current.get(id) ?? t('Someone') : t('Nobody'));
}
