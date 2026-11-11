/**
 * The few things a room needs from the network, so the room logic stays pure and testable: the real
 * phones use TCP sockets and Bonjour/NSD (src/native/nearby), tests use the in-memory loopback.
 */
import type { RoomAddress } from './types';

/** One TCP connection, as raw bytes. Lines are cut out of it by protocol.ts. */
export type Connection = {
  /** The other side's IP address, used to slow down wrong-token guesses. */
  remote: string;
  /** False when the socket's buffer is full: wait for `onDrain` before writing more. */
  write(bytes: Uint8Array): boolean;
  onData(handler: (bytes: Uint8Array) => void): void;
  onDrain(handler: () => void): void;
  /** Called once, whether the other side left or the link broke. */
  onClose(handler: () => void): void;
  close(): void;
};

export type Server = {
  port: number;
  onConnection(handler: (connection: Connection) => void): void;
  close(): void;
};

export type Network = {
  listen(): Promise<Server>;
  connect(host: string, port: number, timeoutMs: number): Promise<Connection>;
  /** This phone's Wi-Fi IPv4 address, or null when it is not on a local network. */
  localIPv4(): Promise<string | null>;
};

export type Advert = { name: string; port: number; token: string; host?: string };

export type Discovery = {
  /** Announce a hosted room on the local network until the returned function is called. */
  publish(advert: Advert): () => void;
  /** Watch the rooms announced nearby until the returned function is called. */
  browse(onChange: (rooms: RoomAddress[]) => void): () => void;
};

export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: handle => clearInterval(handle as ReturnType<typeof setInterval>),
};
