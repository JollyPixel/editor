// Import Internal Dependencies
import type { Server } from "../server/Server.ts";
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType
} from "./ClientSocket.ts";
import {
  UNAUTHORIZED_CLOSE_CODE,
  UNAUTHORIZED_CLOSE_REASON
} from "./constants.ts";

// CONSTANTS
const kLoopbackUrl = "loopback:";
const kNormalCloseCode = 1000;

type SocketListener = (event: ClientSocketEvent) => void;
type LoopbackSocketState = "connecting" | "open" | "closed";

export interface LoopbackTransportOptions {
  server: Server;
}

class LoopbackSocket implements ClientSocket {
  readonly id = crypto.randomUUID();

  readonly #server: Server;
  readonly #listeners = new Map<
    ClientSocketEventType,
    SocketListener[]
  >();
  #state: LoopbackSocketState = "connecting";

  constructor(
    server: Server
  ) {
    this.#server = server;

    void this.#open();
  }

  send(
    data: string
  ): void {
    if (this.#state === "open") {
      void this.#server.handleMessage(this.id, data);
    }
  }

  close(): void {
    this.#terminate({
      code: kNormalCloseCode,
      reason: ""
    });
  }

  addEventListener(
    type: ClientSocketEventType,
    listener: SocketListener
  ): void {
    const registered = this.#listeners.get(type) ?? [];
    registered.push(listener);

    this.#listeners.set(
      type,
      registered
    );
  }

  async #open(): Promise<void> {
    const identity = await this.#server.authenticate({
      clientId: this.id,
      url: kLoopbackUrl,
      headers: {}
    });
    if (this.#state === "closed") {
      return;
    }
    if (identity === null) {
      this.#terminate({
        code: UNAUTHORIZED_CLOSE_CODE,
        reason: UNAUTHORIZED_CLOSE_REASON
      });

      return;
    }

    this.#state = "open";
    this.#server.handleConnect(
      {
        id: this.id,
        send: (data) => this.#deliver(JSON.stringify(data)),
        sendSerialized: (json) => this.#deliver(json),
        close: (code, reason) => this.#terminate({
          code,
          reason
        })
      },
      identity
    );
    this.#emit("open");
  }

  #deliver(
    json: string
  ): void {
    queueMicrotask(() => {
      if (this.#state !== "closed") {
        this.#emit("message", { data: json });
      }
    });
  }

  #terminate(
    event: ClientSocketEvent
  ): void {
    if (this.#state === "closed") {
      return;
    }

    const wasOpen = this.#state === "open";
    this.#state = "closed";
    if (wasOpen) {
      void this.#server.handleDisconnect(this.id);
    }

    queueMicrotask(
      () => this.#emit("close", event)
    );
  }

  #emit(
    type: ClientSocketEventType,
    event: ClientSocketEvent = {}
  ): void {
    const registered = this.#listeners.get(type) ?? [];
    for (const listener of registered) {
      listener(event);
    }
  }
}

/**
 * Connects clients to a server living in the same process, without a
 * network socket. Envelopes are serialized and delivered asynchronously,
 * as they are over a WebSocket.
 */
export class LoopbackTransport {
  #server: Server;

  constructor(
    options: LoopbackTransportOptions
  ) {
    this.#server = options.server;
  }

  connect(): ClientSocket {
    return new LoopbackSocket(this.#server);
  }
}
