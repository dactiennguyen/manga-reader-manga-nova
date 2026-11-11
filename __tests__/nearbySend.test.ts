import { createLoopbackPhones } from '../src/core/nearby/loopback';
import { CHUNK_CHARS, parseEnvelope } from '../src/core/nearby/protocol';
import type { RoomStoreState } from '../src/core/nearby/room';
import { createSendController, type SendRoom, type StoryFiles, type Transfer } from '../src/core/nearby/sendStory';
import type { BlobProgress, MemberId, Message, RoomBlob } from '../src/core/nearby/types';
import type { StoreApi } from 'zustand/vanilla';

const STORY = 'U1RPUlk'.repeat(40000); // ~280 KB of base64: several chunks

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

function files(unpack: StoryFiles['unpack'] = async () => 'new-story'): StoryFiles & { unpack: jest.Mock } {
  return {
    pack: async projectId => ({ base64: STORY, title: `Story ${projectId}`, bytes: 210000 }),
    unpack: jest.fn(unpack),
  };
}

let ids = 0;
const newId = () => `offer${++ids}`;

/** Lines the schema does not know yet are dropped on a real network; the loopback runs the same code. */
const schemaKnows = (t: string) => parseEnvelope(JSON.stringify({ m: { t, from: 'a', blobId: 'b' } })).ok;

describe('send a story over the loopback', () => {
  it('offers, waits for yes, sends in chunks with progress and imports on arrival', async () => {
    const { phones, flush } = createLoopbackPhones(2);
    const address = await phones[0].getState().hostRoom('Mai');
    await phones[1].getState().joinRoom(address, 'Ken');
    await flush();
    const senderIo = files();
    const receiverIo = files();
    const seen: { out: Transfer[][]; in: Transfer[][] } = { out: [], in: [] };
    const sender = createSendController(portOf(phones[0]), senderIo, list => seen.out.push(list), newId);
    const receiver = createSendController(portOf(phones[1]), receiverIo, list => seen.in.push(list), newId);

    const id = await sender.offer('p1', phones[1].getState().me!.id);
    await flush();
    expect(receiver.transfers()).toEqual([expect.objectContaining({ id, status: 'incoming', title: 'Story p1', bytes: 210000 })]);
    expect(receiverIo.unpack).not.toHaveBeenCalled();

    receiver.accept(id);
    for (let i = 0; i < 20 && receiver.transfers()[0].status !== 'done'; i++) {
      await flush();
    }
    expect(receiverIo.unpack).toHaveBeenCalledWith(STORY);
    expect(receiver.transfers()[0]).toMatchObject({ status: 'done', projectId: 'new-story', progress: 1 });
    // Both sides saw the bar move through the middle.
    const middle = (lists: Transfer[][]) => lists.some(list => list[0] && list[0].progress > 0 && list[0].progress < 1);
    expect(middle(seen.out)).toBe(true);
    expect(middle(seen.in)).toBe(true);
    expect(sender.transfers()[0].status).toBe(schemaKnows('send.done') ? 'done' : 'sent');

    sender.dispose();
    receiver.dispose();
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('stops sending the bytes when the friend cancels halfway', async () => {
    const { phones, flush } = createLoopbackPhones(2);
    const address = await phones[0].getState().hostRoom('Mai');
    await phones[1].getState().joinRoom(address, 'Ken');
    await flush();
    const big = 'U1RPUlk'.repeat(200000); // ~1.4 MB: about thirty chunks
    const sender = createSendController(portOf(phones[0]), { ...files(), pack: async () => ({ base64: big, title: 'Long', bytes: 1000000 }) }, () => undefined, newId);
    const receiverIo = files();
    const receiver = createSendController(portOf(phones[1]), receiverIo, () => undefined, newId);
    let sent = 0;
    phones[0].getState().onBlobProgress(progress => {
      if (progress.direction === 'out') {
        sent = progress.done;
      }
    });
    const id = await sender.offer('p1', phones[1].getState().me!.id);
    await flush();
    receiver.accept(id);
    for (let i = 0; i < 50 && sent < 3; i++) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    receiver.cancel(id);
    await flush();
    await flush();
    const atCancel = sent;
    expect(sender.transfers()[0].status).toBe('cancelled');
    await flush();
    expect(sent).toBe(atCancel);
    expect(sent).toBeLessThan(Math.ceil(big.length / CHUNK_CHARS));
    expect(receiverIo.unpack).not.toHaveBeenCalled();
    sender.dispose();
    receiver.dispose();
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('never imports a story blob nobody accepted', async () => {
    const { phones, flush } = createLoopbackPhones(2);
    const address = await phones[0].getState().hostRoom('Mai');
    await phones[1].getState().joinRoom(address, 'Ken');
    await flush();
    const receiverIo = files();
    const receiver = createSendController(portOf(phones[1]), receiverIo, () => undefined, newId);
    await phones[0].getState().sendBlob('story', STORY, { offer: 'sneaky' }, phones[1].getState().me!.id);
    await flush();
    expect(receiverIo.unpack).not.toHaveBeenCalled();
    expect(receiver.transfers()).toEqual([]);
    receiver.dispose();
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

/** Two phones wired directly, for the answers the schema may not carry yet (cancel, done). */
function bus() {
  type Handler = (message: Message, from: MemberId) => void;
  const phones = ['a', 'b'].map(me => ({
    me,
    handlers: new Map<string, Set<Handler>>(),
    blobs: new Set<(blob: RoomBlob) => void>(),
    progress: new Set<(progress: BlobProgress) => void>(),
  }));
  const other = (me: string) => phones.find(phone => phone.me !== me)!;
  const ports = phones.map(
    (phone): SendRoom => ({
      me: () => phone.me,
      send: (message, to) => {
        const target = other(phone.me);
        if (to === target.me) {
          Promise.resolve().then(() => target.handlers.get(message.t)?.forEach(handler => handler(message, phone.me)));
        }
      },
      onMessage: ((type: string, handler: Handler) => {
        const set = phone.handlers.get(type) ?? new Set();
        phone.handlers.set(type, set);
        set.add(handler);
        return () => set.delete(handler);
      }) as SendRoom['onMessage'],
      startBlob: (kind, data, { meta, to } = {}) => {
        const target = other(phone.me);
        let cancelled = false;
        const done = (async () => {
          if (data === 'FAIL') {
            throw new Error('link lost');
          }
          for (let step = 1; step <= 2; step++) {
            phone.progress.forEach(handler => handler({ id: 'blob1', from: phone.me, done: step, count: 2, direction: 'out' }));
            target.progress.forEach(handler => handler({ id: 'blob1', from: phone.me, done: step, count: 2, direction: 'in' }));
            await Promise.resolve();
          }
          if (cancelled) {
            throw new Error('cancelled');
          }
          if (to === target.me) {
            target.blobs.forEach(handler => handler({ id: 'blob1', kind, data, meta, from: phone.me }));
          }
          return 'blob1';
        })();
        done.catch(() => undefined);
        return {
          id: 'blob1',
          done,
          cancel: () => {
            cancelled = true;
          },
        };
      },
      onBlob: handler => {
        phone.blobs.add(handler);
        return () => phone.blobs.delete(handler);
      },
      onBlobProgress: handler => {
        phone.progress.add(handler);
        return () => phone.progress.delete(handler);
      },
    }),
  );
  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };
  return { ports, flush };
}

describe('send a story: answers and failures', () => {
  it('tells the sender when the friend says no', async () => {
    const { ports, flush } = bus();
    const sender = createSendController(ports[0], files(), () => undefined, newId);
    const receiver = createSendController(ports[1], files(), () => undefined, newId);
    const id = await sender.offer('p1', 'b');
    await flush();
    receiver.decline(id);
    await flush();
    expect(receiver.transfers()[0].status).toBe('declined');
    expect(sender.transfers()[0].status).toBe('declined');
  });

  it('lets the sender take an offer back, and ignores the bytes after a cancel', async () => {
    const { ports, flush } = bus();
    const receiverIo = files();
    const sender = createSendController(ports[0], files(), () => undefined, newId);
    const receiver = createSendController(ports[1], receiverIo, () => undefined, newId);
    const id = await sender.offer('p1', 'b');
    await flush();
    sender.cancel(id);
    await flush();
    expect(receiver.transfers()[0].status).toBe('cancelled');
    receiver.accept(id); // too late: nothing happens
    await flush();
    expect(receiverIo.unpack).not.toHaveBeenCalled();
  });

  it('reports a broken import to both phones', async () => {
    const { ports, flush } = bus();
    const sender = createSendController(ports[0], files(), () => undefined, newId);
    const receiver = createSendController(
      ports[1],
      files(async () => {
        throw new Error('bad file');
      }),
      () => undefined,
      newId,
    );
    const id = await sender.offer('p1', 'b');
    await flush();
    receiver.accept(id);
    await flush();
    await flush();
    expect(receiver.transfers()[0].status).toBe('failed');
    expect(sender.transfers()[0].status).toBe('failed');
  });

  it('marks the transfer done on both sides when the import works', async () => {
    const { ports, flush } = bus();
    const sender = createSendController(ports[0], files(), () => undefined, newId);
    const receiver = createSendController(ports[1], files(), () => undefined, newId);
    const id = await sender.offer('p1', 'b');
    await flush();
    receiver.accept(id);
    await flush();
    await flush();
    expect(receiver.transfers()[0]).toMatchObject({ status: 'done', projectId: 'new-story' });
    expect(sender.transfers()[0]).toMatchObject({ status: 'done', progress: 1 });
  });

  it('fails the transfer when the link drops while sending', async () => {
    const { ports, flush } = bus();
    const sender = createSendController(ports[0], { ...files(), pack: async () => ({ base64: 'FAIL', title: 'x', bytes: 10 }) }, () => undefined, newId);
    const receiver = createSendController(ports[1], files(), () => undefined, newId);
    const id = await sender.offer('p1', 'b');
    await flush();
    receiver.accept(id);
    await flush();
    expect(sender.transfers()[0].status).toBe('failed');
    expect(receiver.transfers()[0].status).toBe('failed');
  });

  it('refuses an offer that is too big', async () => {
    const { ports, flush } = bus();
    const receiver = createSendController(ports[1], files(), () => undefined, newId);
    ports[0].send({ t: 'send.offer', from: 'a', blobId: 'huge', title: 'x', bytes: 10 ** 12 }, 'b');
    await flush();
    expect(receiver.transfers()).toEqual([]);
  });
});
