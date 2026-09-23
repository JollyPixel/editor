// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType
} from "../../client/Client.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  type ChannelPort,
  type ChannelTransportMessage
} from "./protocol.ts";

// CONSTANTS
const kNormalCloseCode = 1000;

type SocketListener = (event: ClientSocketEvent) => void;

export interface ChannelSocketOptions {
  port: ChannelPort;
  host: string;
  onClose: (id: string) => void;
}

export class ChannelSocket implements ClientSocket {
  readonly id = crypto.randomUUID();

  readonly #port: ChannelPort;
  readonly #host: string;
  readonly #onClose: (id: string) => void;
  readonly #listeners = new Map<ClientSocketEventType, SocketListener[]>();
  #closed = false;

  constructor(
    options: ChannelSocketOptions
  ) {
    this.#port = options.port;
    this.#host = options.host;
    this.#onClose = options.onClose;

    this.#post({
      type: "connect"
    });
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
      code: kNormalCloseCode
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
    this.#emit(type, event);
  }

  terminate(
    event: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#onClose(this.id);
    this.#post({
      type: "close"
    });

    queueMicrotask(
      () => this.#emit("close", event)
    );
  }

  #emit(
    type: ClientSocketEventType,
    event: ClientSocketEvent
  ): void {
    const registered = this.#listeners.get(type) ?? [];
    for (const listener of registered) {
      listener(event);
    }
  }

  #post(
    message:
      | { type: "connect"; }
      | { type: "send"; data: string; }
      | { type: "close"; }
  ): void {
    this.#port.postMessage({
      tag: CHANNEL_TRANSPORT_TAG,
      host: this.#host,
      socket: this.id,
      ...message
    } satisfies ChannelTransportMessage);
  }
}
