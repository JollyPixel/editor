// Import Node.js Dependencies
import { once } from "node:events";
import net from "node:net";

// CONSTANTS
const kChunkBytes = 16 * 1024;
const kHost = "localhost";

export interface ThrottleProxyOptions {
  port: number;
  targetPort: number;
  mbps: number;
  rttMs: number;
}

interface Transmission {
  readonly to: net.Socket;
  readonly chunk: Buffer | null;
}

class ThrottledLink {
  readonly #bytesPerMs: number;
  readonly #oneWayMs: number;
  #queue: Transmission[] = [];
  #freeAt = 0;
  #pumping: ReturnType<typeof setTimeout> | null = null;

  constructor(
    bytesPerMs: number,
    oneWayMs: number
  ) {
    this.#bytesPerMs = bytesPerMs;
    this.#oneWayMs = oneWayMs;
  }

  forward(
    from: net.Socket,
    to: net.Socket
  ): void {
    from.on("data", (data: Buffer) => {
      for (let offset = 0; offset < data.length; offset += kChunkBytes) {
        this.#enqueue(to, data.subarray(offset, offset + kChunkBytes));
      }
    });
    from.on("end", () => this.#enqueue(to, null));
    from.on("error", () => to.destroy());
  }

  #enqueue(
    to: net.Socket,
    chunk: Buffer | null
  ): void {
    if (this.#queue.length === 0 && this.#pumping === null) {
      this.#freeAt = Math.max(this.#freeAt, performance.now());
    }
    this.#queue.push({ to, chunk });
    this.#pump();
  }

  #pump(): void {
    if (this.#pumping !== null) {
      return;
    }

    const now = performance.now();
    while (this.#freeAt <= now) {
      const transmission = this.#queue.shift();
      if (transmission === undefined) {
        break;
      }
      if (!transmission.to.destroyed) {
        this.#transmit(transmission, now);
      }
    }
    if (this.#queue.length > 0) {
      this.#pumping = setTimeout(() => {
        this.#pumping = null;
        this.#pump();
      }, this.#freeAt - now);
    }
  }

  #transmit(
    { to, chunk }: Transmission,
    now: number
  ): void {
    this.#freeAt += (chunk?.length ?? 0) / this.#bytesPerMs;
    setTimeout(() => {
      if (to.destroyed) {
        return;
      }
      if (chunk === null) {
        to.end();
      }
      else {
        to.write(chunk);
      }
    }, this.#freeAt - now + this.#oneWayMs);
  }
}

export async function startThrottleProxy(
  options: ThrottleProxyOptions
): Promise<net.Server> {
  const bytesPerMs = options.mbps * 1_000_000 / 8 / 1_000;
  const oneWayMs = options.rttMs / 2;
  const upstream = new ThrottledLink(bytesPerMs, oneWayMs);
  const downstream = new ThrottledLink(bytesPerMs, oneWayMs);

  const server = net.createServer((client) => {
    const target = net.connect(options.targetPort, kHost);
    upstream.forward(client, target);
    downstream.forward(target, client);
  });
  server.listen(options.port, kHost);
  await once(server, "listening");

  return server;
}
