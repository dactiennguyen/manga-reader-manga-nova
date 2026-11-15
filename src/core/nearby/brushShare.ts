/**
 * Sending a set of brushes and tones to one person in the room. Like sending a story, but small: the set
 * goes as a `.mnbrush` file in one 'brushes' blob, and only after the receiver says yes. The receiving phone
 * checks the file and keeps it for the import screen; nothing is added to their brushes until they choose
 * what to import there.
 *
 *   offer ─▶ brushes.offer ─▶ [receiver: accept | decline]
 *   brushes.accept ─▶ blob 'brushes' (meta.offer) ─▶ check ─▶ brushes.done | brushes.cancel(failed)
 */
import { BRUSH_FILE_MAX_CHARS, parseBrushFile, serializeBrushFile, type BrushFile } from '../art/brushFile';
import { PRESETS_MAX, SET_NAME_MAX } from '../art/presets';
import { decodeBase64Text, encodeBase64Text } from './base64url';
import { BRUSH_BLOB_CHUNKS_MAX, CHUNK_CHARS } from './schema';
import type { SendRoom } from './sendStory';
import type { MemberId, RoomBlob } from './types';

/** The base64 of the largest file a phone accepts. The schema caps the chunks to match. */
export const BRUSH_BLOB_MAX_CHARS = Math.min(Math.ceil((BRUSH_FILE_MAX_CHARS * 4) / 3) + 4, BRUSH_BLOB_CHUNKS_MAX * CHUNK_CHARS);

export type BrushTransferStatus =
  | 'offered' // sent the offer, waiting for an answer
  | 'incoming' // an offer waiting for this person's answer
  | 'sending'
  | 'receiving'
  | 'received' // checked and waiting on the import screen
  | 'done' // the friend's phone has it
  | 'declined'
  | 'cancelled'
  | 'failed';

export type BrushTransfer = {
  id: string;
  direction: 'out' | 'in';
  peer: MemberId;
  name: string;
  brushes: number;
  tones: number;
  status: BrushTransferStatus;
  /** On the receiving phone once it arrived: the file as text, for the import screen. */
  text?: string;
};

const ENDED: readonly BrushTransferStatus[] = ['received', 'done', 'declined', 'cancelled', 'failed'];

export function isBrushTransferEnded(transfer: BrushTransfer): boolean {
  return ENDED.includes(transfer.status);
}

export function brushBlob(file: BrushFile): string {
  return encodeBase64Text(serializeBrushFile(file));
}

/** The file text of a received blob, or null for anything oversized, garbled or not a valid set. */
export function readBrushBlob(data: string): string | null {
  if (data.length > BRUSH_BLOB_MAX_CHARS) {
    return null;
  }
  const text = decodeBase64Text(data);
  return text && parseBrushFile(text).ok ? text : null;
}

export type BrushShareController = {
  transfers(): BrushTransfer[];
  /** Offers the set to one person. Returns the offer id. */
  offer(file: BrushFile, to: MemberId): string;
  accept(id: string): void;
  decline(id: string): void;
  cancel(id: string): void;
  /** Forgets transfers that ended. */
  clearEnded(): void;
  dispose(): void;
};

export function createBrushShareController(
  room: Pick<SendRoom, 'send' | 'onMessage' | 'startBlob' | 'onBlob' | 'me'>,
  onChange: (transfers: BrushTransfer[]) => void,
  newId: () => string,
): BrushShareController {
  let list: BrushTransfer[] = [];
  const packed = new Map<string, string>();
  const outgoing = new Map<string, { cancel(): void }>();
  const me = () => room.me() ?? '';

  const find = (id: string) => list.find(item => item.id === id);
  const update = (id: string, patch: Partial<BrushTransfer>) => {
    list = list.map(item => (item.id === id ? { ...item, ...patch } : item));
    onChange(list);
  };
  const finish = (id: string, status: BrushTransferStatus) => {
    packed.delete(id);
    outgoing.get(id)?.cancel();
    outgoing.delete(id);
    update(id, { status });
  };
  const live = (id: string, from: MemberId) => {
    const item = find(id);
    return item && item.peer === from && !isBrushTransferEnded(item) ? item : undefined;
  };
  const fail = (item: BrushTransfer) => {
    finish(item.id, 'failed');
    room.send({ t: 'brushes.cancel', from: me(), blobId: item.id, reason: 'failed' }, item.peer);
  };

  const startSending = async (item: BrushTransfer) => {
    const base64 = packed.get(item.id);
    if (!base64) {
      return fail(item);
    }
    update(item.id, { status: 'sending' });
    try {
      const sending = room.startBlob('brushes', base64, { meta: { offer: item.id }, to: item.peer });
      outgoing.set(item.id, sending);
      await sending.done;
      outgoing.delete(item.id);
    } catch {
      outgoing.delete(item.id);
      const now = find(item.id);
      if (now && !isBrushTransferEnded(now)) {
        fail(now);
      }
    }
  };

  const receive = (item: BrushTransfer, blob: RoomBlob) => {
    const text = readBrushBlob(blob.data);
    if (!text) {
      return fail(item);
    }
    update(item.id, { status: 'received', text });
    room.send({ t: 'brushes.done', from: me(), blobId: item.id }, item.peer);
  };

  const offs = [
    room.onMessage('brushes.offer', (message, from) => {
      if (from === room.me() || find(message.blobId)) {
        return;
      }
      list = [
        ...list,
        {
          id: message.blobId,
          direction: 'in',
          peer: from,
          name: message.name.trim().slice(0, SET_NAME_MAX),
          brushes: Math.min(PRESETS_MAX, message.brushes),
          tones: Math.min(PRESETS_MAX, message.tones),
          status: 'incoming',
        },
      ];
      onChange(list);
    }),
    room.onMessage('brushes.accept', (message, from) => {
      const item = live(message.blobId, from);
      if (item?.direction === 'out' && item.status === 'offered') {
        startSending(item).catch(() => undefined);
      }
    }),
    room.onMessage('brushes.cancel', (message, from) => {
      const item = live(message.blobId, from);
      if (item) {
        finish(item.id, message.reason === 'declined' ? 'declined' : message.reason === 'failed' ? 'failed' : 'cancelled');
      }
    }),
    room.onMessage('brushes.done', (message, from) => {
      const item = live(message.blobId, from);
      if (item?.direction === 'out') {
        finish(item.id, 'done');
      }
    }),
    room.onMessage('bye', (_message, from) => {
      list.filter(item => item.peer === from && !isBrushTransferEnded(item)).forEach(item => finish(item.id, 'failed'));
    }),
    // A 'brushes' blob with no accepted offer behind it is ignored: nothing arrives that was not said yes to.
    room.onBlob(blob => {
      const offer = blob.kind === 'brushes' ? blob.meta?.offer : undefined;
      const item = typeof offer === 'string' ? live(offer, blob.from) : undefined;
      if (item?.direction === 'in' && item.status === 'receiving') {
        receive(item, blob);
      }
    }),
  ];

  return {
    transfers: () => list,

    offer(file, to) {
      const id = newId();
      const base64 = brushBlob(file);
      packed.set(id, base64);
      const item: BrushTransfer = {
        id,
        direction: 'out',
        peer: to,
        name: file.name,
        brushes: file.brushes.length,
        tones: file.tones.length,
        status: 'offered',
      };
      list = [...list, item];
      onChange(list);
      room.send({ t: 'brushes.offer', from: me(), blobId: id, name: item.name, brushes: item.brushes, tones: item.tones }, to);
      return id;
    },

    accept(id) {
      const item = find(id);
      if (item?.direction === 'in' && item.status === 'incoming') {
        update(id, { status: 'receiving' });
        room.send({ t: 'brushes.accept', from: me(), blobId: id }, item.peer);
      }
    },

    decline(id) {
      const item = find(id);
      if (item?.direction === 'in' && item.status === 'incoming') {
        finish(id, 'declined');
        room.send({ t: 'brushes.cancel', from: me(), blobId: id, reason: 'declined' }, item.peer);
      }
    },

    cancel(id) {
      const item = find(id);
      if (item && !isBrushTransferEnded(item)) {
        finish(id, 'cancelled');
        room.send({ t: 'brushes.cancel', from: me(), blobId: id, reason: 'cancelled' }, item.peer);
      }
    },

    clearEnded() {
      list = list.filter(item => !isBrushTransferEnded(item));
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
