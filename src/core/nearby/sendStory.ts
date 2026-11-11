/**
 * Sending a story to one person in the room. The sender packs the `.manganova` file first (so the offer can say
 * how big it is), offers it, and only sends the bytes once the receiver accepts. A story blob that arrives
 * without an accepted offer is ignored: nothing is imported that the person did not say yes to.
 *
 *   offer ─▶ send.offer ─▶ [receiver: accept | decline]
 *   send.accept ─▶ blob 'story' (meta.offer) with progress ─▶ import ─▶ send.done | send.cancel(failed)
 */
import type { OutgoingBlob, RoomStoreState } from './room';
import type { BlobProgress, MemberId, RoomBlob } from './types';

/** The most a phone accepts, a little under what the protocol can carry. */
export const STORY_MAX_BYTES = 140 * 1024 * 1024;

export type TransferStatus =
  | 'offered' // sent the offer, waiting for an answer
  | 'incoming' // an offer waiting for this person's answer
  | 'sending'
  | 'receiving'
  | 'sent' // every byte sent, waiting for the friend's phone to import it
  | 'importing'
  | 'done'
  | 'declined'
  | 'cancelled'
  | 'failed';

export type Transfer = {
  id: string;
  direction: 'out' | 'in';
  peer: MemberId;
  title: string;
  bytes: number;
  status: TransferStatus;
  /** 0 to 1. */
  progress: number;
  /** The new story, on the receiving phone. */
  projectId?: string;
};

export type StoryFiles = {
  /** The story as a `.manganova` file in base64, with its title and file size. */
  pack(projectId: string): Promise<{ base64: string; title: string; bytes: number }>;
  /** Imports a received file as a new story (ids remapped) and returns its id. */
  unpack(base64: string): Promise<string>;
};

export type SendRoom = Pick<RoomStoreState, 'send' | 'onMessage' | 'startBlob' | 'onBlob' | 'onBlobProgress'> & {
  me(): MemberId | null;
};

export const FINISHED: readonly TransferStatus[] = ['done', 'declined', 'cancelled', 'failed'];

export function isFinished(transfer: Transfer): boolean {
  return FINISHED.includes(transfer.status);
}

export type SendController = {
  transfers(): Transfer[];
  offer(projectId: string, to: MemberId): Promise<string>;
  accept(id: string): void;
  decline(id: string): void;
  cancel(id: string): void;
  /** Forgets finished transfers. */
  clearFinished(): void;
  dispose(): void;
};

export function createSendController(
  room: SendRoom,
  files: StoryFiles,
  onChange: (transfers: Transfer[]) => void,
  newId: () => string,
): SendController {
  let list: Transfer[] = [];
  const packed = new Map<string, string>();
  /** Room blob id → transfer id, learnt from the first progress event of each blob. */
  const blobOf = new Map<string, string>();
  /** Transfer id → the bytes going out, so a cancel, a no or a failure also stops the sending. */
  const outgoing = new Map<string, OutgoingBlob>();

  const find = (id: string) => list.find(item => item.id === id);
  const update = (id: string, patch: Partial<Transfer>) => {
    list = list.map(item => (item.id === id ? { ...item, ...patch } : item));
    onChange(list);
  };
  const finish = (id: string, status: TransferStatus) => {
    packed.delete(id);
    outgoing.get(id)?.cancel();
    outgoing.delete(id);
    update(id, { status });
  };
  const live = (id: string, from: MemberId) => {
    const item = find(id);
    return item && item.peer === from && !isFinished(item) ? item : undefined;
  };

  const startSending = async (item: Transfer) => {
    const base64 = packed.get(item.id);
    if (!base64) {
      return finish(item.id, 'failed');
    }
    update(item.id, { status: 'sending', progress: 0 });
    try {
      const sending = room.startBlob('story', base64, { meta: { offer: item.id, title: item.title }, to: item.peer });
      outgoing.set(item.id, sending);
      blobOf.set(sending.id, item.id);
      await sending.done;
      outgoing.delete(item.id);
      packed.delete(item.id);
      if (find(item.id)?.status === 'sending') {
        update(item.id, { status: 'sent', progress: 1 });
      }
    } catch {
      outgoing.delete(item.id);
      if (!isFinished(find(item.id) ?? item)) {
        room.send({ t: 'send.cancel', from: room.me() ?? '', blobId: item.id, reason: 'failed' }, item.peer);
        finish(item.id, 'failed');
      }
    }
  };

  const receive = async (item: Transfer, blob: RoomBlob) => {
    update(item.id, { status: 'importing', progress: 1 });
    try {
      const projectId = await files.unpack(blob.data);
      update(item.id, { status: 'done', projectId });
      room.send({ t: 'send.done', from: room.me() ?? '', blobId: item.id }, item.peer);
    } catch {
      finish(item.id, 'failed');
      room.send({ t: 'send.cancel', from: room.me() ?? '', blobId: item.id, reason: 'failed' }, item.peer);
    }
  };

  // Progress events carry no transfer id, so a blob is matched to the transfer moving bytes with that peer.
  const onProgress = (progress: BlobProgress) => {
    let id = blobOf.get(progress.id);
    if (!id) {
      const wanted = progress.direction === 'out' ? 'sending' : 'receiving';
      const peer = progress.direction === 'out' ? undefined : progress.from;
      const owner = list.find(item => item.status === wanted && (peer === undefined || item.peer === peer) && ![...blobOf.values()].includes(item.id));
      if (!owner) {
        return;
      }
      id = owner.id;
      blobOf.set(progress.id, id);
    }
    const item = find(id);
    if (item && (item.status === 'sending' || item.status === 'receiving')) {
      update(id, { progress: progress.count ? progress.done / progress.count : 0 });
    }
  };

  const offs = [
    room.onMessage('send.offer', (message, from) => {
      if (from === room.me() || find(message.blobId)) {
        return;
      }
      const tooBig = !(message.bytes > 0) || message.bytes > STORY_MAX_BYTES;
      if (tooBig) {
        room.send({ t: 'send.cancel', from: room.me() ?? '', blobId: message.blobId, reason: 'failed' }, from);
        return;
      }
      list = [
        ...list,
        { id: message.blobId, direction: 'in', peer: from, title: message.title.trim().slice(0, 120), bytes: message.bytes, status: 'incoming', progress: 0 },
      ];
      onChange(list);
    }),
    room.onMessage('send.accept', (message, from) => {
      const item = live(message.blobId, from);
      if (item?.direction === 'out' && item.status === 'offered') {
        startSending(item).catch(() => undefined);
      }
    }),
    room.onMessage('send.cancel', (message, from) => {
      const item = live(message.blobId, from);
      if (item) {
        finish(item.id, message.reason === 'declined' ? 'declined' : message.reason === 'failed' ? 'failed' : 'cancelled');
      }
    }),
    room.onMessage('send.done', (message, from) => {
      const item = live(message.blobId, from);
      if (item?.direction === 'out') {
        finish(item.id, 'done');
      }
    }),
    room.onMessage('bye', (_message, from) => {
      list.filter(item => item.peer === from && !isFinished(item)).forEach(item => finish(item.id, 'failed'));
    }),
    room.onBlobProgress(onProgress),
    room.onBlob(blob => {
      const offer = blob.kind === 'story' ? blob.meta?.offer : undefined;
      const item = typeof offer === 'string' ? live(offer, blob.from) : undefined;
      if (item?.direction === 'in' && item.status === 'receiving') {
        receive(item, blob).catch(() => undefined);
      }
    }),
  ];

  return {
    transfers: () => list,

    async offer(projectId, to) {
      const id = newId();
      const { base64, title, bytes } = await files.pack(projectId);
      if (bytes > STORY_MAX_BYTES) {
        throw new Error('too large');
      }
      packed.set(id, base64);
      list = [...list, { id, direction: 'out', peer: to, title, bytes, status: 'offered', progress: 0 }];
      onChange(list);
      room.send({ t: 'send.offer', from: room.me() ?? '', blobId: id, title, bytes }, to);
      return id;
    },

    accept(id) {
      const item = find(id);
      if (item?.direction === 'in' && item.status === 'incoming') {
        update(id, { status: 'receiving', progress: 0 });
        room.send({ t: 'send.accept', from: room.me() ?? '', blobId: id }, item.peer);
      }
    },

    decline(id) {
      const item = find(id);
      if (item?.direction === 'in' && item.status === 'incoming') {
        finish(id, 'declined');
        room.send({ t: 'send.cancel', from: room.me() ?? '', blobId: id, reason: 'declined' }, item.peer);
      }
    },

    // Sending stops at once; chunks already on the wire are ignored by the receiver once cancelled.
    cancel(id) {
      const item = find(id);
      if (item && !isFinished(item) && item.status !== 'importing') {
        finish(id, 'cancelled');
        room.send({ t: 'send.cancel', from: room.me() ?? '', blobId: id, reason: 'cancelled' }, item.peer);
      }
    },

    clearFinished() {
      list = list.filter(item => !isFinished(item));
      onChange(list);
    },

    dispose() {
      offs.forEach(off => off());
      outgoing.forEach(sending => sending.cancel());
      outgoing.clear();
      packed.clear();
    },
  };
}
