// Import Internal Dependencies
import type { ClientSocket } from "../../client/Client.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  isChannelTransportMessage,
  toPlainEvent,
  type ChannelPort,
  type ChannelTransportMessage
} from "./protocol.ts";

// CONSTANTS
const kSocketEvents = [
  "open",
  "message",
  "close",
  "error"
] as const;

export interface ChannelTransportHostOptions {
  port: ChannelPort;
  /**
   * Opens the connection each remote client is relayed to, usually
   * `LoopbackTransport.connect`.
   */
  open: () => ClientSocket;
  /**
   * @default crypto.randomUUID()
   */
  id?: string;
}

/**
 * Serves `ChannelTransport` clients: each remote connection is relayed to a
 * local socket opened with `open()`.
 */
export class ChannelTransportHost {
  readonly id: string;

  readonly #port: ChannelPort;
  readonly #open: () => ClientSocket;
  readonly #sockets = new Map<string, ClientSocket>();
  #closed = false;

  readonly #onMessage = (event: { data: unknown; }): void => {
    const message = event.data;
    if (
      !isChannelTransportMessage(message) ||
      message.host !== this.id
    ) {
      return;
    }

    switch (message.type) {
      case "connect":
        this.#connect(message.socket);
        break;
      case "send":
        this.#sockets.get(message.socket)?.send(message.data);
        break;
      case "close": {
        const socket = this.#sockets.get(message.socket);
        this.#sockets.delete(message.socket);
        socket?.close();
        break;
      }
    }
  };

  constructor(
    options: ChannelTransportHostOptions
  ) {
    this.id = options.id ?? crypto.randomUUID();
    this.#port = options.port;
    this.#open = options.open;
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
    for (const socket of this.#sockets.values()) {
      socket.close();
    }
    this.#sockets.clear();
  }

  #connect(
    id: string
  ): void {
    const socket = this.#open();
    this.#sockets.set(id, socket);
    for (const type of kSocketEvents) {
      socket.addEventListener(type, (event) => {
        if (type === "close") {
          if (this.#sockets.get(id) !== socket) {
            return;
          }
          this.#sockets.delete(id);
        }
        if (!this.#closed) {
          this.#port.postMessage({
            tag: CHANNEL_TRANSPORT_TAG,
            host: this.id,
            socket: id,
            type: "event",
            event: type,
            data: toPlainEvent(event)
          } satisfies ChannelTransportMessage);
        }
      });
    }
  }
}
