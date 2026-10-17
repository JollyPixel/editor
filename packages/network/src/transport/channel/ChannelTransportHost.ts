// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType,
  SocketConnectOptions
} from "../ClientSocket.ts";
import {
  GOING_AWAY_CLOSE_CODE,
  PROTOCOL_ERROR_CLOSE_CODE
} from "../constants.ts";
import type {
  ChannelPort,
  ChannelPortListener,
  ChannelSocketPortFactory
} from "./ChannelPort.ts";
import {
  CHANNEL_SOCKET_EVENTS,
  CHANNEL_TRANSPORT_TAG,
  parseChannelMessage,
  toWireEvent,
  type ChannelMessage
} from "./ChannelMessage.ts";

export interface ChannelTransportHostOptions {
  /**
   * Port shared with `ChannelTransport` clients, started when it has `start()`.
   */
  port: ChannelPort;
  /**
   * Opens the connection each remote client is relayed to, usually
   * `LoopbackTransport.connect`, with the credential the client sent.
   */
  open: (
    options: SocketConnectOptions
  ) => ClientSocket;
  /**
   * Id clients pass as `host` to reach this host.
   * Messages addressed to other ids are ignored.
   * @default crypto.randomUUID()
   */
  id?: string;
  /**
   * Opens the dedicated port of each socket whose client asks for one, as
   * that client's `ChannelTransport` does. Without it, such sockets are
   * closed with code `1002`.
   */
  socketPort?: ChannelSocketPortFactory;
}

interface Relay {
  readonly id: string;
  readonly socket: ClientSocket;
  readonly port: ChannelPort;
  readonly listener: ChannelPortListener | null;
}

export class ChannelTransportHost {
  readonly id: string;

  readonly #port: ChannelPort;
  readonly #open: (options: SocketConnectOptions) => ClientSocket;
  readonly #socketPort: ChannelSocketPortFactory | undefined;
  readonly #relays = new Map<string, Relay>();
  #closed = false;

  readonly #onMessage = (event: { data: unknown; }): void => {
    const message = parseChannelMessage(event.data);
    if (
      message === undefined ||
      message.host !== this.id
    ) {
      return;
    }

    if (message.type === "connect") {
      this.#connect(message);

      return;
    }

    const relay = this.#relays.get(message.socket);
    if (relay?.listener === null) {
      this.#receive(relay, message);
    }
  };

  constructor(
    options: ChannelTransportHostOptions
  ) {
    this.id = options.id ?? crypto.randomUUID();
    this.#port = options.port;
    this.#open = options.open;
    this.#socketPort = options.socketPort;
    this.#port.addEventListener(
      "message",
      this.#onMessage
    );
    this.#port.start?.();
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#port.removeEventListener(
      "message",
      this.#onMessage
    );
    for (const relay of [...this.#relays.values()]) {
      this.#postEvent(relay.port, relay.id, "close", {
        code: GOING_AWAY_CLOSE_CODE,
        reason: "Channel transport host closed."
      });
      this.#release(relay);
      relay.socket.close();
    }
  }

  #receive(
    relay: Relay,
    message: ChannelMessage
  ): void {
    if (message.type === "send") {
      relay.socket.send(message.data);
    }
    else if (message.type === "close") {
      this.#release(relay);
      relay.socket.close();
    }
  }

  #connect(
    message: Extract<ChannelMessage, { type: "connect"; }>
  ): void {
    const {
      socket: id,
      dedicated,
      credential
    } = message;
    const port = dedicated ? this.#socketPort?.(id) ?? null : null;
    if (dedicated && port === null) {
      this.#postEvent(this.#port, id, "close", {
        code: PROTOCOL_ERROR_CLOSE_CODE,
        reason: "The channel transport host opens no socket ports."
      });

      return;
    }

    const relay: Relay = {
      id,
      socket: this.#open({ credential }),
      port: port ?? this.#port,
      listener: port === null ? null : this.#listenTo(id, port)
    };
    this.#relays.set(id, relay);
    for (const type of CHANNEL_SOCKET_EVENTS) {
      relay.socket.addEventListener(type, (event) => {
        if (this.#closed || this.#relays.get(id) !== relay) {
          return;
        }

        this.#postEvent(relay.port, id, type, toWireEvent(event));
        if (type === "close") {
          this.#release(relay);
        }
      });
    }
  }

  #postEvent(
    port: ChannelPort,
    socket: string,
    event: ClientSocketEventType,
    data: ClientSocketEvent
  ): void {
    port.postMessage({
      tag: CHANNEL_TRANSPORT_TAG,
      host: this.id,
      socket,
      type: "event",
      event,
      data
    } satisfies ChannelMessage);
  }

  #listenTo(
    id: string,
    port: ChannelPort
  ): ChannelPortListener {
    const listener: ChannelPortListener = (event) => {
      const message = parseChannelMessage(event.data);
      const relay = this.#relays.get(id);
      if (
        relay !== undefined &&
        message !== undefined &&
        message.host === this.id &&
        message.socket === id
      ) {
        this.#receive(relay, message);
      }
    };
    port.addEventListener("message", listener);
    port.start?.();

    return listener;
  }

  #release(
    relay: Relay
  ): void {
    if (this.#relays.get(relay.id) === relay) {
      this.#relays.delete(relay.id);
    }
    if (relay.listener !== null) {
      relay.port.removeEventListener("message", relay.listener);
      relay.port.close?.();
    }
  }
}
