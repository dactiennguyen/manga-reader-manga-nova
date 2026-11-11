/**
 * Finding rooms on the same Wi-Fi with Bonjour (iOS) / NSD (Android) through react-native-zeroconf, which
 * can both announce a service and look for one. The host announces `_manganova._tcp` while its room is
 * open; the hub browses while it is on screen. The TXT record carries what the list shows. In an open room
 * it also carries the token, so being on the same Wi-Fi is the "invite". A code-only room (the default)
 * leaves the token out and sets `lock`: it is listed with a lock, and joining needs the room code or QR.
 */
import type ZeroconfClass from 'react-native-zeroconf';
import type { Service } from 'react-native-zeroconf';

import type { Advert, Discovery } from '../../core/nearby/transport';
import { PROTOCOL_VERSION, SERVICE_TYPE, type NearbyRoom } from '../../core/nearby/types';
import { APP_ID } from '../../core/nearby/protocol';
import { usableIPv4 } from './tcp';

/** `_manganova._tcp` → "manganova": zeroconf takes the bare name and protocol. */
const TYPE = SERVICE_TYPE.replace(/^_/, '').replace(/\._tcp$/, '');

type Zeroconf = InstanceType<typeof ZeroconfClass>;

function create(): Zeroconf {
  const Lib = (require('react-native-zeroconf') as { default: typeof ZeroconfClass }).default;
  return new Lib();
}

let publisher: Zeroconf | null = null;

/** iOS shows the Local Network prompt; Android 17+ asks for ACCESS_LOCAL_NETWORK. Elsewhere it is a no-op. */
async function askLocalNetwork(zeroconf: Zeroconf): Promise<void> {
  try {
    await zeroconf.checkLocalNetworkAccess({ type: TYPE, protocol: 'tcp' });
  } catch {
    // Older systems have nothing to ask; publishing or browsing reports its own errors.
  }
}

/**
 * Keeps two "Mai" rooms apart in the service name, which must be unique on the network. It is random and
 * never the token, which a code-only room must not show; a fresh one per advert also lets a re-published
 * advert (the host switched who can join) never clash with the one being withdrawn.
 */
function serviceSuffix(): string {
  return Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
}

/** The TXT record: the token only for an open room; `lock` marks a room that needs the room code. */
export function txtFor(advert: Advert): Record<string, string | number> {
  const base = { app: APP_ID, v: PROTOCOL_VERSION, n: txtName(advert.name) };
  return advert.token ? { ...base, k: advert.token } : { ...base, lock: '1' };
}

/** Bonjour TXT values are capped at 255 bytes; a room name never needs that much. */
function txtName(name: string): string {
  return name.slice(0, 60);
}

function publish(advert: Advert): () => void {
  publisher ??= create();
  const zeroconf = publisher;
  let stopped = false;
  let published: string | null = null;
  const serviceName = `${txtName(advert.name).slice(0, 40)} ${serviceSuffix()}`;
  askLocalNetwork(zeroconf)
    .then(() =>
      zeroconf.publishService({
        type: TYPE,
        protocol: 'tcp',
        name: serviceName,
        port: advert.port,
        txt: txtFor(advert),
      }),
    )
    .then(service => {
      published = service.name;
      if (stopped) {
        zeroconf.unpublishService(service.name).catch(() => undefined);
      }
    })
    .catch(() => undefined); // The room still works through the QR code and the room code.
  return () => {
    stopped = true;
    if (published) {
      zeroconf.unpublishService(published).catch(() => undefined);
    }
  };
}

function pickIPv4(service: Service): string | null {
  const candidates = (service.ipv4 ?? []).map(usableIPv4).filter((ip): ip is string => !!ip);
  const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return candidates.find(isPrivate) ?? candidates[0] ?? null;
}

/**
 * Open rooms come with their token; code-only rooms (`lock`) with none. Anything else is not a room.
 * One room per host and port: right after the host switches who can join, the withdrawn advert can
 * linger next to the new one (a lost goodbye packet), and then the locked one wins, so a room the host
 * just locked never stays one tap away.
 */
export function roomsFrom(services: Service[]): NearbyRoom[] {
  const byAddress = new Map<string, NearbyRoom>();
  for (const service of services) {
    const txt = service.txt ?? {};
    const host = pickIPv4(service);
    if (txt.app !== APP_ID || !host) {
      continue;
    }
    const open = /^[0-9a-f]{4}$/.test(txt.k ?? '');
    if (!open && txt.lock !== '1') {
      continue;
    }
    const room: NearbyRoom = { host, port: service.port, token: open ? txt.k : null, name: (txt.n || service.name).slice(0, 60) };
    const key = `${host}:${service.port}`;
    const seen = byAddress.get(key);
    if (!seen || (seen.token && !room.token)) {
      byAddress.set(key, room);
    }
  }
  return [...byAddress.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

function browse(onChange: (rooms: NearbyRoom[]) => void): () => void {
  let zeroconf: Zeroconf | null = null;
  let stopped = false;
  try {
    zeroconf = create();
  } catch {
    return () => undefined;
  }
  const scanner = zeroconf;
  const update = () => !stopped && onChange(roomsFrom(Object.values(scanner.getServices())));
  scanner.on('resolved', update);
  scanner.on('remove', update);
  scanner.on('update', update);
  scanner.on('error', () => undefined);
  askLocalNetwork(scanner).then(() => {
    if (!stopped) {
      scanner.scan({ type: TYPE, protocol: 'tcp', domain: 'local.' });
    }
  });
  return () => {
    stopped = true;
    scanner.stop();
    scanner.removeAllListeners();
    scanner.removeDeviceListeners();
  };
}

export const zeroconfDiscovery: Discovery = { publish, browse };
