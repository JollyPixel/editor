// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent
} from "../ClientSocket.ts";
import { ChannelSocket } from "./ChannelSocket.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  parseChannelTransportMessage,
  type ChannelPort,
  type ChannelSocketPortFactory,
  type ChannelTransportMessage
} from "./protocol.ts";

// CONSTANTS
const kGoingAwayCloseCode = 1001;

export interface ChannelTransportOptions {
  /**
   * Port shared with the `ChannelTransportHost`, started when it has `start()`.
   */
  port: ChannelPort;
  /**
   * Id of the `ChannelTransportHost` that serves the connections.
   * Messages from other hosts on the same port are ignored.
   */
  host: string;
  /**
   * Opens a dedicated port for each socket. Only the connect message then
   * travels on `port`. A host without a factory opening the same channels
   * closes the socket.
   */
  socketPort?: ChannelSocketPortFactory;
}

interface SocketRecord {
  readonly socket: ChannelSocket;
  readonly port: ChannelPort | null;
}

/**
 * Opens client connections served by a `ChannelTransportHost` on the other
 * end of a message port, such as another tab, an iframe or a worker.
 */
export class ChannelTransport {
  readonly #port: ChannelPort;
  readonly #host: string;
  readonly #socketPort: ChannelSocketPortFactory | undefined;
  readonly #sockets = new Map<string, SocketRecord>();
  #closed = false;

  readonly #onMessage = (event: { data: unknown; }): void => {
    const message = parseChannelTransportMessage(event.data);
    if (
      message?.type === "event" &&
      message.host === this.#host
    ) {
      this.#sockets.get(
        message.socket
      )?.socket.receive(message.event, message.data);
    }
  };

  constructor(
    options: ChannelTransportOptions
  ) {
    this.#port = options.port;
    this.#host = options.host;
    this.#socketPort = options.socketPort;
    this.#listen(this.#port);
  }

  connect(): ClientSocket {
    if (this.#closed) {
      throw new Error("The channel transport is closed.");
    }

    const id = crypto.randomUUID();
    const port = this.#socketPort?.(id) ?? null;
    if (port !== null) {
      this.#listen(port);
    }
    const socket = new ChannelSocket({
      id,
      port: port ?? this.#port,
      host: this.#host,
      onClose: (closed) => this.#release(closed)
    });
    this.#sockets.set(id, {
      socket,
      port
    });
    this.#port.postMessage({
      tag: CHANNEL_TRANSPORT_TAG,
      host: this.#host,
      socket: id,
      type: "connect",
      dedicated: port !== null
    } satisfies ChannelTransportMessage);

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
    for (const { socket } of [...this.#sockets.values()]) {
      socket.terminate(event);
    }
    this.#port.removeEventListener(
      "message",
      this.#onMessage
    );
  }

  #listen(
    port: ChannelPort
  ): void {
    port.addEventListener(
      "message",
      this.#onMessage
    );
    port.start?.();
  }

  #release(
    id: string
  ): void {
    const port = this.#sockets.get(id)?.port ?? null;
    this.#sockets.delete(id);
    if (port !== null) {
      port.removeEventListener(
        "message",
        this.#onMessage
      );
      port.close?.();
    }
  }
}
