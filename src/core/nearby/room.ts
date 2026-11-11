/**
 * The room as one store: host or join, send messages and blobs, listen for them. The same code runs on
 * real phones (src/state/useRoom.ts) and in tests (loopback.ts); only the network underneath changes.
 *
 * Delivery rule, the same on every phone: a room-wide message (no `to`) reaches every phone's handlers
 * exactly once, the sender's own included, so all phones run the same handler code. A message with `to`
 * reaches only that member.
 */
import { t } from '../i18n';
import { uid } from '../util/id';
import { GuestRefused, GuestSession, type GuestEndReason } from './guestSession';
import { HostSession } from './hostSession';
import { newToken } from './link';
import { BLOB_IDLE_TIMEOUT, BlobAssembler, blobChunks, MAX_CHUNKS, CHUNK_CHARS } from './protocol';
import { realClock, type Advert, type Clock, type Discovery, type Network } from './transport';
import type { Activity, BlobProgress, JoinMode, Member, MemberId, Message, MessageType, NearbyRoom, RoomAddress, RoomBlob, RoomState } from './types';

export type RoomStatus = 'idle' | 'hosting' | 'joining' | 'joined' | 'error';

type Handler = (message: Message, from: MemberId) => void;

export type RoomStoreState = {
  status: RoomStatus;
  me: Member | null;
  room: RoomState | null;
  address: RoomAddress | null;
  error: string | null;
  /** A guest whose link dropped and who is trying to come back. */
  reconnecting: boolean;
  /**
   * The host's clock minus this phone's, in ms (0 on the host, null until the first ping comes back), so
   * timers started by the host end at the same moment everywhere: hostTime = Date.now() + clockOffset.
   */
  clockOffset: number | null;
  /** Who can join the room this phone hosts (see JoinMode). Only meaningful while hosting. */
  joinMode: JoinMode;
  /** `roomName` defaults to `name` (the host's pen name). `joinMode` defaults to code only, the safer choice. */
  hostRoom(name: string, roomName?: string, joinMode?: JoinMode): Promise<RoomAddress>;
  /** Host only: changes who can join and announces the room again, with or without the token. Members stay. */
  setJoinMode(joinMode: JoinMode): void;
  joinRoom(address: RoomAddress, name: string): Promise<void>;
  leaveRoom(): void;
  send(message: Message, to?: MemberId): void;
  onMessage<T extends MessageType>(type: T | '*', handler: (message: Extract<Message, { t: T }>, from: MemberId) => void): () => void;
  sendBlob(kind: RoomBlob['kind'], base64: string, meta?: Record<string, unknown>, to?: MemberId): Promise<string>;
  /**
   * Like sendBlob, but hands back the blob id before the first chunk goes out, a per-transfer progress
   * callback, and `cancel()`, which stops sending (receivers drop the partial blob after BLOB_IDLE_TIMEOUT;
   * tell them sooner with an activity message such as `send.cancel`). `done` rejects with 'cancelled', or
   * with LinkDown when the link it goes out on drops (a guest reconnecting, the target member away).
   */
  startBlob(
    kind: RoomBlob['kind'],
    base64: string,
    options?: { meta?: Record<string, unknown>; to?: MemberId; onProgress?: (done: number, count: number) => void },
  ): OutgoingBlob;
  onBlob(handler: (blob: RoomBlob) => void): () => void;
  onBlobProgress(handler: (progress: BlobProgress) => void): () => void;
  setActivity(activity: Activity, options?: Record<string, unknown>): void;
  /** Watches rooms announced nearby; for useNearbyRooms. A code-only room comes without its token. */
  browse(onChange: (rooms: NearbyRoom[]) => void): () => void;
  /** Clears an error so the hub can be used again. */
  reset(): void;
};

export type OutgoingBlob = { id: string; done: Promise<string>; cancel(): void };

/** The shape of a zustand state creator, spelled out so core does not depend on zustand. */
export type RoomStateCreator = (set: (partial: Partial<RoomStoreState>) => void, get: () => RoomStoreState) => RoomStoreState;

export type RoomDeps = { network: Network; discovery?: Discovery; clock?: Clock; newId?: () => string };

/** A native step that never answers (a stuck socket or network query) must not leave the hub waiting forever. */
const STEP_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const IDLE = {
  status: 'idle' as const,
  me: null,
  room: null,
  address: null,
  error: null,
  reconnecting: false,
  clockOffset: null,
  joinMode: 'code' as JoinMode,
};

/** The advert for a hosted room: a code-only room leaves the token out, so the list alone cannot join it. */
export function advertFor(address: RoomAddress, joinMode: JoinMode): Advert {
  const name = address.name ?? '';
  return joinMode === 'open'
    ? { name, port: address.port, token: address.token, host: address.host }
    : { name, port: address.port, host: address.host };
}

function endMessage(reason: GuestEndReason): string {
  switch (reason) {
    case 'hostLeft':
      return t('The host closed the room.');
    case 'token':
      return t('That room code is not right. Ask the host to show it again.');
    case 'version':
      return t('This room uses a different version of Manganova. Update the app on both phones.');
    case 'full':
      return t('This room is full.');
    case 'started':
      return t('This room is in the middle of an activity. Try again in a moment.');
    case 'unreachable':
      return t("Can't reach that room. Check that both phones are on the same Wi-Fi.");
    case 'lost':
      return t('Lost the connection to the room.');
  }
}

/** Gives every chunk a turn on the event loop, so sending a big story never freezes the screen. */
const yieldToUi = (clock: Clock) => new Promise<void>(resolve => clock.setTimeout(resolve, 0));

export function roomStateCreator(deps: RoomDeps): RoomStateCreator {
  const clock = deps.clock ?? realClock;
  const newId = deps.newId ?? uid;
  return (set, get) => {
    const handlers = new Map<string, Set<Handler>>();
    const blobHandlers = new Set<(blob: RoomBlob) => void>();
    const progressHandlers = new Set<(progress: BlobProgress) => void>();
    const assembler = new BlobAssembler(() => clock.now());
    let host: HostSession | null = null;
    let guest: GuestSession | null = null;
    let unpublish: (() => void) | null = null;
    let advertised: RoomAddress | null = null;
    let sweeper: unknown = null;
    let blobCount = 0;

    // A handler that throws must not stop the others or the transport; the error is rethrown on its own.
    const safely = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        clock.setTimeout(() => {
          throw error;
        }, 0);
      }
    };
    const emitBlob = (blob: RoomBlob) => blobHandlers.forEach(handler => safely(() => handler(blob)));
    const emitProgress = (progress: BlobProgress) => progressHandlers.forEach(handler => safely(() => handler(progress)));

    const deliver = (message: Message, from: MemberId) => {
      if (message.t === 'blob') {
        const result = assembler.accept(message, from);
        if (result.status === 'progress') {
          emitProgress({ id: message.id, from, done: result.done, count: result.count, direction: 'in' });
        } else if (result.status === 'complete') {
          emitProgress({ id: message.id, from, done: message.count, count: message.count, direction: 'in' });
          emitBlob(result.blob);
        }
        return;
      }
      if (message.t === 'bye') {
        assembler.dropFrom(from);
      }
      for (const key of [message.t, '*']) {
        handlers.get(key)?.forEach(handler => safely(() => handler(message, from)));
      }
    };

    const startSweeper = () => {
      sweeper = clock.setInterval(() => assembler.sweep(), BLOB_IDLE_TIMEOUT / 3);
    };

    // Announces the hosted room (again), replacing any earlier advert. Without an advert friends can still
    // join by QR or room code, so a failing discovery is not an error.
    const advertise = (address: RoomAddress, joinMode: JoinMode) => {
      unpublish?.();
      unpublish = null;
      advertised = address;
      try {
        unpublish = deps.discovery?.publish(advertFor(address, joinMode)) ?? null;
      } catch {
        unpublish = null;
      }
    };

    const teardown = () => {
      unpublish?.();
      unpublish = null;
      advertised = null;
      host?.end();
      guest?.leave();
      host = null;
      guest = null;
      if (sweeper) {
        clock.clearInterval(sweeper);
        sweeper = null;
      }
    };

    return {
      ...IDLE,

      async hostRoom(name, roomName, joinMode = 'code') {
        teardown();
        set({ ...IDLE, status: 'hosting' });
        // Any failure on the way must end in 'error': a room stuck in 'hosting' with no room hides the hub.
        const fail = (error: string): never => {
          teardown();
          set({ ...IDLE, status: 'error', error });
          throw new Error(error);
        };
        const ip = await withTimeout(deps.network.localIPv4(), STEP_TIMEOUT_MS).catch(() => null);
        if (!ip) {
          return fail(t('Connect to Wi-Fi to host a room.'));
        }
        const server = await withTimeout(deps.network.listen(), STEP_TIMEOUT_MS).catch(() => null);
        if (!server) {
          return fail(t("Couldn't open a room on this phone. Try again."));
        }
        try {
          const token = newToken();
          const me: Member = { id: newId(), name: name.trim() || t('Host'), color: 0, host: true };
          const title = (roomName ?? name).trim() || me.name;
          host = new HostSession(server, token, me, newId(), title, { deliver, room: room => set({ room }) }, clock, newId);
          const address: RoomAddress = { host: ip, port: server.port, token, name: title };
          advertise(address, joinMode);
          startSweeper();
          set({ status: 'hosting', me, room: host.room, address, error: null, clockOffset: 0, joinMode });
          return address;
        } catch {
          server.close();
          return fail(t("Couldn't open a room on this phone. Try again."));
        }
      },

      async joinRoom(address, name) {
        teardown();
        set({ ...IDLE, status: 'joining', address });
        const session = new GuestSession(
          deps.network,
          address,
          name.trim().slice(0, 40),
          {
            deliver,
            room: (room, meId) => set({ room, me: room.members.find(member => member.id === meId) ?? get().me }),
            reconnecting: active => set({ reconnecting: active }),
            clock: offset => set({ clockOffset: offset }),
            ended: reason => {
              if (guest === session) {
                teardown();
                set({ ...IDLE, status: 'error', error: endMessage(reason) });
              }
            },
          },
          clock,
        );
        guest = session;
        try {
          await session.join();
        } catch (error) {
          if (guest === session) {
            guest = null;
            const reason = error instanceof GuestRefused ? error.reason : 'unreachable';
            set({ ...IDLE, status: 'error', error: endMessage(reason) });
          }
          throw error;
        }
        startSweeper();
        set({ status: 'joined' });
      },

      leaveRoom() {
        teardown();
        set(IDLE);
      },

      reset() {
        if (get().status === 'error') {
          set(IDLE);
        }
      },

      send(message, to) {
        (host ?? guest)?.send(message, to);
      },

      onMessage(type, handler) {
        const set_ = handlers.get(type) ?? new Set<Handler>();
        handlers.set(type, set_);
        set_.add(handler as Handler);
        return () => set_.delete(handler as Handler);
      },

      sendBlob(kind, base64, meta, to) {
        try {
          return get().startBlob(kind, base64, { meta, to }).done;
        } catch (error) {
          return Promise.reject(error);
        }
      },

      startBlob(kind, base64, options = {}) {
        const { meta, to, onProgress } = options;
        const session = host ?? guest;
        const me = get().me;
        if (!session || !me) {
          throw new Error('not in a room');
        }
        if (Math.ceil(base64.length / CHUNK_CHARS) > MAX_CHUNKS) {
          throw new Error('blob too large');
        }
        blobCount += 1;
        const id = `${me.id}.${blobCount}.${newId()}`;
        let cancelled = false;
        const run = async () => {
          let done = 0;
          for (const chunk of blobChunks(id, kind, base64, meta)) {
            // A session that ended (room left) also stops the transfer.
            if (cancelled || session !== (host ?? guest)) {
              throw new Error('cancelled');
            }
            // False is a full socket: wait for room. A dropped link throws LinkDown instead, failing `done`.
            if (!session.sendChunk(chunk, to)) {
              await session.drained(to);
            }
            done++;
            emitProgress({ id, from: me.id, done, count: chunk.count, direction: 'out' });
            if (onProgress) {
              safely(() => onProgress(done, chunk.count));
            }
            await yieldToUi(clock);
          }
          if (to === undefined || to === me.id) {
            emitBlob(meta ? { id, kind, data: base64, meta, from: me.id } : { id, kind, data: base64, from: me.id });
          }
          return id;
        };
        const done = run();
        // Marked handled so a cancelled transfer nobody awaits does not warn; awaiting it still rejects.
        done.catch(() => undefined);
        return {
          id,
          done,
          cancel: () => {
            cancelled = true;
          },
        };
      },

      onBlob(handler) {
        blobHandlers.add(handler);
        return () => blobHandlers.delete(handler);
      },

      onBlobProgress(handler) {
        progressHandlers.add(handler);
        return () => progressHandlers.delete(handler);
      },

      setJoinMode(joinMode) {
        if (!host || !advertised || get().joinMode === joinMode) {
          return;
        }
        advertise(advertised, joinMode);
        set({ joinMode });
      },

      setActivity(activity, options) {
        host?.setRoom({ activity, options: options ?? {} });
      },

      browse(onChange) {
        return deps.discovery ? deps.discovery.browse(onChange) : () => undefined;
      },
    };
  };
}
