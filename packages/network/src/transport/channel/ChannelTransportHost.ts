// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType
} from "../ClientSocket.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  parseChannelTransportMessage,
  toPlainEvent,
  type ChannelPort,
  type ChannelSocketPortFactory,
  type ChannelTransportMessage
} from "./protocol.ts";

// CONSTANTS
const kProtocolErrorCloseCode = 1002;
const kSocketEvents = [
  "open",
  "message",
  "close",
  "error"
] as const;

type PortListener = (event: { data: unknown; }) => void;

export interface ChannelTransportHostOptions {
  /**
   * Port shared with `ChannelTransport` clients, started when it has `start()`.
   */
  port: ChannelPort;
  /**
   * Opens the connection each remote client is relayed to, usually
   * `LoopbackTransport.connect`.
   */
  open: () => ClientSocket;
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
  readonly listener: PortListener | null;
}

/**
 * Serves `ChannelTransport` clients: each remote connection is relayed to a
 * local socket opened with `open()`.
 */
export class ChannelTransportHost {
  readonly id: string;

  readonly #port: ChannelPort;
  readonly #open: () => ClientSocket;
  readonly #socketPort: ChannelSocketPortFactory | undefined;
  readonly #relays = new Map<string, Relay>();
  #closed = false;

  readonly #onMessage = (event: { data: unknown; }): void => {
    const message = parseChannelTransportMessage(event.data);
    if (
      message === undefined ||
      message.host !== this.id
    ) {
      return;
    }

    if (message.type === "connect") {
      this.#connect(message.socket, message.dedicated);

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
      this.#release(relay);
      relay.socket.close();
    }
  }

  #receive(
    relay: Relay,
    message: ChannelTransportMessage
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
    id: string,
    dedicated: boolean
  ): void {
    const port = dedicated ? this.#socketPort?.(id) ?? null : null;
    if (dedicated && port === null) {
      this.#postEvent(this.#port, id, "close", {
        code: kProtocolErrorCloseCode,
        reason: "The channel transport host opens no socket ports."
      });

      return;
    }

    const relay: Relay = {
      id,
      socket: this.#open(),
      port: port ?? this.#port,
      listener: port === null ? null : this.#listenTo(id, port)
    };
    this.#relays.set(id, relay);
    for (const type of kSocketEvents) {
      relay.socket.addEventListener(type, (event) => {
        if (this.#closed || this.#relays.get(id) !== relay) {
          return;
        }

        this.#postEvent(relay.port, id, type, toPlainEvent(event));
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
    } satisfies ChannelTransportMessage);
  }

  #listenTo(
    id: string,
    port: ChannelPort
  ): PortListener {
    const listener: PortListener = (event) => {
      const message = parseChannelTransportMessage(event.data);
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
