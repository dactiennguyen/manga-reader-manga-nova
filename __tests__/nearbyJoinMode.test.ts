import { PROTOCOL_VERSION } from '../src/core/nearby/types';
import { listingAddress, listingCodePrefix, parseListingCode, roomCode, roomLink, parseRoomLink } from '../src/core/nearby/link';
import { createLoopbackPhones } from '../src/core/nearby/loopback';
import { roomStateCreator, type RoomStoreState } from '../src/core/nearby/room';
import type { Advert, Discovery } from '../src/core/nearby/transport';
import type { NearbyRoom } from '../src/core/nearby/types';

function latest(seen: NearbyRoom[][]): NearbyRoom[] {
  return seen[seen.length - 1];
}

describe('who can join a nearby room', () => {
  it('advertises a code-only room without its token, by default', async () => {
    const { phones, network } = createLoopbackPhones(2);
    const seen: NearbyRoom[][] = [];
    const stop = phones[1].getState().browse(rooms => seen.push(rooms));
    const address = await phones[0].getState().hostRoom('Mai', 'Ink club');
    expect(phones[0].getState().joinMode).toBe('code');
    expect(network.published()).toEqual([{ name: 'Ink club', port: address.port, host: address.host }]);
    expect(JSON.stringify(network.published())).not.toContain(address.token);
    // Still listed, but with no token, so the list alone cannot join it.
    expect(latest(seen)).toEqual([{ host: address.host, port: address.port, token: null, name: 'Ink club' }]);
    expect(listingAddress(latest(seen)[0])).toBeNull();
    stop();
    phones[0].getState().leaveRoom();
  });

  it('advertises an open room with its token, and a tap joins it', async () => {
    const { phones, network, flush } = createLoopbackPhones(2);
    const seen: NearbyRoom[][] = [];
    const stop = phones[1].getState().browse(rooms => seen.push(rooms));
    const address = await phones[0].getState().hostRoom('Mai', 'Ink club', 'open');
    expect(network.published()).toEqual([{ name: 'Ink club', port: address.port, host: address.host, token: address.token }]);
    const tapped = listingAddress(latest(seen)[0]);
    expect(tapped).toEqual(address);
    await phones[1].getState().joinRoom(tapped!, 'Ken');
    await flush();
    expect(phones[0].getState().room!.members.map(member => member.name)).toEqual(['Mai', 'Ken']);
    stop();
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('re-publishes the advert when the host switches, and keeps the members', async () => {
    const { phones, network, flush } = createLoopbackPhones(2);
    const host = phones[0];
    const address = await host.getState().hostRoom('Mai', 'Ink club', 'open');
    await phones[1].getState().joinRoom(address, 'Ken');
    await flush();
    const seen: NearbyRoom[][] = [];
    const stop = phones[1].getState().browse(rooms => seen.push(rooms));
    expect(latest(seen)[0].token).toBe(address.token);

    host.getState().setJoinMode('code');
    expect(host.getState().joinMode).toBe('code');
    expect(network.published()).toEqual([{ name: 'Ink club', port: address.port, host: address.host }]);
    expect(latest(seen)).toEqual([{ host: address.host, port: address.port, token: null, name: 'Ink club' }]);

    host.getState().setJoinMode('open');
    expect(network.published()).toEqual([{ name: 'Ink club', port: address.port, host: address.host, token: address.token }]);
    expect(latest(seen)[0].token).toBe(address.token);

    await flush();
    // The guest who was already in never noticed.
    expect(phones[1].getState().status).toBe('joined');
    expect(host.getState().room!.members.map(member => member.name)).toEqual(['Mai', 'Ken']);
    // The host's own address (QR, room code) keeps its token whatever the mode.
    expect(host.getState().address).toEqual(address);
    stop();
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('withdraws the old advert before publishing the new one, and only when the mode changes', async () => {
    const calls: string[] = [];
    const discovery: Discovery = {
      publish(advert: Advert) {
        calls.push(`publish ${advert.token ? 'open' : 'code'}`);
        return () => calls.push('unpublish');
      },
      browse: () => () => undefined,
    };
    const { network } = createLoopbackPhones(0);
    let state: RoomStoreState;
    state = roomStateCreator({ network: network.phone('192.168.1.10'), discovery })(
      patch => {
        state = { ...state, ...patch };
      },
      () => state,
    );
    await state.hostRoom('Mai');
    state.setJoinMode('code');
    state.setJoinMode('open');
    state.setJoinMode('code');
    state.leaveRoom();
    expect(calls).toEqual(['publish code', 'unpublish', 'publish open', 'unpublish', 'publish code', 'unpublish']);
  });

  it('does not let a guest join a locked listing without the code, and does with it', async () => {
    const { phones, flush } = createLoopbackPhones(2);
    const seen: NearbyRoom[][] = [];
    const stop = phones[1].getState().browse(rooms => seen.push(rooms));
    const address = await phones[0].getState().hostRoom('Mai', 'Ink club');
    const listed = latest(seen)[0];
    expect(listingAddress(listed)).toBeNull();
    // Nothing typed yet, or the empty token a tampered app might send: no way in.
    expect(parseListingCode(listingCodePrefix(listed)!, listed)).toBeNull();
    await expect(phones[1].getState().joinRoom({ host: listed.host, port: listed.port, token: '' }, 'Ken')).rejects.toThrow('token');
    expect(phones[1].getState().error).toMatch(/room code/);
    expect(phones[0].getState().room!.members).toHaveLength(1);

    // The filled-in start plus the last 4 characters from the host's screen.
    const code = roomCode(address)!;
    const typed = listingCodePrefix(listed)! + code.slice(-4);
    expect(typed).toBe(code);
    const withCode = parseListingCode(typed, listed);
    expect(withCode).toEqual(address);
    phones[1].getState().reset();
    await phones[1].getState().joinRoom(withCode!, 'Ken');
    await flush();
    expect(phones[0].getState().room!.members.map(member => member.name)).toEqual(['Mai', 'Ken']);
    stop();
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('keeps the QR link and the typed room code working in code-only mode', async () => {
    const { phones, flush } = createLoopbackPhones(3);
    const address = await phones[0].getState().hostRoom('Mai');
    await phones[1].getState().joinRoom(parseRoomLink(roomLink(address))!, 'Ken');
    const listed: NearbyRoom = { host: address.host, port: address.port, token: null };
    await phones[2].getState().joinRoom(parseListingCode(roomCode(address)!, listed)!, 'Aya');
    await flush();
    expect(phones[0].getState().room!.members.map(member => member.name)).toEqual(['Mai', 'Ken', 'Aya']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('reading a code typed for a listed room', () => {
  const room: NearbyRoom = { host: '192.168.1.42', port: 51234, token: null, name: 'Ink club' };
  const address = { host: '192.168.1.42', port: 51234, token: 'a1b2', name: 'Ink club' };
  const code = roomCode(address)!;

  it('fills in the part that comes from the host address and port, whatever the token', () => {
    expect(listingCodePrefix(room)).toBe(code.slice(0, 7));
    expect(roomCode({ ...address, token: 'ffff' })!.slice(0, 7)).toBe(code.slice(0, 7));
    expect(roomCode({ ...address, token: '0000' })!.slice(0, 7)).toBe(code.slice(0, 7));
  });

  it('accepts the whole code, the last 4 alone, or a whole code typed after the filled-in start', () => {
    expect(parseListingCode(code, room)).toEqual(address);
    expect(parseListingCode(code.slice(-4).toLowerCase(), room)).toEqual(address);
    expect(parseListingCode(`${code.slice(0, 7)}${code}`, room)).toEqual(address);
    expect(parseListingCode('ABC', room)).toBeNull();
    expect(parseListingCode('', room)).toBeNull();
  });

  it('follows a code for another room on the same Wi-Fi, without the tapped name', () => {
    const other = roomCode({ host: '192.168.3.7', port: 4000, token: '0f0f' })!;
    expect(parseListingCode(other, room)).toEqual({ host: '192.168.3.7', port: 4000, token: '0f0f' });
  });
});

describe('nearby discovery adverts', () => {
  const { roomsFrom, txtFor } = require('../src/native/nearby/discovery') as typeof import('../src/native/nearby/discovery');
  const base = { fullName: '', host: '', addresses: [], ipv6: [] };

  it('puts the token in the TXT record only for an open room', () => {
    expect(txtFor({ name: 'Ink club', port: 5000, token: '1a2b' })).toEqual({ app: 'manganova', v: PROTOCOL_VERSION, n: 'Ink club', k: '1a2b' });
    const locked = txtFor({ name: 'Ink club', port: 5000 });
    expect(locked).toEqual({ app: 'manganova', v: PROTOCOL_VERSION, n: 'Ink club', lock: '1' });
    expect(locked).not.toHaveProperty('k');
  });

  it('lists a locked room without a token and skips adverts that are neither open nor locked', () => {
    const rooms = roomsFrom([
      { ...base, name: 'Mai x1', port: 5000, ipv4: ['192.168.1.20'], txt: { app: 'manganova', v: '1', lock: '1', n: 'Ink club' } },
      { ...base, name: 'Ken y2', port: 5001, ipv4: ['192.168.1.21'], txt: { app: 'manganova', v: '1', k: 'beef', n: 'Ken' } },
      { ...base, name: 'odd', port: 5002, ipv4: ['192.168.1.22'], txt: { app: 'manganova', v: '1', n: 'Odd' } },
    ]);
    expect(rooms).toEqual([
      { host: '192.168.1.20', port: 5000, token: null, name: 'Ink club' },
      { host: '192.168.1.21', port: 5001, token: 'beef', name: 'Ken' },
    ]);
  });

  it('lists a room once when its old open advert lingers next to the new locked one', () => {
    const open = { ...base, name: 'Mai a1', port: 5000, ipv4: ['192.168.1.20'], txt: { app: 'manganova', v: '1', k: 'beef', n: 'Ink club' } };
    const locked = { ...base, name: 'Mai b2', port: 5000, ipv4: ['192.168.1.20'], txt: { app: 'manganova', v: '1', lock: '1', n: 'Ink club' } };
    const expected = [{ host: '192.168.1.20', port: 5000, token: null, name: 'Ink club' }];
    expect(roomsFrom([open, locked])).toEqual(expected);
    expect(roomsFrom([locked, open])).toEqual(expected);
  });
});
