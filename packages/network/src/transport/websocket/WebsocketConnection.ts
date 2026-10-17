// Import Third-party Dependencies
import { WebSocket } from "ws";

// Import Internal Dependencies
import type { Logger } from "../../server/logger.ts";
import type { ClientConnection } from "../../server/connection/ClientConnection.ts";

// CONSTANTS
const kPauseAtPendingMessages = 64;
const kResumeAtPendingMessages = 16;

export interface WebsocketConnectionSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  readonly isPaused: boolean;

  send(
    data: string
  ): void;
  ping(): void;
  pause(): void;
  resume(): void;
  terminate(): void;
  close(
    code: number,
    reason: string
  ): void;
}

export interface WebsocketConnectionOptions {
  id: string;
  socket: WebsocketConnectionSocket;
  logger: Logger;
  maxBufferedBytes: number;
  onMessage: (json: string) => Promise<void>;
  holdWrites: () => void;
}

export class WebsocketConnection implements ClientConnection {
  readonly id: string;

  #socket: WebsocketConnectionSocket;
  #logger: Logger;
  #maxBufferedBytes: number;
  #onMessage: (json: string) => Promise<void>;
  #holdWrites: () => void;
  #pending = 0;
  #awaitingPong = false;

  constructor(
    options: WebsocketConnectionOptions
  ) {
    this.id = options.id;
    this.#socket = options.socket;
    this.#logger = options.logger;
    this.#maxBufferedBytes = options.maxBufferedBytes;
    this.#onMessage = options.onMessage;
    this.#holdWrites = options.holdWrites;
  }

  sendSerialized(
    json: string
  ): void {
    if (this.#socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this.#socket.bufferedAmount > this.#maxBufferedBytes) {
      this.#logger
        .withMetadata({
          clientId: this.id,
          bufferedAmount: this.#socket.bufferedAmount
        })
        .warn("slow client terminated");
      this.#socket.terminate();

      return;
    }

    this.#holdWrites();
    this.#socket.send(json);
  }

  receive(
    json: string
  ): void {
    this.#pending++;
    if (this.#pending >= kPauseAtPendingMessages) {
      this.#socket.pause();
    }

    void this.#onMessage(json).then(this.#settle, this.#settle);
  }

  #settle = (): void => {
    this.#pending--;
    if (
      this.#pending <= kResumeAtPendingMessages &&
      this.#socket.isPaused
    ) {
      this.#socket.resume();
    }
  };

  probe(): void {
    if (this.#awaitingPong) {
      this.#logger
        .withMetadata({
          clientId: this.id,
          outcome: "terminated"
        })
        .debug("client missed a heartbeat");
      this.#socket.terminate();

      return;
    }

    this.#awaitingPong = true;
    this.#socket.ping();
  }

  markAlive(): void {
    this.#awaitingPong = false;
  }

  close(
    code: number,
    reason: string
  ): void {
    this.#socket.close(code, reason);
  }
}
