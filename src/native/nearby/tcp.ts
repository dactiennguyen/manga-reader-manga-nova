/* eslint-disable no-bitwise -- UTF-8 and bytes work on bits. */
/**
 * The room's wires on a real phone: react-native-tcp-socket (TCP server for the host, a client for each guest)
 * and @react-native-community/netinfo for this phone's Wi-Fi address. Libraries are loaded on first use so
 * screens and tests that never open a room do not need the native modules.
 */
import type NetInfoModule from '@react-native-community/netinfo';
import type TcpModule from 'react-native-tcp-socket';

import { isIPv4 } from '../../core/nearby/link';
import type { Connection, Network, Server } from '../../core/nearby/transport';

type TcpSocket = InstanceType<typeof TcpModule.Socket>;

/** How long a goodbye may take to flush before the socket is cut. */
const CLOSE_GRACE = 1500;

let tcpLib: typeof TcpModule | null = null;
function tcp(): typeof TcpModule {
  // The package ends with `module.exports = {...}`, which replaces its ES default export, so take either.
  const lib = require('react-native-tcp-socket') as { default?: typeof TcpModule } & typeof TcpModule;
  tcpLib ??= lib.default ?? lib;
  return tcpLib;
}

function netInfo(): typeof NetInfoModule {
  const lib = require('@react-native-community/netinfo') as { default?: typeof NetInfoModule } & typeof NetInfoModule;
  return lib.default ?? lib;
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  // Only when an encoding was set on the socket, which this code never does.
  const text = String(data);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 255;
  }
  return bytes;
}

function wrap(socket: TcpSocket, remote: string): Connection {
  let closed = false;
  let onClose: (() => void) | null = null;
  const finish = () => {
    if (!closed) {
      closed = true;
      onClose?.();
    }
  };
  // Cursor moves and strokes are tiny and frequent: send them now, not batched.
  socket.setNoDelay(true);
  socket.on('close', finish);
  socket.on('error', () => {
    socket.destroy();
    finish();
  });
  return {
    remote,
    write(bytes) {
      if (closed) {
        return true;
      }
      try {
        return socket.write(bytes);
      } catch {
        finish();
        return true;
      }
    },
    onData: handler => socket.on('data', data => handler(toBytes(data))),
    onDrain: handler => socket.on('drain', handler),
    onClose: handler => {
      onClose = handler;
      if (closed) {
        handler();
      }
    },
    close() {
      if (closed) {
        return;
      }
      // end() sends what is queued (the goodbye) first; destroy() makes sure it really closes.
      try {
        socket.end();
      } catch {
        // Already gone.
      }
      setTimeout(() => socket.destroy(), CLOSE_GRACE);
    },
  };
}

function listen(): Promise<Server> {
  return new Promise((resolve, reject) => {
    let onConnection: ((connection: Connection) => void) | null = null;
    const server = tcp().createServer(socket => {
      const connection = wrap(socket, socket.remoteAddress ?? '');
      if (onConnection) {
        onConnection(connection);
      } else {
        connection.close();
      }
    });
    server.once('error', reject);
    // Port 0: the system picks a free port; it travels in the room code and the Bonjour advert.
    server.listen({ port: 0, host: '0.0.0.0' }, () => {
      const port = server.address()?.port ?? 0;
      resolve({
        port,
        onConnection: handler => {
          onConnection = handler;
        },
        close: () => server.close(),
      });
    });
  });
}

function connect(host: string, port: number, timeoutMs: number): Promise<Connection> {
  return new Promise((resolve, reject) => {
    let done = false;
    const socket = tcp().createConnection({ host, port, connectTimeout: timeoutMs }, () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        socket.removeAllListeners('error');
        resolve(wrap(socket, host));
      }
    });
    const fail = (error: Error) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        socket.destroy();
        reject(error);
      }
    };
    socket.once('error', fail);
    const timer = setTimeout(() => fail(new Error('timeout')), timeoutMs);
  });
}

/** Private LAN ranges first; 169.254 (no DHCP) and 0.0.0.0 are useless to another phone. */
export function usableIPv4(value: string | null | undefined): string | null {
  if (!value || !isIPv4(value) || value === '0.0.0.0' || value.startsWith('169.254.') || value.startsWith('127.')) {
    return null;
  }
  return value;
}

async function localIPv4(): Promise<string | null> {
  const info = netInfo();
  for (const iface of ['wifi', 'ethernet', undefined]) {
    try {
      const state = await info.fetch(iface);
      if (state.type === 'wifi' || state.type === 'ethernet') {
        const ip = usableIPv4(state.details?.ipAddress);
        if (ip) {
          return ip;
        }
      }
    } catch {
      // Try the next interface.
    }
  }
  return null;
}

export const tcpNetwork: Network = { listen, connect, localIPv4 };
