/**
 * An in-memory network with any number of virtual phones, for tests: real room code on top, fake wires
 * underneath. Bytes arrive asynchronously and, with `fragment`, in odd-sized pieces, like real TCP.
 *
 *   const { phones, flush } = createLoopbackPhones(3);
 *   const address = await phones[0].getState().hostRoom('Mai');
 *   await phones[1].getState().joinRoom(address, 'Ken');
 *   phones[1].getState().send({ t: 'codraw.react', from: '', emoji: '👏' });
 *   await flush();
 */
import { roomStateCreator, type RoomStateCreator, type RoomStoreState } from './room';
import { realClock, type Advert, type Clock, type Connection, type Discovery, type Network, type Server } from './transport';
import type { NearbyRoom } from './types';

type End = {
  remote: string;
  ip: string;
  peer?: End;
  data?: (bytes: Uint8Array) => void;
  close?: () => void;
  closed: boolean;
  /** Bytes written before the other side attached its listener. */
  backlog: Uint8Array[];
};

export type LoopbackNetwork = {
  /** The network as seen from the phone with this IP address. */
  phone(ip: string): Network;
  discovery(): Discovery;
  /** The adverts announced right now, exactly as the hosts published them. */
  published(): Advert[];
  /** Breaks every link of this phone, like a Wi-Fi blink. */
  cut(ip: string): void;
  /** While offline, the phone can neither connect nor be reached. */
  setOffline(ip: string, offline: boolean): void;
};

export function createLoopbackNetwork(options: { fragment?: boolean } = {}): LoopbackNetwork {
  const servers = new Map<string, { onConnection?: (connection: Connection) => void }>();
  const ends = new Set<End>();
  const offline = new Set<string>();
  const adverts = new Set<Advert>();
  const watchers = new Set<() => void>();
  let nextPort = 40000;

  const later = (fn: () => void) => Promise.resolve().then(fn);

  const deliver = (end: End, bytes: Uint8Array) => {
    if (end.data) {
      end.data(bytes);
    } else {
      end.backlog.push(bytes);
    }
  };

  // Like TCP, bytes already written still arrive before the other side hears the link close.
  const shut = (end: End) => {
    if (end.closed) {
      return;
    }
    end.closed = true;
    ends.delete(end);
    later(() => {
      end.close?.();
      const peer = end.peer;
      if (peer && !peer.closed) {
        peer.closed = true;
        ends.delete(peer);
        peer.close?.();
      }
    });
  };

  const connection = (end: End): Connection => ({
    remote: end.remote,
    write(bytes) {
      const peer = end.peer;
      if (end.closed || !peer || peer.closed) {
        return true;
      }
      const copy = bytes.slice();
      const pieces: Uint8Array[] = [];
      if (options.fragment) {
        for (let at = 0; at < copy.length; ) {
          const size = 1 + Math.floor(Math.random() * 700);
          pieces.push(copy.subarray(at, at + size));
          at += size;
        }
      } else {
        pieces.push(copy);
      }
      later(() => pieces.forEach(piece => !peer.closed && deliver(peer, piece)));
      return true;
    },
    onData(handler) {
      end.data = handler;
      const backlog = end.backlog;
      end.backlog = [];
      backlog.forEach(handler);
    },
    onDrain() {},
    onClose(handler) {
      end.close = handler;
    },
    close: () => shut(end),
  });

  const discovery = (): Discovery => ({
    publish(advert) {
      adverts.add(advert);
      watchers.forEach(notify => notify());
      return () => {
        adverts.delete(advert);
        watchers.forEach(notify => notify());
      };
    },
    browse(onChange) {
      const notify = () =>
        onChange([...adverts].map((ad): NearbyRoom => ({ host: ad.host ?? '', port: ad.port, token: ad.token ?? null, name: ad.name })));
      watchers.add(notify);
      notify();
      return () => watchers.delete(notify);
    },
  });

  return {
    phone(ip) {
      return {
        async listen(): Promise<Server> {
          const port = nextPort++;
          const entry: { onConnection?: (connection: Connection) => void } = {};
          servers.set(`${ip}:${port}`, entry);
          return {
            port,
            onConnection: handler => {
              entry.onConnection = handler;
            },
            close: () => servers.delete(`${ip}:${port}`),
          };
        },
        async connect(host, port) {
          await later(() => undefined);
          const server = servers.get(`${host}:${port}`);
          if (!server?.onConnection || offline.has(ip) || offline.has(host)) {
            throw new Error('ECONNREFUSED');
          }
          const mine: End = { remote: host, ip, closed: false, backlog: [] };
          const theirs: End = { remote: ip, ip: host, closed: false, backlog: [], peer: mine };
          mine.peer = theirs;
          ends.add(mine);
          ends.add(theirs);
          server.onConnection(connection(theirs));
          return connection(mine);
        },
        async localIPv4() {
          return offline.has(ip) ? null : ip;
        },
      };
    },
    discovery,
    published: () => [...adverts],
    cut(ip) {
      [...ends].filter(end => end.ip === ip).forEach(shut);
    },
    setOffline(ip, value) {
      if (value) {
        offline.add(ip);
      } else {
        offline.delete(ip);
      }
    },
  };
}

/** Same surface as a zustand store (getState, setState, subscribe), so zustand's useStore works on it too. */
export type RoomStore = {
  getState(): RoomStoreState;
  getInitialState(): RoomStoreState;
  setState(partial: Partial<RoomStoreState> | ((state: RoomStoreState) => Partial<RoomStoreState>), replace?: boolean): void;
  subscribe(listener: (state: RoomStoreState, previous: RoomStoreState) => void): () => void;
};

function createRoomStore(creator: RoomStateCreator): RoomStore {
  const listeners = new Set<(state: RoomStoreState, previous: RoomStoreState) => void>();
  let state: RoomStoreState;
  const setState: RoomStore['setState'] = (partial, replace) => {
    const previous = state;
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = replace ? (next as RoomStoreState) : { ...state, ...next };
    listeners.forEach(listener => listener(state, previous));
  };
  state = creator(partial => setState(partial), () => state);
  const initial = state;
  return {
    getState: () => state,
    getInitialState: () => initial,
    setState,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type LoopbackPhones = {
  phones: RoomStore[];
  network: LoopbackNetwork;
  /** The IP address of phone i (192.168.1.10, .11, ...). */
  ip(index: number): string;
  /** Lets every queued byte arrive and every handler run. */
  flush(): Promise<void>;
};

/** N phones on one Wi-Fi, each with its own room store. Phone 0 usually hosts. */
export function createLoopbackPhones(count: number, options: { fragment?: boolean; clock?: Clock } = {}): LoopbackPhones {
  const network = createLoopbackNetwork(options);
  const ip = (index: number) => `192.168.1.${10 + index}`;
  const discovery = network.discovery();
  const phones = Array.from({ length: count }, (_, index) =>
    createRoomStore(roomStateCreator({ network: network.phone(ip(index)), discovery, clock: options.clock ?? realClock })),
  );
  const flush = async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise<void>(resolve => (options.clock ?? realClock).setTimeout(resolve, 0));
    }
  };
  return { phones, network, ip, flush };
}
