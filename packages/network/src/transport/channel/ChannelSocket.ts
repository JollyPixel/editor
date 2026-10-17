// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType,
  ClientSocketListener
} from "../ClientSocket.ts";
import { NORMAL_CLOSE_CODE } from "../constants.ts";
import type { ChannelPort } from "./ChannelPort.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  type ChannelMessage
} from "./ChannelMessage.ts";

export interface ChannelSocketOptions {
  id: string;
  /**
   * Port the socket posts its send and close messages to.
   */
  port: ChannelPort;
  /**
   * Id of the `ChannelTransportHost` the messages are addressed to.
   */
  host: string;
  /**
   * Called once with the socket id when either side closes the socket.
   */
  onClose: (
    id: string
  ) => void;
}

export class ChannelSocket implements ClientSocket {
  readonly id: string;

  readonly #port: ChannelPort;
  readonly #host: string;
  readonly #onClose: (id: string) => void;
  readonly #events = new Emitter<
    Record<ClientSocketEventType, ClientSocketListener>
  >();
  #closed = false;

  constructor(
    options: ChannelSocketOptions
  ) {
    this.id = options.id;
    this.#port = options.port;
    this.#host = options.host;
    this.#onClose = options.onClose;
  }

  send(
    data: string
  ): void {
    if (!this.#closed) {
      this.#post({
        type: "send",
        data
      });
    }
  }

  close(): void {
    this.terminate({
      code: NORMAL_CLOSE_CODE
    });
  }

  addEventListener(
    type: ClientSocketEventType,
    listener: ClientSocketListener
  ): void {
    this.#events.on(type, listener);
  }

  receive(
    type: ClientSocketEventType,
    event: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }

    if (type === "close") {
      this.#closed = true;
      this.#onClose(this.id);
    }
    this.#events.emit(type, event);
  }

  terminate(
    event: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#post({
      type: "close"
    });
    this.#onClose(this.id);

    queueMicrotask(
      () => this.#events.emit("close", event)
    );
  }

  #post(
    message:
      | { type: "send"; data: string; }
      | { type: "close"; }
  ): void {
    this.#port.postMessage({
      tag: CHANNEL_TRANSPORT_TAG,
      host: this.#host,
      socket: this.id,
      ...message
    } satisfies ChannelMessage);
  }
}
