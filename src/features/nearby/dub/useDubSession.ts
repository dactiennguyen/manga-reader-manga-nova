import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { t } from '../../../core/i18n';
import { chapterLabel } from '../../../core/model/selectors';
import type { ID, StoryData } from '../../../core/model/types';
import {
  NARRATOR_ROLE,
  UNKNOWN_ROLE,
  autoRoles,
  castOf,
  cleanRoles,
  dubLines,
  linesFor,
  parseScript,
  scriptOptions,
  type DubItem,
  type DubScript,
} from '../../../core/nearby/dub';
import { collectTakes, receiveShared, sendTake, shareClip } from '../../../core/nearby/dubRoom';
import type { Member, MemberId } from '../../../core/nearby/types';
import { useStoryData } from '../../../state/hooks';
import { useChapterClips, useDubClips } from '../../../state/useDubClips';
import { useRoom } from '../../../state/useRoom';
import { useSettings } from '../../../state/useSettings';
import { toast } from '../../../ui';
import { keepArrived, readClip } from './clipFiles';

export type DubMode = 'solo' | 'host' | 'guest';

const SOLO_ID = 'me';

/** The script of a chapter as this phone's story has it, with role names for the guests. */
function scriptFor(story: StoryData, chapterId: ID): DubScript {
  const lines = dubLines(story, chapterId);
  const names: Record<string, string> = { [NARRATOR_ROLE]: t('Narrator'), [UNKNOWN_ROLE]: t('Someone') };
  castOf(lines).forEach(entry => {
    const name = entry.characterId ? story.characters[entry.characterId]?.name.trim() : '';
    if (name) {
      names[entry.role] = name;
    }
  });
  return { chapterId, title: chapterLabel(story, chapterId), lines, names };
}

/**
 * Everything the Dub screen knows: alone, as the host, or as a guest. Alone and as host the lines come
 * from the story; a guest has no story and reads the script the host put in the room options.
 */
export function useDubSession(routeChapterId: ID | undefined) {
  const status = useRoom(state => state.status);
  const me = useRoom(state => state.me);
  const room = useRoom(state => state.room);
  const penName = useSettings(state => state.penName);
  const inRoom = (status === 'hosting' || status === 'joined') && !!room && !!me && room.activity === 'dub';
  const mode: DubMode = !inRoom ? 'solo' : me!.host ? 'host' : 'guest';
  const story = useStoryData();
  const members: Member[] = useMemo(() => (inRoom ? room!.members : []), [inRoom, room]);
  const hostId = useMemo(() => members.find(member => member.host)?.id ?? SOLO_ID, [members]);
  const meId = inRoom ? me!.id : SOLO_ID;
  const myName = (inRoom ? me!.name : penName.trim()) || t('Me');

  // Alone, the chapter is chosen on this screen; in a room, the host's choice rides in the options.
  const [soloChapter, setSoloChapter] = useState<ID | null>(routeChapterId ?? null);
  const roomScript = useMemo(() => (inRoom ? parseScript(room!.options) : null), [inRoom, room]);

  const script: DubScript | null = useMemo(() => {
    if (mode === 'guest') {
      // The host named the narrator in its own language; read it in ours.
      return roomScript && { ...roomScript, names: { ...roomScript.names, [NARRATOR_ROLE]: t('Narrator'), [UNKNOWN_ROLE]: t('Someone') } };
    }
    const chapterId = mode === 'host' ? roomScript?.chapterId : soloChapter;
    return chapterId && story.chapters[chapterId] ? scriptFor(story, chapterId) : null;
  }, [mode, roomScript, soloChapter, story]);

  const chapterId = script?.chapterId ?? null;
  const clips = useChapterClips(chapterId);
  const [roles, setRoles] = useState<Record<string, MemberId>>({});
  const memberIds = useMemo(() => members.map(member => member.id), [members]);

  /** The host picks the chapter: the script goes into the room options and roles are dealt fairly. */
  const pickChapter = useCallback(
    (id: ID) => {
      if (mode === 'solo') {
        setSoloChapter(id);
        return;
      }
      if (mode !== 'host') {
        return;
      }
      const next = scriptFor(story, id);
      const dealt = autoRoles(castOf(next.lines), memberIds);
      setRoles(dealt);
      useRoom.getState().setActivity('dub', { chapterId: id, ...scriptOptions(next) });
      useRoom.getState().send({ t: 'dub.roles', roles: dealt });
    },
    [mode, story, memberIds],
  );

  const assign = useCallback(
    (role: string, member: MemberId) => {
      const next = { ...roles, [role]: member };
      setRoles(next);
      useRoom.getState().send({ t: 'dub.roles', roles: next });
    },
    [roles],
  );

  // Everyone keeps the roles the host sends, minus anything unknown.
  useEffect(() => {
    if (!inRoom) {
      return;
    }
    return useRoom.getState().onMessage('dub.roles', (message, from) => {
      // Read the room now, not from the last render: a new chapter's script and its roles can arrive together.
      const current = useRoom.getState().room;
      if (!current || !current.members.some(member => member.id === from && member.host)) {
        return;
      }
      const keys = castOf(parseScript(current.options)?.lines ?? []).map(entry => entry.role);
      setRoles(cleanRoles(message.roles, keys, current.members.map(member => member.id)));
    });
  }, [inRoom]);

  // Someone joined late: the host sends the roles again so they see their lines.
  const memberCount = members.length;
  useEffect(() => {
    if (mode === 'host' && script && memberCount > 0) {
      useRoom.getState().send({ t: 'dub.roles', roles });
    }
    // Only a change in who is here should resend; roles changes are sent by assign().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, memberCount, !!script]);

  // The collector reads these at arrival time, so a role change never drops a take half-way in.
  const live = useRef({ script, roles });
  live.current = { script, roles };

  // Host: takes from guests land in the chapter's clips.
  const hasScript = !!script;
  useEffect(() => {
    if (mode !== 'host' || !hasScript) {
      return;
    }
    return collectTakes(
      useRoom.getState(),
      () => ({ script: live.current.script, roles: live.current.roles, hostId, members: useRoom.getState().room?.members ?? [] }),
      clip => {
        const current = live.current.script;
        if (clip.from === meId || !current) {
          return;
        }
        const line = current.lines.find(item => item.bubbleId === clip.bubbleId);
        keepArrived(current.chapterId, clip.bubbleId, clip.data, { ms: clip.ms, by: clip.by, text: line?.text ?? '' })
          .then(() => toast(t('{name} recorded a line', { name: clip.by || t('A friend') })))
          .catch(() => toast(t("Couldn't save a recorded line")));
      },
    );
  }, [mode, hasScript, hostId, meId]);

  // Everyone but the host: the voices the host shares at the end.
  useEffect(() => {
    if (mode !== 'guest' || !script) {
      return;
    }
    return receiveShared(
      useRoom.getState(),
      () => ({ hostId, script, meId }),
      clip => {
        const line = script.lines.find(item => item.bubbleId === clip.bubbleId);
        keepArrived(clip.chapterId, clip.bubbleId, clip.data, { ms: clip.ms, by: clip.by, text: line?.text ?? '' }).catch(() => {});
      },
    );
  }, [mode, script, hostId, meId]);

  const present = mode === 'solo' ? undefined : memberIds;
  const myLines: DubItem[] = useMemo(
    () => (script ? (mode === 'solo' ? script.lines : linesFor(script.lines, roles, meId, hostId, present)) : []),
    [script, mode, roles, meId, hostId, present],
  );

  /** A kept take: a guest also sends it to the host. */
  const afterTake = useCallback(
    async (bubbleId: ID) => {
      if (mode !== 'guest' || !chapterId) {
        return;
      }
      // Read now, after keepTake updated the store.
      const entry = useDubClips.getState().clips[chapterId]?.[bubbleId];
      if (!entry) {
        return;
      }
      try {
        await sendTake(useRoom.getState(), { me: meId, host: hostId }, bubbleId, await readClip(entry), entry.ms);
      } catch {
        toast(t("Couldn't send the line. Check the Wi-Fi and record it again."));
      }
    },
    [mode, chapterId, meId, hostId],
  );

  /** Host: everyone gets every voice. Sent one clip at a time so the Wi-Fi and the screen keep up. */
  const shareAll = useCallback(async () => {
    if (mode !== 'host' || !script) {
      return 0;
    }
    let sent = 0;
    for (const line of script.lines) {
      const entry = clips[line.bubbleId];
      if (entry) {
        await shareClip(useRoom.getState(), script.chapterId, { bubbleId: line.bubbleId, by: entry.by, ms: entry.ms, data: await readClip(entry) });
        sent += 1;
      }
    }
    return sent;
  }, [mode, script, clips]);

  return { mode, script, clips, roles, members, hostId, meId, myName, myLines, pickChapter, assign, afterTake, shareAll };
}

