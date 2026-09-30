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

// CONSTANTS
const kReconnectDelays: readonly number[] = [500, 1_000, 2_000, 5_000, 10_000];
const kAbnormalCloseCode = 1006;

type ConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closing"
  | "closed";

export interface ClientReconnectOptions {
  delays?: readonly number[];
}

export interface ClientOptions {
  profile?: PeerMetadata;
  logger?: Logger;
  /**
   * Opens the connection.
   * @default () => connectWebSocket()
   */
  socket?: () => ClientSocket;
  reconnect?: boolean | ClientReconnectOptions;
}

export type ClientEventMap = {
  ready: () => void;
  disconnected: () => void;
  unauthorized: () => void;
};

export class Client extends Emitter<ClientEventMap> {
  #profile: PeerMetadata;
  #logger: Logger;
  #connect: () => ClientSocket;
  #socket!: ClientSocket;
  #state: ConnectionState = "connecting";
  #queue: string[] = [];
  #rooms = new Map<string, ClientRoom>();
  #delays: readonly number[] | null;
  #attempt = 0;
  #suspended = false;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    options: ClientOptions = {}
  ) {
    super();
    this.#profile = options.profile ?? {};
    this.#logger = options.logger ?? createLogger();
    this.#connect = options.socket ?? connectWebSocket;
    this.#delays = reconnectDelays(options.reconnect ?? true);
    this.#openSocket();
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

    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#state = "closed";
      this.#queue = [];

      return;
    }

    this.#state = "closing";
    this.#socket.close();
  }

  #openSocket(): void {
    const socket = this.#connect();
    this.#socket = socket;
    socket.addEventListener("open", () => this.#open(socket));
    socket.addEventListener("message", (event) => {
      if (socket === this.#socket) {
        this.#receive(event.data);
      }
    });
    socket.addEventListener("error", () => {
      this.#logger.error("WebSocket connection error");
    });
    socket.addEventListener("close", (event) => this.#close(socket, event));
  }

  #open(
    socket: ClientSocket
  ): void {
    if (socket !== this.#socket) {
      return;
    }

    this.#state = "open";
    this.#attempt = 0;
    if (this.#suspended) {
      this.#suspended = false;
      for (const room of this.#rooms.values()) {
        room.rejoin();
      }
    }
    for (const raw of this.#queue) {
      this.#socket.send(raw);
    }
    this.#queue = [];
    this.emit("ready");
  }

  #close(
    socket: ClientSocket,
    event: ClientSocketEvent
  ): void {
    if (socket !== this.#socket) {
      return;
    }

    const expected = this.#state === "closing";
    const wasOpen = this.#state === "open";
    if (
      expected ||
      this.#delays === null ||
      event.code === UNAUTHORIZED_CLOSE_CODE
    ) {
      this.#state = "closed";
      this.#queue = [];
      this.#suspendRooms(wasOpen);
      if (event.code === UNAUTHORIZED_CLOSE_CODE) {
        this.emit("unauthorized");
      }
      else if (!expected) {
        this.#warnClosed(event);
      }

      return;
    }

    this.#state = "reconnecting";
    if (wasOpen) {
      this.#warnClosed(event);
      this.#suspendRooms(true);
    }
    const delays = this.#delays;
    const delay = delays[Math.min(this.#attempt, delays.length - 1)];
    this.#attempt++;
    this.#timer = setTimeout(() => this.#retry(), delay);
  }

  #retry(): void {
    this.#timer = null;
    try {
      this.#openSocket();
    }
    catch (error) {
      this.#logger
        .withMetadata({ error })
        .error("failed to reopen the connection");
      this.#close(this.#socket, {
        code: kAbnormalCloseCode,
        reason: "reconnect failed"
      });
    }
  }

  #suspendRooms(
    wasOpen: boolean
  ): void {
    if (!wasOpen) {
      return;
    }

    this.#suspended = true;
    for (const room of this.#rooms.values()) {
      room.suspend();
    }
    this.emit("disconnected");
  }

  #warnClosed(
    event: ClientSocketEvent
  ): void {
    this.#logger
      .withMetadata({ code: event.code, reason: event.reason })
      .warn("WebSocket closed unexpectedly");
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
    else if (
      this.#state === "connecting" ||
      this.#state === "reconnecting"
    ) {
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

function reconnectDelays(
  option: boolean | ClientReconnectOptions
): readonly number[] | null {
  if (option === false) {
    return null;
  }

  const delays = option === true ?
    kReconnectDelays :
    option.delays ?? kReconnectDelays;

  return delays.length === 0 ? null : delays;
}
