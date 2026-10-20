// Import Node.js Dependencies
import { performance } from "node:perf_hooks";

// Import Third-party Dependencies
import type { LoadMeter } from "@jolly-pixel/bench";
import { WEBSOCKET_PROTOCOL } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_REJECTED,
  CATALOG_SNAPSHOT,
  type CatalogCommand
} from "../../src/catalog/client/protocol.ts";

interface IncomingEnvelope {
  room: string;
  kind: string;
  self?: string;
  payload?: {
    type?: string;
    requestId?: string;
    data?: {
      clientId?: string;
      sentAt?: number;
    };
  };
}

export class LoadClient {
  static connect(
    url: string,
    meter: LoadMeter
  ): Promise<LoadClient> {
    const socket = new WebSocket(url, WEBSOCKET_PROTOCOL);

    return new Promise((resolve, reject) => {
      socket.addEventListener(
        "open",
        () => resolve(new LoadClient(socket, meter)),
        { once: true }
      );
      socket.addEventListener("error", reject, { once: true });
    });
  }

  #socket: WebSocket;
  #meter: LoadMeter;
  #self = new Map<string, string>();
  #joining = new Map<string, () => void>();
  #requests = new Map<string, () => void>();

  constructor(
    socket: WebSocket,
    meter: LoadMeter
  ) {
    this.#socket = socket;
    this.#meter = meter;
    socket.addEventListener("message", (event) => {
      this.#receive(String(event.data));
    });
  }

  join(
    room: string
  ): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#joining.set(room, resolve);
    this.send({
      room,
      kind: "join"
    });

    return promise;
  }

  leave(
    room: string
  ): void {
    this.#self.delete(room);
    this.send({
      room,
      kind: "leave"
    });
  }

  request(
    room: string,
    payload: CatalogCommand
  ): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#requests.set(payload.requestId, resolve);
    this.send({
      room,
      kind: "message",
      payload
    });

    return promise;
  }

  send(
    envelope: object
  ): void {
    this.#meter.sent++;
    this.#socket.send(JSON.stringify(envelope));
  }

  close(): void {
    this.#socket.close();
  }

  #receive(
    data: string
  ): void {
    const now = performance.now() + performance.timeOrigin;
    this.#meter.bytes += data.length;
    this.#meter.received++;

    const envelope: IncomingEnvelope = JSON.parse(data);
    if (envelope.kind === "sync") {
      this.#self.set(envelope.room, envelope.self ?? "");
    }
    else if (envelope.kind === "message") {
      this.#receiveMessage(envelope, now);
    }
  }

  #receiveMessage(
    envelope: IncomingEnvelope,
    now: number
  ): void {
    const { payload } = envelope;
    switch (payload?.type) {
      case "snapshot":
      case CATALOG_SNAPSHOT:
        this.#joining.get(envelope.room)?.();
        this.#joining.delete(envelope.room);
        break;
      case CATALOG_APPLIED:
      case CATALOG_REJECTED:
        this.#settle(payload.requestId);
        break;
      case "command":
        this.#recordCommand(envelope, now);
        break;
      default:
        break;
    }
  }

  #settle(
    requestId: string | undefined
  ): void {
    if (requestId !== undefined) {
      this.#requests.get(requestId)?.();
      this.#requests.delete(requestId);
    }
  }

  #recordCommand(
    envelope: IncomingEnvelope,
    now: number
  ): void {
    const sentAt = envelope.payload?.data?.sentAt;
    if (typeof sentAt !== "number") {
      return;
    }

    const own = envelope.payload?.data?.clientId ===
      this.#self.get(envelope.room);
    this.#meter.record(own ? "own" : "peer", sentAt, now);
  }
}
