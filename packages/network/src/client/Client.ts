// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type ClientEnvelope
} from "../protocol/envelope/Envelope.ts";
import { UNAUTHORIZED_CLOSE_CODE } from "../transport/constants.ts";
import { connectWebSocket } from "../transport/connectWebSocket.ts";
import type {
  ClientSocket,
  ClientSocketEvent
} from "../transport/ClientSocket.ts";
import type { PeerMetadata } from "../protocol/types.ts";
import type {
  Room,
  RoomOptions
} from "./Room.ts";
import { ClientRoom } from "./ClientRoom.ts";
import {
  createLogger,
  type Logger
} from "./logger.ts";

type ConnectionState =
  | "connecting"
  | "open"
  | "closing"
  | "closed";

export interface ClientOptions {
  profile?: PeerMetadata;
  logger?: Logger;
  /**
   * Opens the connection.
   * @default () => connectWebSocket()
   */
  socket?: () => ClientSocket;
}

export type ClientEventMap = {
  ready: () => void;
  unauthorized: () => void;
};

export class Client extends Emitter<ClientEventMap> {
  #profile: PeerMetadata;
  #logger: Logger;
  #socket: ClientSocket;
  #state: ConnectionState = "connecting";
  #queue: string[] = [];
  #rooms = new Map<string, ClientRoom>();

  constructor(
    options: ClientOptions = {}
  ) {
    super();
    this.#profile = options.profile ?? {};
    this.#logger = options.logger ?? createLogger();

    const connect = options.socket ?? connectWebSocket;
    this.#socket = connect();
    this.#socket.addEventListener("open", () => this.#open());
    this.#socket.addEventListener("message", (event) => this.#receive(event.data));
    this.#socket.addEventListener("error", () => {
      this.#logger.error("WebSocket connection error");
    });
    this.#socket.addEventListener("close", (event) => this.#close(event));
  }

  get ready(): boolean {
    return this.#state === "open";
  }

  room<TClientMessage = unknown, TServerMessage = unknown>(
    name: string,
    options: RoomOptions<TServerMessage> = {}
  ): Room<TClientMessage, TServerMessage> {
    const existing = this.#rooms.get(name);
    if (existing) {
      return existing;
    }

    const room = new ClientRoom<TClientMessage, TServerMessage>({
      id: name,
      profile: this.#profile,
      parser: options.parser,
      send: (envelope) => this.#send(envelope),
      onLeave: () => this.#rooms.delete(name)
    });

    this.#rooms.set(name, room);

    return room;
  }

  destroy(): void {
    if (this.#state === "closed") {
      return;
    }

    this.#state = "closing";
    this.#socket.close();
  }

  #open(): void {
    this.#state = "open";
    for (const raw of this.#queue) {
      this.#socket.send(raw);
    }
    this.#queue = [];
    this.emit("ready");
  }

  #close(
    event: ClientSocketEvent
  ): void {
    const expected = this.#state === "closing";
    this.#state = "closed";
    this.#queue = [];

    if (event.code === UNAUTHORIZED_CLOSE_CODE) {
      this.emit("unauthorized");

      return;
    }
    if (!expected) {
      this.#logger
        .withMetadata({ code: event.code, reason: event.reason })
        .warn("WebSocket closed unexpectedly");
    }
  }

  #send(
    envelope: ClientEnvelope
  ): void {
    Envelope.stringify(envelope)
      .orTee((error) => this.#logger
        .withMetadata({ envelope, error })
        .error("failed to serialize outgoing envelope"))
      .andTee((raw) => this.#dispatch(raw, envelope));
  }

  #dispatch(
    raw: string,
    envelope: ClientEnvelope
  ): void {
    if (this.#state === "open") {
      this.#socket.send(raw);
    }
    else if (this.#state === "connecting") {
      this.#queue.push(raw);
    }
    else {
      this.#logger
        .withMetadata({ envelope })
        .warn("dropped message on a closed socket");
    }
  }

  #receive(
    raw: unknown
  ): void {
    const parsed = Envelope.parseServer(raw);
    if (!parsed.ok) {
      this.#logger
        .withMetadata({ raw, error: describeEnvelopeParseError(parsed.val) })
        .warn("dropped malformed envelope");

      return;
    }

    const envelope = parsed.val;
    const room = this.#rooms.get(envelope.room);
    if (room === undefined) {
      this.#logger
        .withMetadata({ room: envelope.room, kind: envelope.kind })
        .warn("dropped envelope for an unjoined room");

      return;
    }

    room.receive(envelope);
  }
}
