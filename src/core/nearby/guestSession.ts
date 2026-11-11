/**
 * A joining phone: says hello with the room's token, follows the room the host describes, pings so a dead
 * link is noticed, and quietly reconnects after a short Wi-Fi blink before giving up.
 */
import { LinkDown, openChannel, type Channel } from './channel';
import { APP_ID, HEARTBEAT_TIMEOUT, PING_EVERY, REJOIN_GRACE, versionOk } from './protocol';
import type { Clock, Network } from './transport';
import { PROTOCOL_VERSION, type Envelope, type MemberId, type Message, type RoomAddress, type RoomState } from './types';

const CONNECT_TIMEOUT = 5000;
const WELCOME_TIMEOUT = 6000;
const RETRY_EVERY = 1500;

export type GuestEvents = {
  deliver(message: Message, from: MemberId): void;
  room(room: RoomState, me: MemberId): void;
  reconnecting(active: boolean): void;
  /** The host's clock minus this phone's, in ms, smoothed over pings. */
  clock(offset: number): void;
  /** The room is over for this phone: the host left, the link could not be restored, or it was refused. */
  ended(reason: GuestEndReason): void;
};

export type GuestEndReason = 'hostLeft' | 'lost' | Extract<Message, { t: 'refused' }>['reason'] | 'unreachable';

export class GuestRefused extends Error {
  constructor(readonly reason: GuestEndReason) {
    super(reason);
  }
}

export class GuestSession {
  private channel: Channel | null = null;
  private heartbeat: unknown;
  private lastSeen = 0;
  private leaving = false;
  private offset: number | null = null;
  private bestRtt = Infinity;
  me: MemberId | null = null;
  hostId: MemberId | null = null;

  constructor(
    private readonly network: Network,
    private readonly address: RoomAddress,
    private readonly name: string,
    private readonly events: GuestEvents,
    private readonly clock: Clock,
  ) {}

  /** Resolves once welcomed; rejects with GuestRefused when the host says no or cannot be reached. */
  async join(): Promise<void> {
    await this.connect(undefined);
    this.heartbeat = this.clock.setInterval(() => this.tick(), PING_EVERY);
  }

  send(original: Message, to?: MemberId): boolean {
    // The host overwrites `from` with the real sender; the local copy gets the same treatment.
    const message = ('from' in original && this.me ? { ...original, from: this.me } : original) as Message;
    if (to === undefined || to === this.me) {
      this.events.deliver(message, this.me!);
    }
    return to === this.me ? true : this.write({ m: message, to });
  }

  /**
   * Sends a blob chunk; false means the socket is full and the caller should wait for `drained`. Throws
   * LinkDown while the link is gone (reconnecting): chunks written then would be lost.
   */
  sendChunk(message: Message, to?: MemberId): boolean {
    if (to === this.me) {
      return true;
    }
    return this.liveChannel().send({ m: message, to });
  }

  /** Rejects with LinkDown when the link is gone, or goes while waiting, so a transfer never waits on nothing. */
  async drained(_to?: MemberId): Promise<void> {
    const channel = this.liveChannel();
    await channel.drained();
    if (channel.closed || channel !== this.channel) {
      throw new LinkDown();
    }
  }

  leave(): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.clock.clearInterval(this.heartbeat);
    if (this.me) {
      this.write({ m: { t: 'bye', from: this.me } });
    }
    this.channel?.close();
    this.channel = null;
  }

  private liveChannel(): Channel {
    if (!this.channel || this.channel.closed) {
      throw new LinkDown();
    }
    return this.channel;
  }

  private write(envelope: Envelope): boolean {
    return this.channel ? this.channel.send(envelope) : false;
  }

  private connect(rejoin: MemberId | undefined): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (error?: GuestRefused) => {
        if (settled) {
          return;
        }
        settled = true;
        this.clock.clearTimeout(timer);
        error ? reject(error) : resolve();
      };
      const timer = this.clock.setTimeout(() => {
        channel?.close();
        settle(new GuestRefused('unreachable'));
      }, WELCOME_TIMEOUT + CONNECT_TIMEOUT);
      let channel: Channel | null = null;
      this.network.connect(this.address.host, this.address.port, CONNECT_TIMEOUT).then(
        connection => {
          if (settled || this.leaving) {
            return connection.close();
          }
          const opened = openChannel(
            connection,
            envelope => {
              if (!settled) {
                return this.handshake(opened, envelope, settle);
              }
              if (this.channel === opened) {
                this.receive(envelope);
              }
            },
            () => {
              settle(new GuestRefused('unreachable'));
              if (this.channel === opened) {
                this.dropped();
              }
            },
          );
          channel = opened;
          const hello: Message = { t: 'hello', v: PROTOCOL_VERSION, token: this.address.token, name: this.name, app: APP_ID };
          opened.send({ m: rejoin ? { ...hello, rejoin } : hello });
        },
        () => settle(new GuestRefused('unreachable')),
      );
    });
  }

  private handshake(channel: Channel, envelope: Envelope, settle: (error?: GuestRefused) => void) {
    const message = envelope.m;
    if (message.t === 'refused') {
      channel.close();
      return settle(new GuestRefused(message.reason));
    }
    if (message.t !== 'welcome') {
      return;
    }
    if (!versionOk(message.v)) {
      channel.close();
      return settle(new GuestRefused('version'));
    }
    this.channel = channel;
    this.me = message.you;
    this.hostId = message.room.members.find(member => member.host)?.id ?? envelope.from ?? null;
    this.lastSeen = this.clock.now();
    this.events.room(message.room, message.you);
    settle();
    // A first clock sample right away, so a battle started in the next seconds already has it.
    channel.send({ m: { t: 'ping', at: this.clock.now() } });
  }

  private receive(envelope: Envelope) {
    this.lastSeen = this.clock.now();
    const message = envelope.m;
    const from = envelope.from ?? this.hostId ?? '';
    switch (message.t) {
      case 'pong':
        return this.pong(message);
      case 'ping':
      case 'hello':
      case 'welcome':
      case 'refused':
        return;
      case 'room':
        return this.events.room(message.room, this.me!);
      case 'bye':
        if (message.from === this.hostId) {
          this.finish('hostLeft');
          return;
        }
        return this.events.deliver(message, message.from);
      default:
        this.events.deliver(message, from);
    }
  }

  private tick() {
    if (!this.channel) {
      return;
    }
    if (this.clock.now() - this.lastSeen > HEARTBEAT_TIMEOUT) {
      this.channel.close();
      return;
    }
    this.channel.send({ m: { t: 'ping', at: this.clock.now() } });
  }

  /**
   * Clock sync from a round trip: the host's moment sits in the middle of it. Samples much slower than the
   * best round trip seen are skipped (a busy link skews them); the rest are blended to smooth out jitter.
   */
  private pong(message: Extract<Message, { t: 'pong' }>) {
    if (message.at === undefined || message.hostAt === undefined) {
      return;
    }
    const now = this.clock.now();
    const rtt = now - message.at;
    if (rtt < 0 || rtt > 5000) {
      return;
    }
    this.bestRtt = Math.min(this.bestRtt, rtt);
    if (rtt > this.bestRtt * 2 + 20) {
      return;
    }
    const sample = message.hostAt - (message.at + now) / 2;
    this.offset = this.offset === null ? sample : this.offset * 0.7 + sample * 0.3;
    this.events.clock(Math.round(this.offset));
  }

  /** The link broke without a goodbye: try to come back as the same member for a few seconds. */
  private async dropped() {
    this.channel = null;
    if (this.leaving) {
      return;
    }
    this.events.reconnecting(true);
    const giveUpAt = this.clock.now() + REJOIN_GRACE;
    while (!this.leaving && this.clock.now() < giveUpAt) {
      try {
        await this.connect(this.me ?? undefined);
        this.events.reconnecting(false);
        return;
      } catch (error) {
        const reason = error instanceof GuestRefused ? error.reason : 'lost';
        if (reason !== 'unreachable') {
          return this.finish(reason);
        }
        await new Promise(resolve => this.clock.setTimeout(() => resolve(undefined), RETRY_EVERY));
      }
    }
    this.finish('lost');
  }

  private finish(reason: GuestEndReason) {
    if (this.leaving) {
      return;
    }
    this.leave();
    this.events.ended(reason);
  }
}
