import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ID } from '../../../core/model/types';
import {
  INITIAL_FOLLOW,
  buildNote,
  onHostPage,
  onLocalPage,
  resolveNote,
  setFollowing,
  storyIndexOf,
  storyPages,
  type ResolvedNote,
  type StickerId,
  type StoryPage,
} from '../../../core/nearby/readTogether';
import type { RoomState } from '../../../core/nearby/types';
import { uid } from '../../../core/util/id';
import { useNearbyShare } from '../../../state/useNearbyShare';
import { useRoom } from '../../../state/useRoom';
import { useStory } from '../../../state/useStory';
import { storyFiles } from './shareFiles';
import { useShareRoom } from './useShareRoom';

/** How long a guest waits for the story before asking the host for it again. */
const ASK_AFTER_MS = 2500;

export type ReadOptions = { projectId: ID; title: string; page: number };

export function readOptions(room: RoomState | null): ReadOptions | null {
  const options = room?.activity === 'read' ? room.options : null;
  if (!options || typeof options.projectId !== 'string') {
    return null;
  }
  const page = typeof options.page === 'number' && options.page >= 0 ? Math.floor(options.page) : 0;
  return { projectId: options.projectId, title: typeof options.title === 'string' ? options.title.slice(0, 120) : '', page };
}

export type GuestCopy =
  | { state: 'waiting'; progress: number }
  | { state: 'importing' }
  | { state: 'ready'; projectId: ID }
  | { state: 'failed' };

/**
 * One read-together session on this phone. The host's story is the original; each guest gets a borrowed copy
 * that is deleted when they leave unless they keep it. Pages and notes travel by position (see readTogether.ts).
 */
export function useReadSession() {
  const { inRoom, isHost, me, room, members, nameOf } = useShareRoom();
  const options = readOptions(room);
  const hostId = members.find(member => member.host)?.id;
  const [copy, setCopy] = useState<GuestCopy>({ state: 'waiting', progress: 0 });
  const [kept, setKept] = useState(false);
  const [notes, setNotes] = useState<(ResolvedNote & { name: string })[]>([]);
  const [follow, setFollow] = useState(INITIAL_FOLLOW);
  const [jump, setJump] = useState<{ index: number; seq: number } | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;

  const localId = isHost ? options?.projectId : copy.state === 'ready' ? copy.projectId : undefined;
  const projects = useStory(s => s.projects);
  const chapters = useStory(s => s.chapters);
  const storyPagesMap = useStory(s => s.pages);
  const pages: StoryPage[] = useMemo(
    () => (localId ? storyPages({ projects, chapters, pages: storyPagesMap }, localId) : []),
    [localId, projects, chapters, storyPagesMap],
  );
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Host: send the story to every guest once, and again to anyone who asks.
  const packed = useRef<{ projectId: ID; base64: Promise<string> } | null>(null);
  const sentTo = useRef(new Map<string, 'sending' | 'sent'>());
  const sendTo = useCallback((memberId: string, projectId: ID, title: string) => {
    if (sentTo.current.get(memberId) === 'sending') {
      return;
    }
    if (packed.current?.projectId !== projectId) {
      packed.current = { projectId, base64: storyFiles.pack(projectId).then(file => file.base64) };
      sentTo.current.clear();
    }
    sentTo.current.set(memberId, 'sending');
    packed.current.base64
      .then(base64 => useRoom.getState().sendBlob('story', base64, { read: projectId, title }, memberId))
      .then(() => sentTo.current.set(memberId, 'sent'))
      .catch(() => sentTo.current.delete(memberId));
  }, []);

  useEffect(() => {
    if (!isHost || !options) {
      return;
    }
    members.filter(member => !member.host && !sentTo.current.has(member.id)).forEach(member => sendTo(member.id, options.projectId, options.title));
  }, [isHost, options?.projectId, options?.title, members, sendTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!inRoom || !isHost) {
      return;
    }
    return useRoom.getState().onMessage('read.want', (message, from) => {
      const current = readOptions(useRoom.getState().room);
      if (current && message.projectId === current.projectId) {
        sentTo.current.delete(from);
        sendTo(from, current.projectId, current.title);
      }
    });
  }, [inRoom, isHost, sendTo]);

  // Guest: receive the borrowed copy, ask again if it never comes.
  const hostProject = options?.projectId;
  useEffect(() => {
    if (!inRoom || isHost || !hostProject || !hostId) {
      return;
    }
    setCopy({ state: 'waiting', progress: 0 });
    let alive = true;
    let borrowed: ID | null = null;
    const room_ = useRoom.getState();
    const offProgress = room_.onBlobProgress(progress => {
      if (progress.direction === 'in' && progress.from === hostId && progress.count > 1) {
        setCopy(current => (current.state === 'waiting' ? { state: 'waiting', progress: progress.done / progress.count } : current));
      }
    });
    const offBlob = room_.onBlob(blob => {
      if (blob.kind !== 'story' || blob.from !== hostId || blob.meta?.read !== hostProject || borrowed) {
        return;
      }
      setCopy({ state: 'importing' });
      storyFiles
        .unpack(blob.data)
        .then(projectId => {
          borrowed = projectId;
          const share = useNearbyShare.getState();
          share.setBorrowed([...share.borrowed, projectId]);
          if (alive) {
            setCopy({ state: 'ready', projectId });
          } else {
            dropCopy(projectId);
          }
        })
        .catch(() => alive && setCopy({ state: 'failed' }));
    });
    const ask = setTimeout(() => {
      if (!borrowed) {
        useRoom.getState().send({ t: 'read.want', from: me?.id ?? '', projectId: hostProject }, hostId);
      }
    }, ASK_AFTER_MS);
    return () => {
      alive = false;
      clearTimeout(ask);
      offProgress();
      offBlob();
    };
  }, [inRoom, isHost, hostProject, hostId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The borrowed copy goes when the session ends, unless the reader chose to keep it.
  const keptRef = useRef(kept);
  keptRef.current = kept;
  const borrowedId = !isHost && copy.state === 'ready' ? copy.projectId : null;
  useEffect(() => {
    if (!borrowedId) {
      return;
    }
    return () => {
      if (keptRef.current) {
        const share = useNearbyShare.getState();
        share.setBorrowed(share.borrowed.filter(id => id !== borrowedId));
      } else {
        dropCopy(borrowedId);
      }
    };
  }, [borrowedId]);

  // Pages: the host's flips reach everyone; late joiners read the page from the room options.
  const applyHostPage = useCallback((index: number) => {
    const step = onHostPage(followRef.current, index, Date.now());
    setFollow(step.state);
    if (step.jumpTo !== null) {
      setJump(current => ({ index: step.jumpTo!, seq: (current?.seq ?? 0) + 1 }));
    }
  }, []);

  useEffect(() => {
    if (!inRoom || isHost) {
      return;
    }
    return useRoom.getState().onMessage('read.page', message => {
      if (message.projectId === readOptions(useRoom.getState().room)?.projectId) {
        applyHostPage(message.pageIndex);
      }
    });
  }, [inRoom, isHost, applyHostPage]);

  const optionPage = options?.page;
  useEffect(() => {
    if (!isHost && localId && optionPage !== undefined && followRef.current.hostPage === null) {
      applyHostPage(optionPage);
    }
  }, [isHost, localId, optionPage, applyHostPage]);

  const onPageShown = useCallback(
    (pageId: ID) => {
      const index = storyIndexOf(pagesRef.current, pageId);
      if (index < 0) {
        return;
      }
      if (isHost) {
        const current = readOptions(useRoom.getState().room);
        if (current && current.page !== index) {
          useRoom.getState().send({ t: 'read.page', projectId: current.projectId, pageIndex: index });
          useRoom.getState().setActivity('read', { ...current, page: index });
        }
      } else {
        setFollow(state => onLocalPage(state, index, Date.now()));
      }
    },
    [isHost],
  );

  const toggleFollow = (on: boolean) => {
    const step = setFollowing(followRef.current, on, Date.now());
    setFollow(step.state);
    if (step.jumpTo !== null) {
      setJump(current => ({ index: step.jumpTo!, seq: (current?.seq ?? 0) + 1 }));
    }
  };

  // Notes: everyone shows them; the author also keeps them as a review list for the chapter.
  useEffect(() => {
    if (!inRoom) {
      return;
    }
    return useRoom.getState().onMessage('read.note', (message, from) => {
      const resolved = resolveNote(useStory.getState(), pagesRef.current, message);
      if (!resolved) {
        return;
      }
      const name = nameOf(from);
      setNotes(list => (list.some(note => note.id === resolved.id) ? list : [...list, { ...resolved, name }]));
      if (useRoom.getState().me?.host) {
        useNearbyShare.getState().addNote({ ...resolved, from: name, at: Date.now() });
      }
    });
  }, [inRoom, nameOf]);

  const dropNote = (pageId: ID, panelId: ID | null, x: number, y: number, sticker: StickerId, text: string) => {
    const note = buildNote(useStory.getState(), pagesRef.current, { id: uid(), from: me?.id ?? '', pageId, panelId, x, y, sticker, text });
    if (note) {
      useRoom.getState().send(note);
    }
  };

  return {
    inRoom,
    isHost,
    options,
    copy,
    localId,
    pages,
    notes,
    follow,
    jump,
    kept,
    setKept,
    toggleFollow,
    onPageShown,
    dropNote,
    hostName: hostId ? nameOf(hostId) : '',
  };
}

function dropCopy(projectId: ID): void {
  const share = useNearbyShare.getState();
  share.setBorrowed(share.borrowed.filter(id => id !== projectId));
  if (useStory.getState().projects[projectId]) {
    useStory.getState().deleteProjectForever(projectId);
  }
}
