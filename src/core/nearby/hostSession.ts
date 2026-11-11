/**
 * The hosting phone: accepts guests (right token and protocol version only), gives each a member id and a
 * colour, relays room-wide messages, and keeps a dropped guest's place for a few seconds so a Wi-Fi blink
 * does not throw them out.
 */
import { LinkDown, openChannel, type Channel } from './channel';
import { MEMBER_COLORS } from './colors';
import { APP_ID, HEARTBEAT_TIMEOUT, MAX_MEMBERS, PING_EVERY, REJOIN_GRACE, versionOk } from './protocol';
import type { Clock, Connection, Server } from './transport';
import { PROTOCOL_VERSION, type Envelope, type Member, type MemberId, type Message, type RoomState } from './types';

export type SessionEvents = {
  deliver(message: Message, from: MemberId): void;
  room(room: RoomState): void;
};

type Peer = { channel: Channel; member: Member; lastSeen: number };

const HELLO_TIMEOUT = 5000;
const MAX_WRONG_TOKENS = 5;
const WRONG_TOKEN_COOLDOWN = 60000;
const MEMBER_COLOR_COUNT = MEMBER_COLORS.length;

/** Messages a guest may never send on the host's behalf. */
const HOST_ONLY = new Set<Message['t']>(['hello', 'welcome', 'refused', 'room', 'ping', 'pong', 'bye']);

export function freeColor(members: Member[]): number {
  const used = new Set(members.map(member => member.color));
  for (let color = 0; color < MEMBER_COLOR_COUNT; color++) {
    if (!used.has(color)) {
      return color;
    }
  }
  return members.length % MEMBER_COLOR_COUNT;
}

export class HostSession {
  private peers = new Map<MemberId, Peer>();
  private away = new Map<MemberId, unknown>();
  private wrongTokens = new Map<string, { count: number; until: number }>();
  private heartbeat: unknown;
  private ended = false;
  room: RoomState;

  constructor(
    private readonly server: Server,
    private readonly token: string,
    readonly me: Member,
    roomId: string,
    roomName: string,
    private readonly events: SessionEvents,
    private readonly clock: Clock,
    private readonly newId: () => string,
  ) {
    this.room = { roomId, name: roomName, members: [me], activity: 'lobby', options: {} };
    server.onConnection(connection => this.accept(connection));
    this.heartbeat = clock.setInterval(() => this.checkHeartbeats(), PING_EVERY);
  }

  /** Room-wide (no `to`): every phone's handlers get it once, the host's included. */
  send(original: Message, to?: MemberId): boolean {
    const message = ('from' in original ? { ...original, from: this.me.id } : original) as Message;
    if (to === undefined || to === this.me.id) {
      this.events.deliver(message, this.me.id);
    }
    if (to === this.me.id) {
      return true;
    }
    return this.forward({ m: message, from: this.me.id }, to, undefined);
  }

  /**
   * Sends a blob chunk; false means a socket is full and the caller should wait for `drained`. A chunk for
   * one member throws LinkDown when that member has no live link (away in the rejoin grace, or gone): the
   * chunks would vanish. A room-wide blob goes on to whoever is connected.
   */
  sendChunk(message: Message, to?: MemberId): boolean {
    if (to === this.me.id) {
      return true;
    }
    if (to !== undefined) {
      this.livePeer(to);
    }
    return this.forward({ m: message, from: this.me.id }, to, undefined);
  }

  async drained(to?: MemberId): Promise<void> {
    if (to === undefined) {
      await Promise.all([...this.peers.values()].map(peer => peer.channel.drained()));
      return;
    }
    if (to === this.me.id) {
      return;
    }
    const peer = this.livePeer(to);
    await peer.channel.drained();
    // The wait also ends when the link closes; then the chunks it held are lost.
    if (peer.channel.closed || this.peers.get(to) !== peer) {
      throw new LinkDown();
    }
  }

  setRoom(patch: Partial<Pick<RoomState, 'activity' | 'options' | 'name'>>): void {
    this.room = { ...this.room, ...patch };
    this.broadcastRoom();
  }

  /** Ends the room for everyone: each guest is told before the links close. */
  end(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.clock.clearInterval(this.heartbeat);
    this.away.forEach(timer => this.clock.clearTimeout(timer));
    for (const peer of this.peers.values()) {
      peer.channel.send({ m: { t: 'bye', from: this.me.id }, from: this.me.id });
      peer.channel.close();
    }
    this.peers.clear();
    this.server.close();
  }

  private livePeer(id: MemberId): Peer {
    const peer = this.peers.get(id);
    if (!peer || peer.channel.closed) {
      throw new LinkDown();
    }
    return peer;
  }

  private forward(envelope: Envelope, to: MemberId | undefined, except: MemberId | undefined): boolean {
    let ok = true;
    for (const [id, peer] of this.peers) {
      if (id !== except && (to === undefined || to === id)) {
        ok = peer.channel.send(envelope) && ok;
      }
    }
    return ok;
  }

  private broadcastRoom() {
    this.events.room(this.room);
    this.forward({ m: { t: 'room', room: this.room }, from: this.me.id }, undefined, undefined);
  }

  private accept(connection: Connection) {
    if (this.ended) {
      return connection.close();
    }
    let joined: MemberId | null = null;
    const timer = this.clock.setTimeout(() => joined || channel.close(), HELLO_TIMEOUT);
    const channel = openChannel(
      connection,
      envelope => {
        if (joined) {
          return this.fromGuest(joined, envelope);
        }
        if (envelope.m.t === 'hello') {
          this.clock.clearTimeout(timer);
          joined = this.hello(channel, envelope.m);
        }
      },
      () => {
        this.clock.clearTimeout(timer);
        if (joined) {
          this.lost(joined, channel);
        }
      },
    );
  }

  private refuse(channel: Channel, reason: Extract<Message, { t: 'refused' }>['reason']): null {
    channel.send({ m: { t: 'refused', reason } });
    this.clock.setTimeout(() => channel.close(), 50);
    return null;
  }

  private hello(channel: Channel, hello: Extract<Message, { t: 'hello' }>): MemberId | null {
    const now = this.clock.now();
    const strikes = this.wrongTokens.get(channel.remote);
    if (strikes && strikes.count >= MAX_WRONG_TOKENS && strikes.until > now) {
      return this.refuse(channel, 'token');
    }
    if (!versionOk(hello.v) || hello.app !== APP_ID) {
      return this.refuse(channel, 'version');
    }
    if (hello.token !== this.token) {
      const count = (strikes && strikes.until > now ? strikes.count : 0) + 1;
      this.wrongTokens.set(channel.remote, { count, until: now + WRONG_TOKEN_COOLDOWN });
      return this.refuse(channel, 'token');
    }
    const name = hello.name.trim().slice(0, 40);
    // Only a member whose link dropped (still in the grace window) can be taken back, or one whose old link
    // the host has not noticed is dead yet, coming back from the same phone. A rejoin naming a member who
    // is still connected from another address is someone else claiming their place: a new member.
    const stale = hello.rejoin ? this.peers.get(hello.rejoin) : undefined;
    const samePhone = !!stale && !!channel.remote && stale.channel.remote === channel.remote;
    const rejoin = hello.rejoin && (this.away.has(hello.rejoin) || samePhone) ? hello.rejoin : undefined;
    let member = rejoin ? this.room.members.find(item => item.id === rejoin && !item.host) : undefined;
    if (member && samePhone && stale) {
      // The old link is half-dead; drop it. lost() ignores it because the new channel replaces it below.
      this.peers.delete(member.id);
      stale.channel.close();
    } else if (member) {
      // Coming back after a blink: the same place and colour.
      this.clock.clearTimeout(this.away.get(member.id));
      this.away.delete(member.id);
    } else {
      if (this.room.members.length >= MAX_MEMBERS) {
        return this.refuse(channel, 'full');
      }
      const fallback = `Guest ${this.room.members.length + 1}`;
      member = { id: this.newId(), name: name || fallback, color: freeColor(this.room.members), host: false };
      this.room = { ...this.room, members: [...this.room.members, member] };
    }
    this.peers.set(member.id, { channel, member, lastSeen: now });
    channel.send({ m: { t: 'welcome', v: PROTOCOL_VERSION, you: member.id, room: this.room }, from: this.me.id });
    this.broadcastRoom();
    return member.id;
  }

  private fromGuest(id: MemberId, envelope: Envelope) {
    const peer = this.peers.get(id);
    if (!peer) {
      return;
    }
    peer.lastSeen = this.clock.now();
    const message = envelope.m;
    if (message.t === 'ping') {
      peer.channel.send({ m: message.at === undefined ? { t: 'pong' } : { t: 'pong', at: message.at, hostAt: this.clock.now() } });
      return;
    }
    if (message.t === 'bye') {
      this.peers.delete(id);
      peer.channel.close();
      return this.remove(id);
    }
    if (HOST_ONLY.has(message.t)) {
      return;
    }
    // Whatever a guest claims, `from` is the guest the line came from.
    const fixed = ('from' in message ? { ...message, from: id } : message) as Message;
    const to = envelope.to;
    if (to !== undefined && to !== this.me.id && !this.peers.has(to)) {
      return;
    }
    // Relay first: a reaction the host's handlers send right away must not overtake the message itself.
    if (to !== this.me.id) {
      this.forward({ m: fixed, from: id }, to, id);
    }
    if (to === undefined || to === this.me.id) {
      this.events.deliver(fixed, id);
    }
  }

  private lost(id: MemberId, channel: Channel) {
    if (this.ended || this.peers.get(id)?.channel !== channel) {
      return;
    }
    this.peers.delete(id);
    this.away.set(
      id,
      this.clock.setTimeout(() => {
        this.away.delete(id);
        this.remove(id);
      }, REJOIN_GRACE),
    );
  }

  private remove(id: MemberId) {
    this.room = { ...this.room, members: this.room.members.filter(member => member.id !== id) };
    this.events.deliver({ t: 'bye', from: id }, id);
    this.forward({ m: { t: 'bye', from: id }, from: id }, undefined, undefined);
    this.broadcastRoom();
  }

  private checkHeartbeats() {
    const limit = this.clock.now() - HEARTBEAT_TIMEOUT;
    for (const peer of [...this.peers.values()]) {
      if (peer.lastSeen < limit) {
        peer.channel.close();
      }
    }
  }
}
