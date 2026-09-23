// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent
} from "../../client/Client.ts";
import { ChannelSocket } from "./ChannelSocket.ts";
import {
  isChannelTransportMessage,
  type ChannelPort
} from "./protocol.ts";

// CONSTANTS
const kGoingAwayCloseCode = 1001;

export interface ChannelTransportOptions {
  port: ChannelPort;
  /**
   * Id of the `ChannelTransportHost` that serves the connections.
   */
  host: string;
}

/**
 * Opens client connections served by a `ChannelTransportHost` on the other
 * end of a message port, such as another tab, an iframe or a worker.
 */
export class ChannelTransport {
  readonly #port: ChannelPort;
  readonly #host: string;
  readonly #sockets = new Map<string, ChannelSocket>();
  #closed = false;

  readonly #onMessage = (event: { data: unknown; }): void => {
    const message = event.data;
    if (
      isChannelTransportMessage(message) &&
      message.type === "event" &&
      message.host === this.#host
    ) {
      this.#sockets.get(
        message.socket
      )?.receive(message.event, message.data);
    }
  };

  constructor(
    options: ChannelTransportOptions
  ) {
    this.#port = options.port;
    this.#host = options.host;
    this.#port.addEventListener(
      "message",
      this.#onMessage
    );
    this.#port.start?.();
  }

  connect(): ClientSocket {
    if (this.#closed) {
      throw new Error("The channel transport is closed.");
    }

    const socket = new ChannelSocket({
      port: this.#port,
      host: this.#host,
      onClose: (id) => this.#sockets.delete(id)
    });
    this.#sockets.set(
      socket.id,
      socket
    );

    return socket;
  }

  close(
    event: ClientSocketEvent = {
      code: kGoingAwayCloseCode,
      reason: "Channel transport closed."
    }
  ): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    for (const socket of this.#sockets.values()) {
      socket.terminate(event);
    }
    this.#port.removeEventListener(
      "message",
      this.#onMessage
    );
  }
}
