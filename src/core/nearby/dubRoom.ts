/**
 * Dub together over the room. The host puts the script in the room options and sends `dub.roles`; each
 * guest sends a take to the host as an `audio` blob followed by a `dub.clip` naming it. The two can arrive
 * in either order, so the host pairs them by blob id. At the end the host shares every clip room-wide.
 */
import { voiceOf, type DubScript } from './dub';
import { MIN_CLIP_MS, clampClipMs } from './dubClips';
import type { RoomStoreState } from './room';
import type { MemberId, RoomBlob } from './types';

export type DubRoomApi = Pick<RoomStoreState, 'send' | 'sendBlob' | 'onBlob' | 'onMessage'>;

/** A 15 s clip at 64 kbps is about 160 KB of base64; anything far bigger is not one of ours. */
export const MAX_CLIP_BASE64 = 600 * 1024;

/** A clip that arrived, ready to be written to a file. */
export type ArrivedClip = { bubbleId: string; from: MemberId; by: string; ms: number; data: string };

const isBase64 = (data: string) => data.length > 0 && data.length <= MAX_CLIP_BASE64;

/** Guest (or host recording their own lines): sends one take to the host. */
export async function sendTake(
  room: DubRoomApi,
  ids: { me: MemberId; host: MemberId },
  bubbleId: string,
  base64: string,
  ms: number,
): Promise<void> {
  const blobId = await room.sendBlob('audio', base64, { dub: 'take', bubbleId, ms: clampClipMs(ms) }, ids.host);
  // `from` must be a real id to pass the shape check; the host overwrites it with the true sender anyway.
  room.send({ t: 'dub.clip', from: ids.me, bubbleId, blobId, ms: clampClipMs(ms) }, ids.host);
}

/**
 * Host: collects takes. A take is kept only when its bubble is in the script and the sender is the person
 * voicing that line, so nobody can overwrite someone else's lines.
 */
export function collectTakes(
  room: DubRoomApi,
  context: () => { script: DubScript | null; roles: Record<string, MemberId>; hostId: MemberId; members: { id: MemberId; name: string }[] },
  onClip: (clip: ArrivedClip) => void,
): () => void {
  const blobs = new Map<string, RoomBlob>();
  const notes = new Map<string, { from: MemberId; bubbleId: string; ms: number }>();

  const accept = (blobId: string) => {
    const blob = blobs.get(blobId);
    const note = notes.get(blobId);
    if (!blob || !note) {
      return;
    }
    blobs.delete(blobId);
    notes.delete(blobId);
    const { script, roles, hostId, members } = context();
    const line = script?.lines.find(item => item.bubbleId === note.bubbleId);
    const present = members.map(member => member.id);
    if (!line || blob.from !== note.from || voiceOf(roles, line.role, hostId, present) !== note.from) {
      return;
    }
    const ms = clampClipMs(note.ms);
    if (ms < MIN_CLIP_MS) {
      return;
    }
    const by = members.find(member => member.id === note.from)?.name ?? '';
    onClip({ bubbleId: note.bubbleId, from: note.from, by, ms, data: blob.data });
  };

  const offBlob = room.onBlob(blob => {
    if (blob.kind !== 'audio' || blob.meta?.dub !== 'take' || !isBase64(blob.data)) {
      return;
    }
    blobs.set(blob.id, blob);
    accept(blob.id);
  });
  const offClip = room.onMessage('dub.clip', (message, from) => {
    notes.set(message.blobId, { from, bubbleId: message.bubbleId, ms: message.ms });
    accept(message.blobId);
  });
  return () => {
    offBlob();
    offClip();
  };
}

/** Host: shares one finished clip with everyone. */
export function shareClip(room: DubRoomApi, chapterId: string, clip: Omit<ArrivedClip, 'from'>): Promise<string> {
  return room.sendBlob('audio', clip.data, { dub: 'share', chapterId, bubbleId: clip.bubbleId, ms: clampClipMs(clip.ms), by: clip.by.slice(0, 60) });
}

/** Everyone: receives the clips the host shared at the end. Clips from anyone but the host are ignored. */
export function receiveShared(
  room: DubRoomApi,
  context: () => { hostId: MemberId | null; script: DubScript | null; meId: MemberId | null },
  onClip: (clip: ArrivedClip & { chapterId: string }) => void,
): () => void {
  return room.onBlob(blob => {
    const { hostId, script, meId } = context();
    const meta = blob.meta ?? {};
    if (blob.kind !== 'audio' || meta.dub !== 'share' || blob.from !== hostId || blob.from === meId || !isBase64(blob.data)) {
      return;
    }
    const bubbleId = typeof meta.bubbleId === 'string' ? meta.bubbleId : '';
    const chapterId = typeof meta.chapterId === 'string' ? meta.chapterId : '';
    if (!script || chapterId !== script.chapterId || !script.lines.some(line => line.bubbleId === bubbleId)) {
      return;
    }
    const ms = clampClipMs(typeof meta.ms === 'number' ? meta.ms : 0);
    const by = typeof meta.by === 'string' ? meta.by.slice(0, 60) : '';
    onClip({ chapterId, bubbleId, from: blob.from, by, ms, data: blob.data });
  });
}
