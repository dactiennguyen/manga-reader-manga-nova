/**
 * Finding rooms on the same Wi-Fi with Bonjour (iOS) / NSD (Android) through react-native-zeroconf, which
 * can both announce a service and look for one. The host announces `_manganova._tcp` while its room is
 * open; the hub browses while it is on screen. The TXT record carries what the list shows and the token
 * needed to join, so being on the same Wi-Fi is the "invite" (see open notes in the room docs).
 */
import type ZeroconfClass from 'react-native-zeroconf';
import type { Service } from 'react-native-zeroconf';

import type { Advert, Discovery } from '../../core/nearby/transport';
import { PROTOCOL_VERSION, SERVICE_TYPE, type RoomAddress } from '../../core/nearby/types';
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

/** Bonjour TXT values are capped at 255 bytes; a room name never needs that much. */
function txtName(name: string): string {
  return name.slice(0, 60);
}

function publish(advert: Advert): () => void {
  publisher ??= create();
  const zeroconf = publisher;
  let stopped = false;
  let published: string | null = null;
  // The service name must be unique on the network; the token keeps two "Mai" rooms apart.
  const serviceName = `${txtName(advert.name).slice(0, 40)} ${advert.token}`;
  askLocalNetwork(zeroconf)
    .then(() =>
      zeroconf.publishService({
        type: TYPE,
        protocol: 'tcp',
        name: serviceName,
        port: advert.port,
        txt: { app: APP_ID, v: PROTOCOL_VERSION, k: advert.token, n: txtName(advert.name) },
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

export function roomsFrom(services: Service[]): RoomAddress[] {
  const rooms: RoomAddress[] = [];
  for (const service of services) {
    const txt = service.txt ?? {};
    const host = pickIPv4(service);
    if (txt.app !== APP_ID || !host || !/^[0-9a-f]{4}$/.test(txt.k ?? '')) {
      continue;
    }
    rooms.push({ host, port: service.port, token: txt.k, name: (txt.n || service.name).slice(0, 60) });
  }
  return rooms.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

function browse(onChange: (rooms: RoomAddress[]) => void): () => void {
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
