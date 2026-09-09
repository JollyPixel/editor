// Import Third-party Dependencies
import { match } from "ts-pattern";
import { Emitter } from "@openally/emitt";
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type ClientEnvelope,
  type ServerEnvelope
} from "../protocol/Envelope.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../transport/constants.ts";
import type {
  Peer,
  PeerMetadata
} from "../protocol/types.ts";
import type {
  Room,
  RoomEventMap,
  RoomOptions
} from "./Room.ts";
import type { RoomMessageParser } from "../protocol/MessageParser.ts";
import {
  createLogger,
  type Logger
} from "./logger.ts";

export interface ClientOptions {
  /**
   * @default `${wss|ws}://${location.host}${DEFAULT_WEBSOCKET_PATH}`
   */
  url?: string;
  /**
   * Static metadata sent with each join request.
   */
  identity?: PeerMetadata;
  /**
   * @default a `console`-backed logger
   */
  logger?: Logger;
}

export type ClientEventMap = {
  ready: () => void;
};

// Client mutates this emitter. Consumers receive only the `Room` surface.
type InternalRoom<ClientMessage = any, ServerMessage = any> =
  Room<ClientMessage, ServerMessage>
  & Emitter<RoomEventMap<ServerMessage>>
  & { parser: RoomMessageParser<ServerMessage> | undefined; };

function getDefaultUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${location.host}${DEFAULT_WEBSOCKET_PATH}`;
}

export class Client extends Emitter<ClientEventMap> {
  readonly id: string = crypto.randomUUID();

  #identity: PeerMetadata;
  #logger: Logger;
  #socket: WebSocket;
  #ready = false;
  // Makes `#send` warn when queued messages can no longer flush.
  #closed = false;
  #destroyed = false;
  #queue: string[] = [];
  #rooms = new Map<string, InternalRoom>();

  constructor(
    options: ClientOptions
  ) {
    super();
    this.#identity = options.identity ?? {};
    this.#logger = options.logger ?? createLogger();
    this.#socket = new WebSocket(
      options.url ?? getDefaultUrl()
    );

    this.#socket.addEventListener("open", () => {
      this.#ready = true;
      for (const raw of this.#queue) {
        this.#socket.send(raw);
      }
      this.#queue = [];
      this.emit("ready");
    });
    this.#socket.addEventListener("message", (event) => {
      this.#handleMessage(event.data);
    });
    this.#socket.addEventListener("error", () => {
      this.#logger.error("WebSocket connection error");
    });
    this.#socket.addEventListener("close", (event) => {
      this.#ready = false;
      this.#closed = true;
      if (!this.#destroyed) {
        this.#logger
          .withMetadata({ code: event.code, reason: event.reason })
          .warn("WebSocket closed unexpectedly");
      }
    });
  }

  get ready(): boolean {
    return this.#ready;
  }

  room<ClientMessage = unknown, ServerMessage = unknown>(
    name: string,
    options: RoomOptions<ServerMessage> = {}
  ): Room<ClientMessage, ServerMessage> {
    const existing = this.#rooms.get(name);
    if (existing) {
      return existing;
    }

    const peers = new Map<string, Peer>();
    let joined = false;

    const room: InternalRoom<ClientMessage, ServerMessage> = Object.assign(
      new Emitter<RoomEventMap<ServerMessage>>(),
      {
        id: name,
        clientId: this.id,
        peers,
        parser: options.parser,
        join: () => {
          if (joined) {
            return;
          }
          joined = true;
          this.#send({
            room: name,
            kind: "join",
            identity: this.#identity
          });
        },
        send: (payload: ClientMessage) => this.#send({
          room: name,
          kind: "message",
          payload
        }),
        updatePresence: (patch: PeerMetadata) => this.#send({
          room: name,
          kind: "presence",
          patch
        }),
        leave: () => {
          this.#send({
            room: name,
            kind: "leave"
          });
          this.#rooms.delete(name);
          peers.clear();
        }
      }
    );

    this.#rooms.set(name, room);

    return room;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#socket.close();
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
    if (this.#ready) {
      this.#socket.send(raw);

      return;
    }
    if (this.#closed) {
      this.#logger
        .withMetadata({ envelope })
        .warn("queuing message on a closed socket; it will never be sent");
    }
    this.#queue.push(raw);
  }

  #handleMessage(
    raw: string
  ): void {
    Envelope.parseServer(raw)
      .orTee((error) => this.#logger
        .withMetadata({ raw, error: describeEnvelopeParseError(error) })
        .warn("dropped malformed envelope"))
      .andThen((envelope) => this.#roomFor(envelope))
      .andTee(([room, envelope]) => this.#dispatchEnvelope(room, envelope));
  }

  #roomFor(
    envelope: ServerEnvelope
  ): Result<[InternalRoom, ServerEnvelope], void> {
    const room = this.#rooms.get(envelope.room);
    const result: Result<[InternalRoom, ServerEnvelope], void> = room ?
      Ok([room, envelope]) :
      Err(undefined);

    return result.orTee(() => this.#logger
      .withMetadata({ room: envelope.room, kind: envelope.kind })
      .warn("dropped envelope for an unjoined room"));
  }

  #dispatchEnvelope(
    room: InternalRoom,
    envelope: ServerEnvelope
  ): void {
    // Client owns the writable map behind the public readonly view.
    const peers = room.peers as Map<string, Peer>;

    match(envelope)
      .with({ kind: "message" }, (envelope) => this.#handleRoomMessage(room, envelope))
      .with({ kind: "sync" }, (envelope) => this.#handleSync(room, peers, envelope))
      .with({ kind: "peer-joined" }, (envelope) => this.#handlePeerJoined(room, peers, envelope))
      .with({ kind: "peer-left" }, (envelope) => this.#handlePeerLeft(room, peers, envelope))
      .with({ kind: "peer-presence" }, (envelope) => this.#handlePeerPresence(room, peers, envelope))
      .with({ kind: "denied" }, (envelope) => this.#handleDenied(room, envelope))
      .with({ kind: "error" }, (envelope) => this.#handleError(room, envelope))
      .exhaustive();
  }

  #handleRoomMessage(
    room: InternalRoom,
    envelope: Extract<ServerEnvelope, { kind: "message"; }>
  ): void {
    if (room.parser === undefined) {
      room.emit("message", envelope.payload);

      return;
    }

    room.parser.parse(envelope.payload)
      .andTee((parsed) => room.emit("message", parsed.message))
      .orTee((errors) => room.emit("malformed", {
        payload: envelope.payload,
        errors
      }));
  }

  #handleSync(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<ServerEnvelope, { kind: "sync"; }>
  ): void {
    for (const member of envelope.members) {
      peers.set(member.clientId, {
        clientId: member.clientId,
        identity: member.identity,
        presence: member.presence
      });
    }

    room.emit("sync", {
      clientIds: envelope.members.map((member) => member.clientId)
    });
  }

  #handlePeerJoined(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<ServerEnvelope, { kind: "peer-joined"; }>
  ): void {
    peers.set(envelope.clientId, {
      clientId: envelope.clientId,
      identity: envelope.identity,
      presence: {}
    });

    room.emit("peer-joined", {
      clientId: envelope.clientId
    });
  }

  #handlePeerLeft(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<ServerEnvelope, { kind: "peer-left"; }>
  ): void {
    peers.delete(envelope.clientId);

    room.emit("peer-left", {
      clientId: envelope.clientId
    });
  }

  #handlePeerPresence(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<ServerEnvelope, { kind: "peer-presence"; }>
  ): void {
    const peer = peers.get(envelope.clientId);
    if (peer) {
      Object.assign(peer.presence, envelope.patch);
    }

    room.emit("peer-presence", {
      clientId: envelope.clientId,
      patch: envelope.patch
    });
  }

  #handleDenied(
    room: InternalRoom,
    envelope: Extract<ServerEnvelope, { kind: "denied"; }>
  ): void {
    room.emit("denied", {
      event: envelope.event,
      reason: envelope.reason
    });
  }

  #handleError(
    room: InternalRoom,
    envelope: Extract<ServerEnvelope, { kind: "error"; }>
  ): void {
    room.emit("error", {
      event: envelope.event,
      reason: envelope.reason
    });
  }
}
