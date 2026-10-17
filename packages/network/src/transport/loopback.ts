// Import Internal Dependencies
import type {
  Server,
  ServerConnection
} from "../server/Server.ts";
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType,
  SocketConnectOptions
} from "./ClientSocket.ts";
import {
  UNAUTHORIZED_CLOSE_CODE,
  UNAUTHORIZED_CLOSE_REASON
} from "./constants.ts";

// CONSTANTS
const kLoopbackUrl = "loopback:";
const kNormalCloseCode = 1000;

type SocketListener = (event: ClientSocketEvent) => void;

export interface LoopbackTransportOptions {
  server: Server;
}

class LoopbackSocket implements ClientSocket {
  readonly id = crypto.randomUUID();

  readonly #server: Server;
  readonly #credential: string | undefined;
  readonly #listeners = new Map<
    ClientSocketEventType,
    SocketListener[]
  >();
  #connection: ServerConnection | null = null;
  #closed = false;

  constructor(
    server: Server,
    credential: string | undefined
  ) {
    this.#server = server;
    this.#credential = credential;

    void this.#open();
  }

  send(
    data: string
  ): void {
    if (!this.#closed) {
      void this.#connection?.receive(data);
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
      headers: {},
      credential: this.#credential
    });
    if (this.#closed) {
      return;
    }
    if (identity === null) {
      this.#terminate({
        code: UNAUTHORIZED_CLOSE_CODE,
        reason: UNAUTHORIZED_CLOSE_REASON
      });

      return;
    }

    this.#connection = this.#server.connect(
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
      if (!this.#closed) {
        this.#emit("message", { data: json });
      }
    });
  }

  #terminate(
    event: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    void this.#connection?.close();

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

export class LoopbackTransport {
  #server: Server;

  constructor(
    options: LoopbackTransportOptions
  ) {
    this.#server = options.server;
  }

  connect(
    options: SocketConnectOptions = {}
  ): ClientSocket {
    return new LoopbackSocket(this.#server, options.credential);
  }
}
