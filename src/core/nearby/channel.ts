/**
 * A connection that speaks envelopes instead of bytes: frames lines, checks every one, and closes the
 * link when the other side sends something far too big or keeps sending garbage.
 */
import { encodeLine, LineReader, parseEnvelope } from './protocol';
import type { Connection } from './transport';
import type { Envelope } from './types';

const MAX_BAD_LINES = 20;

/**
 * Thrown when a blob chunk has no live link to go out on (a guest reconnecting, a member away for a few
 * seconds): the transfer fails instead of losing chunks and still reporting success.
 */
export class LinkDown extends Error {
  constructor() {
    super('link down');
  }
}

export type Channel = {
  remote: string;
  /** False when the socket buffer is full; `drained()` resolves once it has room again. */
  send(envelope: Envelope): boolean;
  drained(): Promise<void>;
  close(): void;
  readonly closed: boolean;
};

export function openChannel(
  connection: Connection,
  onEnvelope: (envelope: Envelope) => void,
  onClose: () => void,
): Channel {
  let closed = false;
  let bad = 0;
  let waiters: (() => void)[] = [];

  const close = () => {
    if (!closed) {
      closed = true;
      connection.close();
    }
  };

  const reader = new LineReader(
    line => {
      if (closed) {
        return;
      }
      const result = parseEnvelope(line);
      if (result.ok) {
        onEnvelope(result.envelope);
      } else if (result.reason !== 'unknown' && ++bad > MAX_BAD_LINES) {
        close();
      }
    },
    close,
  );

  connection.onData(bytes => reader.push(bytes));
  connection.onDrain(() => {
    const ready = waiters;
    waiters = [];
    ready.forEach(resolve => resolve());
  });
  connection.onClose(() => {
    closed = true;
    const ready = waiters;
    waiters = [];
    ready.forEach(resolve => resolve());
    onClose();
  });

  return {
    remote: connection.remote,
    send: envelope => (closed ? true : connection.write(encodeLine(envelope))),
    drained: () => (closed ? Promise.resolve() : new Promise(resolve => waiters.push(resolve))),
    close,
    get closed() {
      return closed;
    },
  };
}
