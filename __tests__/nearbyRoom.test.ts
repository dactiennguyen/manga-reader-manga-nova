import { createLoopbackPhones } from '../src/core/nearby/loopback';
import { realClock, type Clock } from '../src/core/nearby/transport';
import { APP_ID, CHUNK_CHARS, encodeLine, LineReader } from '../src/core/nearby/protocol';
import { PROTOCOL_VERSION, type Activity, type Message, type MemberId, type RoomBlob } from '../src/core/nearby/types';
import { shouldFollow } from '../src/features/nearby/activities';

async function room(count: number, options: { fragment?: boolean; clock?: Clock } = {}) {
  const setup = createLoopbackPhones(count, options);
  const [host, ...guests] = setup.phones;
  const address = await host.getState().hostRoom('Mai');
  for (const [index, guest] of guests.entries()) {
    await guest.getState().joinRoom(address, `Guest${index + 1}`);
  }
  await setup.flush();
  return { ...setup, host, guests, address };
}

describe('nearby room over the loopback', () => {
  it('lets two guests join with distinct colours, and every phone sees the same room', async () => {
    const { host, guests, phones } = await room(3);
    const members = host.getState().room!.members;
    expect(members.map(member => member.name)).toEqual(['Mai', 'Guest1', 'Guest2']);
    expect(new Set(members.map(member => member.color)).size).toBe(3);
    for (const phone of phones) {
      expect(phone.getState().room!.members).toEqual(members);
    }
    expect(guests[0].getState().status).toBe('joined');
    expect(guests[0].getState().me!.name).toBe('Guest1');
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('delivers a room-wide message once to every phone, the sender included, with a trusted sender', async () => {
    const { phones, guests, flush } = await room(3, { fragment: true });
    const got: [number, Message, MemberId][] = [];
    phones.forEach((phone, index) => phone.getState().onMessage('codraw.react', (message, from) => got.push([index, message, from])));
    guests[0].getState().send({ t: 'codraw.react', from: 'someone-else', emoji: '👏' });
    await flush();
    const sender = guests[0].getState().me!.id;
    expect(got.map(([index]) => index).sort()).toEqual([0, 1, 2]);
    // The sender's copy is local; the relayed ones carry the real sender, whatever it claimed.
    for (const [, message, from] of got) {
      expect(from).toBe(sender);
      expect(message).toMatchObject({ from: sender, emoji: '👏' });
    }
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('sends a direct message only to its target', async () => {
    const { phones, guests, flush } = await room(3);
    const seen: number[] = [];
    phones.forEach((phone, index) => phone.getState().onMessage('*', () => seen.push(index)));
    guests[0].getState().send({ t: 'relay.reveal' }, guests[1].getState().me!.id);
    await flush();
    expect(seen).toEqual([2]);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('moves every guest to the activity the host picks', async () => {
    const { host, guests, flush, phones } = await room(3);
    host.getState().setActivity('battle', { seconds: 180 });
    await flush();
    for (const guest of guests) {
      expect(guest.getState().room).toMatchObject({ activity: 'battle', options: { seconds: 180 } });
    }
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('carries a multi-chunk blob from a guest to everyone, intact', async () => {
    const { phones, guests, flush } = await room(3, { fragment: true });
    const data = 'QUJD'.repeat(Math.ceil((CHUNK_CHARS * 2.5) / 4));
    const got: RoomBlob[][] = phones.map(() => []);
    phones.forEach((phone, index) => phone.getState().onBlob(blob => got[index].push(blob)));
    const id = await guests[1].getState().sendBlob('page', data, { panel: 2 });
    await flush();
    for (const list of got) {
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id, kind: 'page', meta: { panel: 2 }, from: guests[1].getState().me!.id });
      expect(list[0].data).toBe(data);
    }
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('removes a guest who leaves and tells the others', async () => {
    const { host, guests, flush, phones } = await room(3);
    const byes: MemberId[] = [];
    guests[1].getState().onMessage('bye', message => byes.push(message.from));
    const leaving = guests[0].getState().me!.id;
    guests[0].getState().leaveRoom();
    await flush();
    expect(host.getState().room!.members.map(member => member.id)).not.toContain(leaving);
    expect(guests[1].getState().room!.members).toHaveLength(2);
    expect(byes).toEqual([leaving]);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('ends the room for everyone when the host leaves', async () => {
    const { host, guests, flush } = await room(3);
    host.getState().leaveRoom();
    await flush();
    for (const guest of guests) {
      expect(guest.getState().status).toBe('error');
      expect(guest.getState().error).toMatch(/host closed/);
    }
  });

  it('refuses a wrong token', async () => {
    const setup = createLoopbackPhones(2);
    const address = await setup.phones[0].getState().hostRoom('Mai');
    const wrong = { ...address, token: address.token === 'aaaa' ? 'bbbb' : 'aaaa' };
    await expect(setup.phones[1].getState().joinRoom(wrong, 'Ken')).rejects.toThrow('token');
    expect(setup.phones[1].getState().status).toBe('error');
    expect(setup.phones[1].getState().error).toMatch(/room code/);
    expect(setup.phones[0].getState().room!.members).toHaveLength(1);
    setup.phones[0].getState().leaveRoom();
  });

  it('refuses an app speaking another protocol version', async () => {
    const setup = createLoopbackPhones(2);
    const address = await setup.phones[0].getState().hostRoom('Mai');
    const connection = await setup.network.phone(setup.ip(1)).connect(address.host, address.port, 1000);
    const lines: string[] = [];
    const reader = new LineReader(line => lines.push(line), () => undefined);
    connection.onData(bytes => reader.push(bytes));
    connection.onDrain(() => undefined);
    connection.onClose(() => undefined);
    connection.write(encodeLine({ m: { t: 'hello', v: 999, token: address.token, name: 'Old', app: APP_ID } }));
    await setup.flush();
    expect(lines.map(line => JSON.parse(line).m)).toEqual([{ t: 'refused', reason: 'version' }]);
    expect(setup.phones[0].getState().room!.members).toHaveLength(1);
    setup.phones[0].getState().leaveRoom();
  });

  it('lets a guest come back as the same member after a Wi-Fi blink', async () => {
    const { host, guests, network, ip, flush, phones } = await room(2);
    const before = guests[0].getState().me!;
    network.cut(ip(1));
    await flush();
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    await flush();
    expect(guests[0].getState().status).toBe('joined');
    expect(guests[0].getState().me).toEqual(before);
    expect(host.getState().room!.members).toHaveLength(2);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('lists hosted rooms through discovery', async () => {
    const setup = createLoopbackPhones(2);
    const seen: string[][] = [];
    const stop = setup.phones[1].getState().browse(rooms => seen.push(rooms.map(item => item.name ?? '')));
    await setup.phones[0].getState().hostRoom('Mai', 'Ink club');
    expect(seen[seen.length - 1]).toEqual(['Ink club']);
    setup.phones[0].getState().leaveRoom();
    expect(seen[seen.length - 1]).toEqual([]);
    stop();
  });

  it('hands out the blob id before sending, reports progress per transfer, and can cancel', async () => {
    const { phones, guests, flush, host } = await room(2);
    const data = 'QUJD'.repeat(Math.ceil((CHUNK_CHARS * 4) / 4));
    const got: RoomBlob[] = [];
    host.getState().onBlob(blob => got.push(blob));
    const steps: number[] = [];
    const sending = guests[0].getState().startBlob('story', data, { onProgress: done => steps.push(done) });
    expect(sending.id).toMatch(/\./);
    await expect(sending.done).resolves.toBe(sending.id);
    expect(steps).toEqual([1, 2, 3, 4]);
    const stopped = guests[0].getState().startBlob('story', data, { to: host.getState().me!.id });
    stopped.cancel();
    await expect(stopped.done).rejects.toThrow('cancelled');
    await flush();
    expect(got.map(blob => blob.id)).toEqual([sending.id]);
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('blobs when a link drops', () => {
  const big = 'QUJD'.repeat(Math.ceil((CHUNK_CHARS * 6) / 4));
  // A guest's wait between reconnect tries outlives leaving the room; it must not hold jest open.
  const clock: Clock = {
    ...realClock,
    setTimeout: (fn, ms) => {
      const handle = setTimeout(fn, ms) as unknown as { unref?: () => void };
      handle.unref?.();
      return handle;
    },
  };

  it('fails a guest blob while the guest is reconnecting, instead of reporting it sent', async () => {
    const { phones, guests, network, ip, flush } = await room(2, { clock });
    const sending = guests[0].getState().startBlob('story', big);
    network.setOffline(ip(1), true);
    network.cut(ip(1));
    await expect(sending.done).rejects.toThrow('link down');
    expect(guests[0].getState().reconnecting).toBe(true);
    network.setOffline(ip(1), false);
    await flush();
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('fails a host blob to a member who is away in the rejoin grace', async () => {
    const { phones, host, guests, network, ip, flush } = await room(2, { clock });
    const target = guests[0].getState().me!.id;
    const sending = host.getState().startBlob('story', big, { to: target });
    network.setOffline(ip(1), true);
    network.cut(ip(1));
    await expect(sending.done).rejects.toThrow('link down');
    // The member keeps their place for now; only the transfer failed.
    expect(host.getState().room!.members.map(member => member.id)).toContain(target);
    await expect(host.getState().sendBlob('page', 'QUJD', undefined, target)).rejects.toThrow('link down');
    network.setOffline(ip(1), false);
    await flush();
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('rejoining', () => {
  it('does not let a rejoin take the place of a member who is still connected', async () => {
    // Another guest's phone claims the first guest's id.
    const { host, guests, network, ip, address, flush, phones } = await room(3);
    const victim = guests[0].getState().me!.id;
    const connection = await network.phone(ip(2)).connect(address.host, address.port, 1000);
    const lines: string[] = [];
    const reader = new LineReader(line => lines.push(line), () => undefined);
    connection.onData(bytes => reader.push(bytes));
    connection.onDrain(() => undefined);
    connection.onClose(() => undefined);
    connection.write(encodeLine({ m: { t: 'hello', v: PROTOCOL_VERSION, token: address.token, name: 'Sly', app: APP_ID, rejoin: victim } }));
    await flush();
    const welcome = lines.map(line => JSON.parse(line).m).find(message => message.t === 'welcome');
    expect(welcome.you).not.toBe(victim);
    expect(host.getState().room!.members.map(member => member.name)).toEqual(['Mai', 'Guest1', 'Guest2', 'Sly']);
    // Messages for the real member still reach the real member.
    const got: string[] = [];
    guests[0].getState().onMessage('relay.reveal', message => got.push(message.t));
    host.getState().send({ t: 'relay.reveal' }, victim);
    await flush();
    expect(got).toEqual(['relay.reveal']);
    connection.close();
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('rejoining from the same phone', () => {
  it('takes the member back when its old link is not known to be dead yet', async () => {
    const { host, guests, network, ip, address, flush, phones } = await room(2);
    const me = guests[0].getState().me!;
    const connection = await network.phone(ip(1)).connect(address.host, address.port, 1000);
    const lines: string[] = [];
    const reader = new LineReader(line => lines.push(line), () => undefined);
    connection.onData(bytes => reader.push(bytes));
    connection.onDrain(() => undefined);
    connection.onClose(() => undefined);
    connection.write(encodeLine({ m: { t: 'hello', v: PROTOCOL_VERSION, token: address.token, name: 'Guest1', app: APP_ID, rejoin: me.id } }));
    await flush();
    const welcome = lines.map(line => JSON.parse(line).m).find(message => message.t === 'welcome');
    expect(welcome.you).toBe(me.id);
    expect(host.getState().room!.members.map(member => [member.name, member.color])).toEqual([
      ['Mai', host.getState().me!.color],
      ['Guest1', me.color],
    ]);
    connection.close();
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('room timing and order', () => {
  it('knows the host clock on guests after joining', async () => {
    const { host, guests, flush, phones } = await room(2);
    await flush();
    expect(host.getState().clockOffset).toBe(0);
    expect(Math.abs(guests[0].getState().clockOffset ?? 999)).toBeLessThan(50);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('relays a guest message to the others before the host reacts to it', async () => {
    const { host, guests, flush, phones } = await room(3);
    host.getState().onMessage('battle.submit', () => host.getState().send({ t: 'battle.result', scores: {} }));
    const seen: string[] = [];
    guests[1].getState().onMessage('*', message => seen.push(message.t));
    guests[0].getState().send({ t: 'battle.submit', from: '', blobId: 'b1' });
    await flush();
    expect(seen).toEqual(['battle.submit', 'battle.result']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('following the host', () => {
  const roomOf = (activity: Activity, options: Record<string, unknown> = {}, roomId = 'r1') => ({
    roomId,
    name: 'Room',
    members: [],
    activity,
    options,
  });

  it('moves on a new activity or on joining mid-activity, never on new options alone', () => {
    const joined = (activity: Activity, options?: Record<string, unknown>) => ({ status: 'joined' as const, room: roomOf(activity, options) });
    expect(shouldFollow(joined('lobby'), joined('read', { page: 1 }))).toBe(true);
    expect(shouldFollow(joined('read', { page: 1 }), joined('read', { page: 2 }))).toBe(false);
    expect(shouldFollow(joined('read'), joined('lobby'))).toBe(true);
    expect(shouldFollow({ status: 'joining', room: roomOf('battle') }, joined('battle'))).toBe(true);
    expect(shouldFollow({ status: 'joining', room: roomOf('lobby') }, joined('lobby'))).toBe(false);
    expect(shouldFollow(joined('battle'), { status: 'error', room: null })).toBe(false);
  });
});

