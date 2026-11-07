// Import Node.js Dependencies
import net from "node:net";
import { parseArgs } from "node:util";

// CONSTANTS
const kChunkBytes = 16 * 1024;

const { values: args } = parseArgs({
  options: {
    listen: { type: "string" },
    target: { type: "string" },
    mbps: { type: "string", default: "8.1" },
    rtt: { type: "string", default: "165" }
  }
});
if (args.listen === undefined || args.target === undefined) {
  throw new TypeError("--listen <port> and --target <port> are required");
}

const kTargetPort = Number(args.target);
const kBytesPerMs = Number(args.mbps) * 1_000_000 / 8 / 1_000;
const kOneWayMs = Number(args.rtt) / 2;

interface Transmission {
  readonly to: net.Socket;
  readonly chunk: Buffer | null;
}

class ThrottledLink {
  #queue: Transmission[] = [];
  #freeAt = 0;
  #pumping: ReturnType<typeof setTimeout> | null = null;

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
    this.#freeAt += (chunk?.length ?? 0) / kBytesPerMs;
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
    }, this.#freeAt - now + kOneWayMs);
  }
}

const upstream = new ThrottledLink();
const downstream = new ThrottledLink();

const server = net.createServer((client) => {
  const target = net.connect(kTargetPort, "localhost");
  upstream.forward(client, target);
  downstream.forward(target, client);
});
server.listen(Number(args.listen), "localhost", () => {
  console.info(
    `localhost:${args.listen} -> localhost:${kTargetPort} ` +
    `at ${args.mbps} Mbit/s, ${args.rtt} ms RTT`
  );
});
