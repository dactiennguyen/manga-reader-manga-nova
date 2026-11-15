import { BUILTIN_BRUSHES } from '../src/core/art/brushes';
import { BRUSH_FILE_FORMAT, parseBrushFile, type BrushFile } from '../src/core/art/brushFile';
import { BUILTIN_TONES } from '../src/core/art/tone';
import { encodeBase64Text } from '../src/core/nearby/base64url';
import { brushBlob, createBrushShareController, readBrushBlob, type BrushTransfer } from '../src/core/nearby/brushShare';
import { createLoopbackPhones } from '../src/core/nearby/loopback';
import { parseEnvelope } from '../src/core/nearby/protocol';
import type { RoomStoreState } from '../src/core/nearby/room';
import type { SendRoom } from '../src/core/nearby/sendStory';
import type { StoreApi } from 'zustand/vanilla';

const FILE: BrushFile = {
  name: 'Inking',
  brushes: [{ ...BUILTIN_BRUSHES[0], id: 'a', name: 'Fine' }],
  tones: [{ ...BUILTIN_TONES[0], id: 't', name: 'Sky' }],
};

function portOf(phone: StoreApi<RoomStoreState>): SendRoom {
  const state = phone.getState();
  return {
    me: () => phone.getState().me?.id ?? null,
    send: state.send,
    onMessage: state.onMessage,
    startBlob: state.startBlob,
    onBlob: state.onBlob,
    onBlobProgress: state.onBlobProgress,
  };
}

let ids = 0;
const newId = () => `offer${++ids}`;

async function twoPhones() {
  const { phones, flush } = createLoopbackPhones(2);
  const address = await phones[0].getState().hostRoom('Mai');
  await phones[1].getState().joinRoom(address, 'Ken');
  await flush();
  const settle = async (done: () => boolean) => {
    for (let i = 0; i < 20 && !done(); i++) {
      await flush();
    }
  };
  return { phones, flush, settle, leave: () => phones.forEach(phone => phone.getState().leaveRoom()) };
}

describe('brush messages on the wire', () => {
  const line = (m: object) => JSON.stringify({ m });

  it('accepts the brushes messages and refuses oversized ones', () => {
    expect(parseEnvelope(line({ t: 'brushes.offer', from: 'a', blobId: 'b', name: 'Inking', brushes: 3, tones: 0 })).ok).toBe(true);
    expect(parseEnvelope(line({ t: 'brushes.offer', from: 'a', blobId: 'b', name: 'Inking', brushes: 61, tones: 0 })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'brushes.offer', from: 'a', blobId: 'b', name: 'x'.repeat(41), brushes: 1, tones: 0 })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'brushes.accept', from: 'a', blobId: 'b' })).ok).toBe(true);
    expect(parseEnvelope(line({ t: 'brushes.cancel', from: 'a', blobId: 'b', reason: 'declined' })).ok).toBe(true);
    expect(parseEnvelope(line({ t: 'brushes.cancel', from: 'a', blobId: 'b', reason: 'busy' })).ok).toBe(false);
    expect(parseEnvelope(line({ t: 'brushes.done', from: 'a', blobId: 'b' })).ok).toBe(true);
  });

  it('caps a brushes blob at a few chunks, other blobs keep their room', () => {
    const blob = (kind: string, count: number) => line({ t: 'blob', id: 'x', kind, index: 0, count, data: 'QUJD' });
    expect(parseEnvelope(blob('brushes', 8)).ok).toBe(true);
    expect(parseEnvelope(blob('brushes', 9)).ok).toBe(false);
    expect(parseEnvelope(blob('story', 9)).ok).toBe(true);
  });

  it('reads a blob back only when it holds a valid set', () => {
    const text = readBrushBlob(brushBlob(FILE));
    expect(text && parseBrushFile(text).ok).toBe(true);
    expect(readBrushBlob(encodeBase64Text('{"format":"other"}'))).toBeNull();
    expect(readBrushBlob(encodeBase64Text(JSON.stringify({ format: BRUSH_FILE_FORMAT, version: 1, brushes: [] })))).toBeNull();
    expect(readBrushBlob('not base64!')).toBeNull();
    expect(readBrushBlob('A'.repeat(400000))).toBeNull();
  });
});

describe('sending brushes over the loopback', () => {
  it('offers, waits for yes, then hands the checked file to the import screen', async () => {
    const { phones, settle, flush, leave } = await twoPhones();
    const seen: BrushTransfer[][] = [];
    const sender = createBrushShareController(portOf(phones[0]), () => undefined, newId);
    const receiver = createBrushShareController(portOf(phones[1]), list => seen.push(list), newId);

    const id = sender.offer(FILE, phones[1].getState().me!.id);
    await flush();
    expect(receiver.transfers()).toEqual([expect.objectContaining({ id, status: 'incoming', name: 'Inking', brushes: 1, tones: 1 })]);

    receiver.accept(id);
    await settle(() => sender.transfers()[0].status === 'done');
    const got = receiver.transfers()[0];
    expect(got.status).toBe('received');
    const parsed = parseBrushFile(got.text!);
    expect(parsed.ok && parsed.file.brushes.map(item => item.name)).toEqual(['Fine']);
    expect(sender.transfers()[0].status).toBe('done');
    expect(seen.some(list => list[0]?.status === 'receiving')).toBe(true);
    sender.dispose();
    receiver.dispose();
    leave();
  });

  it('tells the sender when the friend says no', async () => {
    const { phones, flush, leave } = await twoPhones();
    const sender = createBrushShareController(portOf(phones[0]), () => undefined, newId);
    const receiver = createBrushShareController(portOf(phones[1]), () => undefined, newId);
    const id = sender.offer(FILE, phones[1].getState().me!.id);
    await flush();
    receiver.decline(id);
    await flush();
    expect(receiver.transfers()[0].status).toBe('declined');
    expect(sender.transfers()[0].status).toBe('declined');
    sender.dispose();
    receiver.dispose();
    leave();
  });

  it('ignores a brushes blob nobody accepted, and fails a broken one', async () => {
    const { phones, flush, settle, leave } = await twoPhones();
    const receiver = createBrushShareController(portOf(phones[1]), () => undefined, newId);
    const ken = phones[1].getState().me!.id;
    await phones[0].getState().sendBlob('brushes', brushBlob(FILE), { offer: 'sneaky' }, ken);
    await flush();
    expect(receiver.transfers()).toEqual([]);

    // A sender whose blob is not a valid set: the receiver says it failed instead of importing anything.
    phones[0]
      .getState()
      .send({ t: 'brushes.offer', from: phones[0].getState().me!.id, blobId: 'bad', name: 'Bad', brushes: 1, tones: 0 }, ken);
    await flush();
    receiver.accept('bad');
    await flush();
    await phones[0].getState().sendBlob('brushes', encodeBase64Text('{"format":"nope"}'), { offer: 'bad' }, ken);
    await settle(() => receiver.transfers()[0]?.status === 'failed');
    expect(receiver.transfers()[0]).toMatchObject({ id: 'bad', status: 'failed' });
    expect(receiver.transfers()[0].text).toBeUndefined();
    receiver.dispose();
    leave();
  });

  it('fails what is still open when the friend leaves', async () => {
    const { phones, flush, leave } = await twoPhones();
    const sender = createBrushShareController(portOf(phones[0]), () => undefined, newId);
    sender.offer(FILE, phones[1].getState().me!.id);
    await flush();
    phones[1].getState().leaveRoom();
    for (let i = 0; i < 5; i++) {
      await flush();
    }
    expect(sender.transfers()[0].status).toBe('failed');
    sender.clearEnded();
    expect(sender.transfers()).toEqual([]);
    sender.dispose();
    leave();
  });
});
