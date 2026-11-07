// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Server } from "../../server/Server.ts";
import type { ServerConnection } from "../../server/connection/ServerConnection.ts";
import type { Frame } from "../../protocol/frame/Frame.ts";
import {
  UNAUTHORIZED_CLOSE_CODE,
  UNAUTHORIZED_CLOSE_REASON
} from "../../protocol/constants.ts";
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType,
  ClientSocketListener
} from "../ClientSocket.ts";
import { NORMAL_CLOSE_CODE } from "../constants.ts";

// CONSTANTS
const kLoopbackUrl = "loopback:";

export class LoopbackSocket implements ClientSocket {
  readonly id = crypto.randomUUID();

  readonly #server: Server;
  readonly #credential: string | undefined;
  readonly #events = new Emitter<
    Record<ClientSocketEventType, ClientSocketListener>
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
    data: Frame
  ): void {
    if (!this.#closed) {
      void this.#connection?.receive(data);
    }
  }

  close(): void {
    this.#terminate({
      code: NORMAL_CLOSE_CODE,
      reason: ""
    });
  }

  addEventListener(
    type: ClientSocketEventType,
    listener: ClientSocketListener
  ): void {
    this.#events.on(type, listener);
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
        sendFrame: (frame) => this.#deliver(frame),
        close: (code, reason) => this.#terminate({
          code,
          reason
        })
      },
      identity
    );
    this.#events.emit("open", {});
  }

  #deliver(
    frame: Frame
  ): void {
    const data = typeof frame === "string" ? frame : frame.slice();
    queueMicrotask(() => {
      if (!this.#closed) {
        this.#events.emit("message", { data });
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
      () => this.#events.emit("close", event)
    );
  }
}
